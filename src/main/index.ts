import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import path from 'path'
import { existsSync, promises as fs } from 'fs'
import type {
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
import { HealthCheckManager } from './services/healthCheck'
import { buildRequestHeaders, buildUrl, redactHeaders, sendHttpRequest } from './services/httpClient'
import { getStore, initStore, updateStore } from './services/storage'

const MAX_HISTORY = 200

let mainWindow: BrowserWindow | null = null
let healthManager: HealthCheckManager

const createWindow = async () => {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  // electron-vite sets VITE_DEV_SERVER_URL, but if not available, try common ports
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const preloadPath = path.resolve(__dirname, '../preload/index.cjs')
  
  console.log('Creating window:', { isDev, devServerUrl, preloadPath, __dirname })
  
  // Check if preload file exists
  const preloadExists = existsSync(preloadPath)
  console.log('Preload file exists:', preloadExists, preloadPath)
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
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
    console.log(`[Renderer ${level}]:`, message)
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
    console.log('Loading HTML file:', htmlPath)
    await mainWindow.loadFile(htmlPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
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

function getByPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined
  const segments = path.split('.')
  let current: unknown = obj
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined
    const key = /^\d+$/.test(seg) ? Number.parseInt(seg, 10) : seg
    current = typeof current === 'object' && current !== null && key in current
      ? (current as Record<string | number, unknown>)[key]
      : undefined
  }
  return current
}

function substituteVariables(
  text: string,
  stepResults: Map<number, ResponseData>
): string {
  return text.replace(/\{\{step(\d+)(?:\.([^}]+))?\}\}/g, (_, stepNum, path) => {
    const n = Number.parseInt(stepNum, 10)
    const response = stepResults.get(n)
    if (!response) return ''
    if (!path || path.trim() === '') return response.body ?? ''
    if (path.trim() === 'status') return String(response.status)
    const value = getByPath(response.parsedBody, path.trim())
    if (value === undefined) return ''
    return typeof value === 'object' || typeof value === 'boolean'
      ? JSON.stringify(value)
      : String(value)
  })
}

function substituteHeaders(
  headers: Record<string, string> | undefined,
  stepResults: Map<number, ResponseData>
): Record<string, string> | undefined {
  if (!headers || Object.keys(headers).length === 0) return headers
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = substituteVariables(v, stepResults)
  }
  return out
}

const executeRequest = async (
  device: Device,
  request: RequestOptions,
  storeHistory: boolean
) => {
  const url = buildUrl(device, request.path)
  const headers = buildRequestHeaders(request.headers, request.authOverride ?? device.auth)
  const response = await sendHttpRequest({
    url,
    method: request.method,
    headers,
    body: request.body,
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

const registerIpc = () => {
  ipcMain.handle('app:getState', () => getStore())

  ipcMain.handle('app:exportConfig', async () => {
    const store = getStore()
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Configuration',
      defaultPath: 'rest-client-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    const data = { version: EXPORT_VERSION, devices: store.devices, macros: store.macros, folders: store.folders }
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
      const parsed = JSON.parse(raw) as { devices?: unknown[]; macros?: unknown[]; folders?: unknown[] }
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
    const device = normalizeDeviceInput(input, existing)

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
    const store = getStore()
    const folder = store.folders.find((f) => f.id === id)
    if (!folder) return null
    folder.name = String(name ?? folder.name).trim() || folder.name
    await updateStore(() => {})
    return folder
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
        const path = substituteVariables(step.path, stepResults)
        const headers = substituteHeaders(step.headers, stepResults)
        const body = step.body ? substituteVariables(step.body, stepResults) : undefined
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
}

const boot = async () => {
  await app.whenReady()
  await initStore()

  healthManager = new HealthCheckManager(async (deviceId, status) => {
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
  healthManager.sync(getStore().devices)
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
