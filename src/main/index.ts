/** Main процес: прозорци, IPC, мрежов слой, локално състояние и сигурност (без UI директно). */
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { randomUUID } from 'crypto'
import path from 'path'
import { existsSync, promises as fs } from 'fs'

/** Споделени типове между main, preload и renderer (DTO за устройства, заявки, store). */
import type {
  AppSettings,
  Device,
  DeviceInput,
  HistoryEntry,
  Macro,
  MacroFolder,
  MacroInput,
  MacroRunResult,
  RequestOptions,
  ResponseData
} from '../shared/types'

/** Периодичен health check към конфигурирани крайни точки. */
import { HealthCheckManager } from './services/healthCheck'
/** Fetch-базиран HTTP клиент, URL builder, заглавки и редакция на тайни за историята. */
import { buildRequestHeaders, buildUrlWithQuery, redactHeaders, sendHttpRequest } from './services/httpClient'
/** Подстановки `{{var}}` и `{{stepN.field}}` за макроси и единични заявки. */
import { applyTemplateChain, substituteHeadersFull } from './services/macroTemplate'
/** Локален акаунт на приложението (scrypt), сесия lock/unlock преди vault/store. */
import {
  hasAuthAccount,
  isAppSessionUnlocked,
  lockAppSession,
  readAuthRecord,
  registerAccount,
  verifyLogin
} from './services/appAuth'
/** Потребителски store, опционален криптиран vault, импорт/експорт на конфигурация. */
import {
  changeVaultPassword,
  consumeStoreLoadError,
  disableVault,
  enableVault,
  getStore,
  getVaultStatus,
  initStore,
  isVaultLockedForUse,
  lockVaultSession,
  unlockVault,
  updateStore
} from './services/storage'

const MAX_HISTORY = 200

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let healthManager!: HealthCheckManager

const createWindow = async () => {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  // electron-vite sets VITE_DEV_SERVER_URL, but if not available, try common ports
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const preloadPath = path.resolve(__dirname, '../preload/index.cjs')

  if (isDev) {
    console.log('Creating window:', { isDev, devServerUrl, preloadPath, __dirname })
    const preloadExists = existsSync(preloadPath)
    console.log('Preload file exists:', preloadExists, preloadPath)
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    center: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', { errorCode, errorDescription, url: devServerUrl })
  })
  
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (isDev) {
      console.log(`[Renderer ${level}]:`, message)
    }
  })
  
  if (isDev) {
    console.log('Loading dev URL:', devServerUrl)
    try {
      await mainWindow.loadURL(devServerUrl)
    } catch (error) {
      console.error('Failed to load dev URL:', error)
      const altUrl = devServerUrl.replace(':5173', ':5174')
      try {
        await mainWindow.loadURL(altUrl)
      } catch (altError) {
        console.error('Fallback port failed:', altError)
      }
    }
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const htmlPath = path.join(__dirname, '../renderer/index.html')
    await mainWindow.loadFile(htmlPath)
  }

  mainWindow.on('closed', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close()
    }
    mainWindow = null
  })
}

function mergeAuthKeepSecrets(input: DeviceInput, existing?: Device): DeviceInput {
  const auth = input.auth
  const ex = existing?.auth
  if (!auth) return input
  if (auth.type === 'basic' && auth.basic) {
    if (auth.basic.password === '' && ex?.type === 'basic' && ex.basic?.password) {
      return {
        ...input,
        auth: {
          type: 'basic',
          basic: { username: auth.basic.username, password: ex.basic.password }
        }
      }
    }
  }
  if (auth.type === 'bearer' && auth.bearer) {
    if (auth.bearer.token === '' && ex?.type === 'bearer' && ex.bearer?.token) {
      return {
        ...input,
        auth: { type: 'bearer', bearer: { token: ex.bearer.token } }
      }
    }
  }
  if (auth.type === 'apiKey' && auth.apiKey) {
    if (auth.apiKey.value === '' && ex?.type === 'apiKey' && ex.apiKey?.value) {
      return {
        ...input,
        auth: {
          type: 'apiKey',
          apiKey: {
            headerName: auth.apiKey.headerName,
            value: ex.apiKey.value
          }
        }
      }
    }
  }
  return input
}

function deviceForExport(d: Device): Device {
  const auth = d.auth
  if (!auth || auth.type === 'none') return d
  if (auth.type === 'basic') {
    return {
      ...d,
      auth: { type: 'basic', basic: { username: auth.basic?.username ?? '' } }
    }
  }
  if (auth.type === 'bearer') {
    return { ...d, auth: { type: 'bearer', bearer: {} } }
  }
  if (auth.type === 'apiKey') {
    return {
      ...d,
      auth: {
        type: 'apiKey',
        apiKey: { headerName: auth.apiKey?.headerName ?? 'X-API-Key' }
      }
    }
  }
  return d
}

function getGlobalVariables(): Record<string, string> {
  return getStore().settings?.globalVariables ?? {}
}

const normalizeDeviceInput = (input: DeviceInput, existing?: Device): Device => {
  const id = input.id ?? existing?.id ?? randomUUID()
  const ip = input.ip?.trim() ?? existing?.ip ?? ''
  const port = input.port ?? existing?.port ?? 80
  const name = input.name?.trim() || existing?.name || `${ip}:${port}`
  const protocol = input.protocol ?? existing?.protocol ?? 'http'
  const basePath = input.basePath ?? existing?.basePath
  const auth = input.auth ?? existing?.auth ?? { type: 'none' }
  const healthCheck = input.healthCheck ?? existing?.healthCheck ?? {
    enabled: false,
    path: '/health',
    intervalSec: 30
  }
  const status = input.status ?? existing?.status ?? { state: 'unknown' }

  return {
    id,
    name,
    ip,
    port,
    protocol,
    basePath,
    auth,
    healthCheck: {
      ...healthCheck,
      path: healthCheck.path?.trim() || '/health',
      intervalSec: Math.max(5, healthCheck.intervalSec || 30)
    },
    status
  }
}

const executeRequest = async (
  device: Device,
  request: RequestOptions,
  storeHistory: boolean
) => {
  const globals = getGlobalVariables()
  const emptySteps = new Map<number, ResponseData>()
  const pathResolved = applyTemplateChain(request.path, globals, emptySteps)
  const bodyResolved = request.body
    ? applyTemplateChain(request.body, globals, emptySteps)
    : undefined
  const headersResolved = substituteHeadersFull(request.headers, globals, emptySteps)
  const url = buildUrlWithQuery(device, pathResolved, request.query)
  const headers = buildRequestHeaders(headersResolved, request.authOverride ?? device.auth)
  const response = await sendHttpRequest({
    url,
    method: request.method,
    headers,
    body: bodyResolved,
    timeoutMs: request.timeoutMs
  })

  if (storeHistory) {
    const entry: HistoryEntry = {
      id: randomUUID(),
      deviceId: device.id,
      method: request.method,
      path: request.path,
      url,
      headers: redactHeaders(headers),
      body: request.body,
      query: request.query,
      timestamp: Date.now(),
      response
    }

    await updateStore((store) => {
      store.history.unshift(entry)
      if (store.history.length > MAX_HISTORY) {
        store.history.length = MAX_HISTORY
      }
    })
  }

  return response
}

const EXPORT_VERSION = 1

function broadcastVaultStatus() {
  const st = getVaultStatus()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('vault:statusUpdated', st)
    }
  }
}

function broadcastSessionLocked() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('app:sessionLocked')
    }
  }
}

const registerIpc = () => {
  ipcMain.handle('auth:getBootstrap', () => ({
    hasAccount: hasAuthAccount(),
    sessionUnlocked: isAppSessionUnlocked()
  }))
  ipcMain.handle('auth:getUsername', async () => {
    const r = await readAuthRecord()
    return r?.username ?? ''
  })
  ipcMain.handle('auth:register', async (_event, username: string, password: string) =>
    registerAccount(String(username ?? ''), String(password ?? ''))
  )
  ipcMain.handle('auth:login', async (_event, username: string, password: string) =>
    verifyLogin(String(username ?? ''), String(password ?? ''))
  )
  ipcMain.handle('auth:lockSession', async () => {
    lockAppSession()
    await lockVaultSession()
    healthManager.sync([])
    broadcastVaultStatus()
    broadcastSessionLocked()
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close()
    }
  })

  ipcMain.handle('app:getState', () => {
    try {
      return getStore()
    } catch (e) {
      if (e instanceof Error && e.message === 'APP_AUTH_LOCKED') {
        return { error: 'APP_AUTH_LOCKED' as const }
      }
      if (e instanceof Error && e.message === 'VAULT_LOCKED') {
        return { error: 'VAULT_LOCKED' as const }
      }
      throw e
    }
  })
  ipcMain.handle('app:getStoreLoadError', () => consumeStoreLoadError())
  ipcMain.handle('vault:status', () => getVaultStatus())
  ipcMain.handle('vault:unlock', async (_event, password: string) => {
    const result = await unlockVault(String(password ?? ''))
    if (result.ok) {
      healthManager.sync(getStore().devices)
    }
    broadcastVaultStatus()
    return result
  })
  ipcMain.handle('vault:lock', async () => {
    await lockVaultSession()
    healthManager.sync([])
    broadcastVaultStatus()
  })
  ipcMain.handle('vault:enable', async (_event, password: string) => {
    const r = await enableVault(String(password ?? ''))
    broadcastVaultStatus()
    return r
  })
  ipcMain.handle('vault:disable', async (_event, password: string) => {
    const r = await disableVault(String(password ?? ''))
    broadcastVaultStatus()
    return r
  })
  ipcMain.handle('vault:changePassword', async (_event, current: string, next: string) => {
    const r = await changeVaultPassword(String(current ?? ''), String(next ?? ''))
    broadcastVaultStatus()
    return r
  })

  ipcMain.handle('app:exportConfig', async () => {
    const store = getStore()
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Configuration',
      defaultPath: 'rest-client-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    const data = {
      version: EXPORT_VERSION,
      settings: store.settings,
      devices: store.devices.map(deviceForExport),
      macros: store.macros,
      folders: store.folders
    }
    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true }
  })

  ipcMain.handle('app:importConfig', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Configuration',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    const filePath = result.filePaths?.[0]
    if (result.canceled || !filePath) return { ok: false, error: null }
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as {
        devices?: unknown[]
        macros?: unknown[]
        folders?: unknown[]
        settings?: Partial<AppSettings>
      }
      const devices = Array.isArray(parsed.devices) ? parsed.devices : []
      const macros = Array.isArray(parsed.macros) ? parsed.macros : []
      const folders = Array.isArray(parsed.folders) ? parsed.folders : []
      const store = getStore()
      const idMap = new Map<string, string>()
      const folderIdMap = new Map<string, string>()
      const newDevices = devices.map((d) => {
        const rec = d as Record<string, unknown>
        const oldId = String(rec.id ?? randomUUID())
        const newId = randomUUID()
        idMap.set(oldId, newId)
        return normalizeDeviceInput({ ...rec, id: newId } as DeviceInput)
      })
      const newFolders: MacroFolder[] = folders.map((f) => {
        const rec = f as Record<string, unknown>
        const oldId = String(rec.id ?? randomUUID())
        const newId = randomUUID()
        folderIdMap.set(oldId, newId)
        return { id: newId, name: String(rec.name ?? 'Folder') }
      })
      const newMacros: Macro[] = macros.map((m) => {
        const rec = m as Record<string, unknown>
        const deviceId =
          idMap.get(String(rec.deviceId ?? '')) ??
          newDevices[0]?.id ??
          store.devices[0]?.id ??
          ''
        const steps = Array.isArray(rec.steps)
          ? (rec.steps as Macro['steps']).map((s: Macro['steps'][0]) => ({
              id: s.id ?? randomUUID(),
              name: s.name,
              method: s.method,
              path: s.path,
              headers: s.headers,
              body: s.body,
              delayMs: s.delayMs
            }))
          : []
        const folderId = rec.folderId
          ? (folderIdMap.get(String(rec.folderId)) ?? undefined)
          : undefined
        return {
          id: randomUUID(),
          name: String(rec.name ?? 'Macro'),
          deviceId,
          folderId,
          steps,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      })
      await updateStore((current) => {
        if (parsed.settings) {
          current.settings = {
            theme: parsed.settings.theme === 'dark' ? 'dark' : 'light',
            locale: parsed.settings.locale === 'en' ? 'en' : 'bg',
            globalVariables: {
              ...(current.settings?.globalVariables ?? {}),
              ...(parsed.settings.globalVariables ?? {})
            },
            security: {
              idleLockMinutes:
                parsed.settings.security?.idleLockMinutes ??
                current.settings?.security?.idleLockMinutes ??
                0
            }
          }
        }
        current.devices.push(...newDevices)
        current.folders.push(...newFolders)
        current.macros.push(...newMacros)
      })
      healthManager.sync(getStore().devices)
      return { ok: true, error: null }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Import failed' }
    }
  })

  ipcMain.handle('devices:upsert', async (_event, input: DeviceInput) => {
    const store = getStore()
    const index = store.devices.findIndex((device) => device.id === input.id)
    const existing = index >= 0 ? store.devices[index] : undefined
    const merged = mergeAuthKeepSecrets(input, existing)
    const device = normalizeDeviceInput(merged, existing)

    await updateStore((current) => {
      const existingIndex = current.devices.findIndex((item) => item.id === device.id)
      if (existingIndex >= 0) {
        current.devices[existingIndex] = device
      } else {
        current.devices.push(device)
      }
    })

    healthManager.sync(getStore().devices)
    return device
  })

  ipcMain.handle('devices:remove', async (_event, deviceId: string) => {
    await updateStore((store) => {
      store.devices = store.devices.filter((device) => device.id !== deviceId)
      store.macros = store.macros.filter((macro) => macro.deviceId !== deviceId)
    })
    healthManager.sync(getStore().devices)
  })

  ipcMain.handle('requests:send', async (_event, request: RequestOptions) => {
    const device = getStore().devices.find((item) => item.id === request.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    return executeRequest(device, request, true)
  })

  ipcMain.handle('history:clear', async () => {
    await updateStore((store) => {
      store.history = []
    })
  })

  ipcMain.handle('macros:upsert', async (_event, input: MacroInput) => {
    const now = Date.now()
    const store = getStore()
    const index = store.macros.findIndex((macro) => macro.id === input.id)
    const existing = index >= 0 ? store.macros[index] : undefined
    const macro: Macro = {
      id: input.id ?? existing?.id ?? randomUUID(),
      name: input.name?.trim() || existing?.name || 'Macro',
      deviceId: input.deviceId ?? existing?.deviceId ?? '',
      steps: input.steps ?? existing?.steps ?? [],
      folderId: input.folderId ?? existing?.folderId,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: now
    }

    await updateStore((current) => {
      const existingIndex = current.macros.findIndex((item) => item.id === macro.id)
      if (existingIndex >= 0) {
        current.macros[existingIndex] = macro
      } else {
        current.macros.push(macro)
      }
    })

    return macro
  })

  ipcMain.handle('macros:remove', async (_event, macroId: string) => {
    await updateStore((store) => {
      store.macros = store.macros.filter((macro) => macro.id !== macroId)
    })
  })

  ipcMain.handle('folders:create', async (_event, name: string): Promise<MacroFolder> => {
    const folder: MacroFolder = {
      id: randomUUID(),
      name: String(name ?? 'New folder').trim() || 'New folder'
    }
    await updateStore((store) => {
      store.folders.push(folder)
    })
    return folder
  })

  ipcMain.handle('folders:update', async (_event, id: string, name: string): Promise<MacroFolder | null> => {
    let updated: MacroFolder | null = null
    await updateStore((store) => {
      const folder = store.folders.find((f) => f.id === id)
      if (!folder) return
      folder.name = String(name ?? folder.name).trim() || folder.name
      updated = { id: folder.id, name: folder.name, parentId: folder.parentId }
    })
    return updated
  })

  ipcMain.handle('folders:remove', async (_event, id: string): Promise<void> => {
    await updateStore((store) => {
      store.folders = store.folders.filter((f) => f.id !== id)
      store.macros.forEach((m) => {
        if (m.folderId === id) m.folderId = undefined
      })
    })
  })

  ipcMain.handle('macros:run', async (_event, macroId: string): Promise<MacroRunResult> => {
    const store = getStore()
    const macro = store.macros.find((item) => item.id === macroId)
    if (!macro) {
      throw new Error('Macro not found')
    }

    const device = store.devices.find((item) => item.id === macro.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const startedAt = Date.now()
    const results: MacroRunResult['results'] = []

    for (let i = 0; i < macro.steps.length; i++) {
      const step = macro.steps[i]
      const stepResults = new Map<number, ResponseData>()
      for (let j = 0; j < i; j++) {
        const r = results[j]
        if (r?.response) stepResults.set(j + 1, r.response)
      }
      try {
        const globals = getGlobalVariables()
        const path = applyTemplateChain(step.path, globals, stepResults)
        const headers = substituteHeadersFull(step.headers, globals, stepResults)
        const body = step.body ? applyTemplateChain(step.body, globals, stepResults) : undefined
        const response = await executeRequest(
          device,
          {
            deviceId: device.id,
            method: step.method,
            path,
            headers,
            body
          },
          true
        )
        results.push({ stepId: step.id, stepName: step.name, response })
      } catch (err) {
        results.push({
          stepId: step.id,
          stepName: step.name,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }

      if (step.delayMs && step.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, step.delayMs))
      }
    }

    return {
      macroId: macro.id,
      startedAt,
      finishedAt: Date.now(),
      results
    }
  })

  ipcMain.handle('app:updateSettings', async (_event, next: AppSettings) => {
    await updateStore((store) => {
      store.settings = {
        theme: next.theme,
        locale: next.locale,
        globalVariables: { ...next.globalVariables },
        security: {
          idleLockMinutes:
            next.security?.idleLockMinutes ?? store.settings?.security?.idleLockMinutes ?? 0
        }
      }
    })
    const updated = getStore().settings
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('app:settingsUpdated', updated)
      }
    }
    return updated
  })

  ipcMain.handle('app:focusMainWindow', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  ipcMain.handle('app:openSettingsWindow', async () => {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    const preloadPath = path.resolve(__dirname, '../preload/index.cjs')
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.focus()
      return
    }
    const workArea = screen.getPrimaryDisplay().workArea
    settingsWindow = new BrowserWindow({
      x: workArea.x,
      y: workArea.y,
      width: 440,
      height: 560,
      minWidth: 360,
      minHeight: 400,
      parent: mainWindow ?? undefined,
      show: false,
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    settingsWindow.once('ready-to-show', () => {
      settingsWindow?.show()
    })
    settingsWindow.on('closed', () => {
      settingsWindow = null
    })

    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    const withSettingsQuery = (base: string) => {
      const u = new URL(base)
      u.searchParams.set('window', 'settings')
      return u.toString()
    }

    try {
      if (isDev) {
        try {
          await settingsWindow.loadURL(withSettingsQuery(devServerUrl))
        } catch {
          await settingsWindow.loadURL(withSettingsQuery(devServerUrl.replace(':5173', ':5174')))
        }
      } else {
        const htmlPath = path.join(__dirname, '../renderer/index.html')
        await settingsWindow.loadFile(htmlPath, { query: { window: 'settings' } })
      }
    } catch (error) {
      console.error('Failed to load settings window:', error)
      settingsWindow.close()
    }
  })
}

const boot = async () => {
  await app.whenReady()
  await initStore()

  healthManager = new HealthCheckManager(async (deviceId, status) => {
    if (isVaultLockedForUse() || !isAppSessionUnlocked()) {
      return
    }
    await updateStore((store) => {
      const device = store.devices.find((item) => item.id === deviceId)
      if (device) {
        device.status = status
      }
    })

    mainWindow?.webContents.send('devices:status', { deviceId, status })
  })

  await createWindow()
  registerIpc()
  if (!isVaultLockedForUse() && isAppSessionUnlocked()) {
    try {
      healthManager.sync(getStore().devices)
    } catch {
      healthManager.sync([])
    }
  } else {
    healthManager.sync([])
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow()
  }
})

boot()
