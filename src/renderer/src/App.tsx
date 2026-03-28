import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  AppSettings,
  AuthType,
  Device,
  DeviceInput,
  HistoryEntry,
  HttpMethod,
  Macro,
  MacroFolder,
  MacroInput,
  MacroRunResult,
  RequestOptions,
  ResponseData
} from '@shared/types'
import { t } from './i18n'

type TabKey = 'request' | 'history' | 'macros'

type DeviceFormState = {
  id?: string
  name: string
  ip: string
  port: string
  protocol: 'http' | 'https'
  basePath: string
  authType: AuthType
  username: string
  password: string
  token: string
  apiKeyHeader: string
  apiKeyValue: string
  healthEnabled: boolean
  healthPath: string
  healthInterval: string
  healthTimeout: string
}

type MacroStepForm = {
  id: string
  name: string
  method: HttpMethod
  path: string
  headersText: string
  body: string
  delayMs: string
}

type MacroFormState = {
  id?: string
  name: string
  deviceId: string
  folderId: string
  steps: MacroStepForm[]
}

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const defaultAppSettings = (): AppSettings => ({
  theme: 'light',
  locale: 'bg',
  globalVariables: {}
})

function parseGlobalsText(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (k) out[k] = v
  }
  return out
}
const authTypes: AuthType[] = ['none', 'basic', 'bearer', 'apiKey']

const createEmptyDeviceForm = (): DeviceFormState => ({
  name: '',
  ip: '',
  port: '80',
  protocol: 'http',
  basePath: '',
  authType: 'none',
  username: '',
  password: '',
  token: '',
  apiKeyHeader: 'X-API-Key',
  apiKeyValue: '',
  healthEnabled: false,
  healthPath: '/health',
  healthInterval: '30',
  healthTimeout: ''
})

const deviceToForm = (device?: Device | null): DeviceFormState => {
  if (!device) {
    return createEmptyDeviceForm()
  }

  return {
    id: device.id,
    name: device.name ?? '',
    ip: device.ip ?? '',
    port: String(device.port ?? 80),
    protocol: device.protocol ?? 'http',
    basePath: device.basePath ?? '',
    authType: device.auth?.type ?? 'none',
    username: device.auth?.basic?.username ?? '',
    password: device.auth?.basic?.password ?? '',
    token: device.auth?.bearer?.token ?? '',
    apiKeyHeader: device.auth?.apiKey?.headerName ?? 'X-API-Key',
    apiKeyValue: device.auth?.apiKey?.value ?? '',
    healthEnabled: device.healthCheck?.enabled ?? false,
    healthPath: device.healthCheck?.path ?? '/health',
    healthInterval: String(device.healthCheck?.intervalSec ?? 30),
    healthTimeout: device.healthCheck?.timeoutMs ? String(device.healthCheck.timeoutMs) : ''
  }
}

const formToDeviceInput = (form: DeviceFormState): DeviceInput => {
  const portValue = Number(form.port)
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : 80
  const basePath = form.basePath.trim()
  const authType = form.authType ?? 'none'

  const auth =
    authType === 'basic'
      ? {
          type: 'basic' as const,
          basic: {
            username: form.username,
            password: form.password
          }
        }
      : authType === 'bearer'
        ? {
            type: 'bearer' as const,
            bearer: {
              token: form.token
            }
          }
        : authType === 'apiKey'
          ? {
              type: 'apiKey' as const,
              apiKey: {
                headerName: form.apiKeyHeader || 'X-API-Key',
                value: form.apiKeyValue
              }
            }
          : { type: 'none' as const }

  const intervalValue = Number(form.healthInterval)
  const timeoutValue = Number(form.healthTimeout)

  return {
    id: form.id,
    name: form.name,
    ip: form.ip,
    port,
    protocol: form.protocol,
    basePath: basePath.length ? basePath : undefined,
    auth,
    healthCheck: {
      enabled: form.healthEnabled,
      path: form.healthPath || '/health',
      intervalSec: Number.isFinite(intervalValue) && intervalValue > 0 ? intervalValue : 30,
      timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : undefined
    }
  }
}

const createEmptyMacroForm = (deviceId = '', folderId = ''): MacroFormState => ({
  name: '',
  deviceId,
  folderId,
  steps: [
    {
      id: crypto.randomUUID(),
      name: 'Стъпка 1',
      method: 'GET',
      path: '',
      headersText: '{}',
      body: '',
      delayMs: ''
    }
  ]
})

const macroToForm = (macro?: Macro | null, deviceId = ''): MacroFormState => {
  if (!macro) {
    return createEmptyMacroForm(deviceId, '')
  }

  return {
    id: macro.id,
    name: macro.name,
    deviceId: macro.deviceId,
    folderId: macro.folderId ?? '',
    steps: macro.steps.map((step, index) => ({
      id: step.id,
      name: step.name || `Стъпка ${index + 1}`,
      method: step.method,
      path: step.path,
      headersText: step.headers ? JSON.stringify(step.headers, null, 2) : '{}',
      body: step.body ?? '',
      delayMs: step.delayMs ? String(step.delayMs) : ''
    }))
  }
}

const formToMacroInput = (form: MacroFormState): { input?: MacroInput; error?: string } => {
  const steps = form.steps.map((step) => {
    let headers: Record<string, string> | undefined

    if (step.headersText.trim()) {
      try {
        const parsed = JSON.parse(step.headersText)
        if (parsed && typeof parsed === 'object') {
          headers = parsed
        } else {
          throw new Error('Headers should be JSON object')
        }
      } catch {
        throw new Error(`Невалидни headers при "${step.name || step.id}"`)
      }
    }

    const delayValue = Number(step.delayMs)

    return {
      id: step.id || crypto.randomUUID(),
      name: step.name,
      method: step.method,
      path: step.path,
      headers,
      body: step.body || undefined,
      delayMs: Number.isFinite(delayValue) && delayValue > 0 ? delayValue : undefined
    }
  })

  return {
    input: {
      id: form.id,
      name: form.name || 'Macro',
      deviceId: form.deviceId,
      folderId: form.folderId || undefined,
      steps
    }
  }
}

export default function App() {
  const [devices, setDevices] = useState<Device[]>([])
  const [folders, setFolders] = useState<MacroFolder[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [macros, setMacros] = useState<Macro[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('request')
  const [lastResponse, setLastResponse] = useState<ResponseData | null>(null)
  const [macroRun, setMacroRun] = useState<MacroRunResult | null>(null)
  const [sending, setSending] = useState(false)
  const [requestSendError, setRequestSendError] = useState<string | null>(null)
  const [macroError, setMacroError] = useState<string | null>(null)
  const [historySelection, setHistorySelection] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [startupLoadError, setStartupLoadError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [globalsText, setGlobalsText] = useState('')
  const [historyToRequestSeed, setHistoryToRequestSeed] = useState<HistoryEntry | null>(null)

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId]
  )

  const selectedMacro = useMemo(
    () => macros.find((macro) => macro.id === selectedMacroId) ?? null,
    [macros, selectedMacroId]
  )

  const loadState = async () => {
    if (!window.api) {
      console.error('window.api is not available')
      return
    }
    try {
      const state = await window.api.getState()
      setDevices(state.devices)
      setFolders(state.folders ?? [])
      setHistory(state.history)
      setMacros(state.macros)
      const nextSettings: AppSettings = {
        theme: state.settings?.theme ?? 'light',
        locale: state.settings?.locale ?? 'bg',
        globalVariables: { ...(state.settings?.globalVariables ?? {}) }
      }
      setSettings(nextSettings)
      setGlobalsText(
        Object.entries(nextSettings.globalVariables)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      )

    setSelectedDeviceId((current) => {
      if (current && state.devices.some((device) => device.id === current)) {
        return current
      }
      return state.devices[0]?.id ?? null
    })

      setSelectedMacroId((current) => {
        if (current && state.macros.some((macro) => macro.id === current)) {
          return current
        }
        return state.macros[0]?.id ?? null
      })
    } catch (error) {
      console.error('Failed to load state:', error)
    }
  }

  useEffect(() => {
    void loadState()
  }, [])

  useEffect(() => {
    if (!window.api) return
    void (async () => {
      const err = await window.api.getStoreLoadError()
      if (err) setStartupLoadError(err)
    })()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  useEffect(() => {
    if (!window.api) return
    
    const unsubscribe = window.api.onDeviceStatus((update) => {
      setDevices((prev) =>
        prev.map((device) =>
          device.id === update.deviceId ? { ...device, status: update.status } : device
        )
      )
    })

    return () => unsubscribe()
  }, [])

  const handleSaveDevice = async (input: DeviceInput) => {
    await window.api.saveDevice(input)
    await loadState()
  }

  const handleRemoveDevice = async (deviceId: string) => {
    await window.api.removeDevice(deviceId)
    setSelectedDeviceId(null)
    await loadState()
  }

  const handleSendRequest = async (request: RequestOptions) => {
    setSending(true)
    setLastResponse(null)
    setRequestSendError(null)
    try {
      const response = await window.api.sendRequest(request)
      setLastResponse(response)
      await loadState()
    } catch (error) {
      setRequestSendError(error instanceof Error ? error.message : 'Грешка при изпращане')
    } finally {
      setSending(false)
    }
  }

  const handleClearHistory = async () => {
    await window.api.clearHistory()
    setHistorySelection(null)
    await loadState()
  }

  const persistAppSettings = async (next: AppSettings) => {
    await window.api.updateSettings(next)
    await loadState()
  }

  const handleDuplicateFromHistory = (entry: HistoryEntry) => {
    setHistoryToRequestSeed(entry)
    setActiveTab('request')
  }

  const handleReplayRequest = async (entry: HistoryEntry) => {
    const device = devices.find((d) => d.id === entry.deviceId)
    if (!device) {
      console.error('Device not found for history entry')
      return
    }
    setActiveTab('request')
    await handleSendRequest({
      deviceId: entry.deviceId,
      method: entry.method,
      path: entry.path,
      headers: Object.keys(entry.headers).length > 0 ? entry.headers : undefined,
      body: entry.body,
      query: entry.query
    })
  }

  const handleExportConfig = async () => {
    const result = await window.api.exportConfig()
    if (!result?.ok) {
      setImportError(null)
    }
  }

  const handleImportConfig = async () => {
    setImportError(null)
    const result = await window.api.importConfig()
    if (result?.ok) {
      await loadState()
    } else if (result?.error) {
      setImportError(result.error)
    }
  }

  const handleSaveMacro = async (input: MacroInput) => {
    await window.api.saveMacro(input)
    await loadState()
  }

  const handleRemoveMacro = async (macroId: string) => {
    await window.api.removeMacro(macroId)
    setSelectedMacroId(null)
    await loadState()
  }

  const handleCreateFolder = async (name: string) => {
    await window.api.createFolder(name)
    await loadState()
  }

  const handleUpdateFolder = async (id: string, name: string) => {
    await window.api.updateFolder(id, name)
    await loadState()
  }

  const handleRemoveFolder = async (id: string) => {
    await window.api.removeFolder(id)
    await loadState()
  }

  const handleRunMacro = async (macroId: string) => {
    setMacroError(null)
    try {
      const result = await window.api.runMacro(macroId)
      setMacroRun(result)
      await loadState()
    } catch (error) {
      setMacroError(error instanceof Error ? error.message : 'Грешка при изпълнение')
    }
  }

  const selectedHistory = useMemo(
    () => history.find((entry) => entry.id === historySelection) ?? null,
    [history, historySelection]
  )

  if (!window.api) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="rounded border border-rose-200 bg-rose-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-700">Грешка при зареждане</h1>
          <p className="mt-2 text-sm text-rose-600">
            window.api не е наличен. Проверете дали preload скриптът е зареден правилно.
          </p>
          <p className="mt-1 text-xs text-slate-500">Моля, рестартирайте приложението.</p>
        </div>
      </div>
    )
  }

  const loc = settings.locale

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="flex w-80 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h1 className="text-lg font-semibold">{t(loc, 'app.title')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t(loc, 'app.subtitle')}</p>
          </div>
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setSelectedDeviceId(null)}
          >
            {t(loc, 'nav.new')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{t(loc, 'settings.theme')}</span>
            <select
              className="rounded border border-slate-200 px-1 py-0.5 text-[11px] dark:border-slate-600 dark:bg-slate-800"
              value={settings.theme}
              onChange={(e) =>
                void persistAppSettings({
                  ...settings,
                  theme: e.target.value as AppSettings['theme']
                })
              }
            >
              <option value="light">{t(loc, 'settings.theme.light')}</option>
              <option value="dark">{t(loc, 'settings.theme.dark')}</option>
            </select>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{t(loc, 'settings.locale')}</span>
            <select
              className="rounded border border-slate-200 px-1 py-0.5 text-[11px] dark:border-slate-600 dark:bg-slate-800"
              value={settings.locale}
              onChange={(e) =>
                void persistAppSettings({
                  ...settings,
                  locale: e.target.value as AppSettings['locale']
                })
              }
            >
              <option value="bg">БГ</option>
              <option value="en">EN</option>
            </select>
          </div>
          <div className="mt-2">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{t(loc, 'settings.globals')}</label>
            <p className="text-[10px] text-slate-500 dark:text-slate-500">{t(loc, 'settings.globalsHelp')}</p>
            <textarea
              className="mt-1 min-h-[56px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[10px] dark:border-slate-600 dark:bg-slate-800"
              value={globalsText}
              onChange={(e) => setGlobalsText(e.target.value)}
              placeholder={'token=secret\nbaseUrl=v1'}
            />
            <button
              type="button"
              className="mt-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] text-white hover:bg-emerald-700"
              onClick={() =>
                void persistAppSettings({
                  ...settings,
                  globalVariables: parseGlobalsText(globalsText)
                })
              }
            >
              {t(loc, 'settings.saveGlobals')}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(loc, 'nav.devices')}</h2>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={handleExportConfig}
              >
                {t(loc, 'nav.export')}
              </button>
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={handleImportConfig}
              >
                {t(loc, 'nav.import')}
              </button>
            </div>
          </div>
          {startupLoadError && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {startupLoadError}
            </div>
          )}
          {importError && (
            <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-600 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {importError}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {devices.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{t(loc, 'devices.empty')}</p>
            ) : (
              devices.map((device) => {
                const status = device.status?.state ?? 'unknown'
                const statusColor =
                  status === 'online'
                    ? 'bg-emerald-500'
                    : status === 'offline'
                      ? 'bg-rose-500'
                      : 'bg-slate-400'
                return (
                  <button
                    type="button"
                    key={device.id}
                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
                      device.id === selectedDeviceId
                        ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => setSelectedDeviceId(device.id)}
                  >
                    <span>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-xs text-slate-500">
                        {device.protocol}://{device.ip}:{device.port}
                      </div>
                    </span>
                    <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(loc, 'nav.details')}</h2>
          <DeviceForm
            device={selectedDevice}
            locale={loc}
            onSave={handleSaveDevice}
            onRemove={handleRemoveDevice}
          />
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-900">
          <TabButton
            label={t(loc, 'tab.request')}
            active={activeTab === 'request'}
            onClick={() => setActiveTab('request')}
          />
          <TabButton
            label={t(loc, 'tab.history')}
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
          <TabButton label={t(loc, 'tab.macros')} active={activeTab === 'macros'} onClick={() => setActiveTab('macros')} />
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          {activeTab === 'request' && (
            <RequestPanel
              device={selectedDevice}
              locale={loc}
              sending={sending}
              sendError={requestSendError}
              response={lastResponse}
              seedFromHistory={historyToRequestSeed}
              onSeedConsumed={() => setHistoryToRequestSeed(null)}
              onSend={handleSendRequest}
            />
          )}

          {activeTab === 'history' && (
            <HistoryPanel
              locale={loc}
              history={history}
              selectedId={historySelection}
              onSelect={setHistorySelection}
              onClear={handleClearHistory}
              onReplay={handleReplayRequest}
              onDuplicateToRequest={handleDuplicateFromHistory}
              selectedEntry={selectedHistory}
              devices={devices}
            />
          )}

          {activeTab === 'macros' && (
            <MacroPanel
              locale={loc}
              devices={devices}
              folders={folders}
              macro={selectedMacro}
              macros={macros}
              runResult={macroRun}
              error={macroError}
              onSelect={setSelectedMacroId}
              onSave={handleSaveMacro}
              onRemove={handleRemoveMacro}
              onRun={handleRunMacro}
              onCreateFolder={handleCreateFolder}
              onUpdateFolder={handleUpdateFolder}
              onRemoveFolder={handleRemoveFolder}
            />
          )}
        </section>
      </main>
    </div>
  )
}

const TabButton = ({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded px-3 py-1 text-sm font-medium ${
      active
        ? 'bg-emerald-500 text-white'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`}
  >
    {label}
  </button>
)

const DeviceForm = ({
  device,
  locale,
  onSave,
  onRemove
}: {
  device: Device | null
  locale: AppSettings['locale']
  onSave: (input: DeviceInput) => void
  onRemove: (deviceId: string) => void
}) => {
  const [form, setForm] = useState<DeviceFormState>(() => deviceToForm(device))

  useEffect(() => {
    setForm(deviceToForm(device))
  }, [device?.id])

  const updateForm = (patch: Partial<DeviceFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSave(formToDeviceInput(form))
  }

  const status = device?.status?.state ?? 'unknown'
  const lastCheck = device?.status?.lastCheckedAt

  return (
    <form className="mt-3 space-y-3 text-xs" onSubmit={handleSubmit}>
      <div>
        <label className="text-[11px] font-semibold text-slate-500">Име</label>
        <input
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
          value={form.name}
          onChange={(event) => updateForm({ name: event.target.value })}
          placeholder="Device A"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="text-[11px] font-semibold text-slate-500">IP адрес</label>
          <input
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
            value={form.ip}
            onChange={(event) => updateForm({ ip: event.target.value })}
            placeholder="192.168.0.10"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Порт</label>
          <input
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
            value={form.port}
            onChange={(event) => updateForm({ port: event.target.value })}
            placeholder="80"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Протокол</label>
          <select
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
            value={form.protocol}
            onChange={(event) => updateForm({ protocol: event.target.value as 'http' | 'https' })}
          >
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Base path</label>
          <input
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
            value={form.basePath}
            onChange={(event) => updateForm({ basePath: event.target.value })}
            placeholder="/api"
          />
        </div>
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 p-2">
        <div className="text-[11px] font-semibold text-slate-500">Автентикация</div>
        <select
          className="mt-1 w-full rounded border border-slate-200 px-2 py-1"
          value={form.authType}
          onChange={(event) => updateForm({ authType: event.target.value as AuthType })}
        >
          {authTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {form.authType === 'basic' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-200 px-2 py-1"
              value={form.username}
              onChange={(event) => updateForm({ username: event.target.value })}
              placeholder="Username"
            />
            <input
              className="rounded border border-slate-200 px-2 py-1"
              type="password"
              value={form.password}
              onChange={(event) => updateForm({ password: event.target.value })}
              placeholder="Password"
            />
          </div>
        )}

        {form.authType === 'bearer' && (
          <input
            className="mt-2 w-full rounded border border-slate-200 px-2 py-1"
            value={form.token}
            onChange={(event) => updateForm({ token: event.target.value })}
            placeholder="Bearer token"
          />
        )}

        {form.authType === 'apiKey' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-200 px-2 py-1"
              value={form.apiKeyHeader}
              onChange={(event) => updateForm({ apiKeyHeader: event.target.value })}
              placeholder="Header name"
            />
            <input
              className="rounded border border-slate-200 px-2 py-1"
              value={form.apiKeyValue}
              onChange={(event) => updateForm({ apiKeyValue: event.target.value })}
              placeholder="API key"
            />
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 bg-slate-50 p-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-slate-500">Health check</div>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={form.healthEnabled}
              onChange={(event) => updateForm({ healthEnabled: event.target.checked })}
            />
            Активен
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className="rounded border border-slate-200 px-2 py-1"
            value={form.healthPath}
            onChange={(event) => updateForm({ healthPath: event.target.value })}
            placeholder="/health"
          />
          <input
            className="rounded border border-slate-200 px-2 py-1"
            value={form.healthInterval}
            onChange={(event) => updateForm({ healthInterval: event.target.value })}
            placeholder="Interval (sec)"
          />
          <input
            className="col-span-2 rounded border border-slate-200 px-2 py-1"
            value={form.healthTimeout}
            onChange={(event) => updateForm({ healthTimeout: event.target.value })}
            placeholder="Timeout (ms)"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>Статус: {status}</span>
        {lastCheck && <span>{new Date(lastCheck).toLocaleTimeString()}</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          {t(locale, 'device.save')}
        </button>
        {device && (
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => onRemove(device.id)}
          >
            {t(locale, 'device.delete')}
          </button>
        )}
      </div>
    </form>
  )
}

type QueryRow = { id: string; key: string; value: string }

const RequestPanel = ({
  device,
  locale,
  response,
  onSend,
  sending,
  sendError,
  seedFromHistory,
  onSeedConsumed
}: {
  device: Device | null
  locale: AppSettings['locale']
  response: ResponseData | null
  onSend: (request: RequestOptions) => void
  sending: boolean
  sendError: string | null
  seedFromHistory: HistoryEntry | null
  onSeedConsumed: () => void
}) => {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [path, setPath] = useState('')
  const [headersText, setHeadersText] = useState('{}')
  const [body, setBody] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('')
  const [queryRows, setQueryRows] = useState<QueryRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!seedFromHistory) return
    setMethod(seedFromHistory.method)
    setPath(seedFromHistory.path)
    setHeadersText(
      Object.keys(seedFromHistory.headers).length > 0
        ? JSON.stringify(seedFromHistory.headers, null, 2)
        : '{}'
    )
    setBody(seedFromHistory.body ?? '')
    const q = seedFromHistory.query
    if (q && Object.keys(q).length > 0) {
      setQueryRows(
        Object.entries(q).map(([key, value]) => ({
          id: crypto.randomUUID(),
          key,
          value: String(value)
        }))
      )
    } else {
      setQueryRows([])
    }
    onSeedConsumed()
  }, [seedFromHistory, onSeedConsumed])

  const addQueryRow = () => {
    setQueryRows((r) => [...r, { id: crypto.randomUUID(), key: '', value: '' }])
  }

  const updateQueryRow = (id: string, patch: Partial<QueryRow>) => {
    setQueryRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeQueryRow = (id: string) => {
    setQueryRows((rows) => rows.filter((row) => row.id !== id))
  }

  const handleSend = () => {
    if (!device) {
      return
    }

    let headers: Record<string, string> | undefined
    if (headersText.trim()) {
      try {
        const parsed = JSON.parse(headersText)
        if (parsed && typeof parsed === 'object') {
          headers = parsed
        } else {
          throw new Error('Headers should be object')
        }
      } catch {
        setError(locale === 'en' ? 'Invalid JSON for headers' : 'Невалиден JSON за headers')
        return
      }
    }

    const query: Record<string, string> = {}
    for (const row of queryRows) {
      const k = row.key.trim()
      if (k) query[k] = row.value
    }

    setError(null)
    const timeoutValue = Number(timeoutMs)
    void onSend({
      deviceId: device.id,
      method,
      path,
      query: Object.keys(query).length > 0 ? query : undefined,
      headers,
      body: body || undefined,
      timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : undefined
    })
  }

  const baseUrl = device
    ? `${device.protocol}://${device.ip}:${device.port}${device.basePath ?? ''}`
    : '—'

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr] gap-6">
      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'request.title')}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t(locale, 'request.baseUrl')}: {baseUrl}
        </p>

        {!device && (
          <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
            {t(locale, 'request.pickDevice')}
          </div>
        )}

        {device && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <select
                className="rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                value={method}
                onChange={(event) => setMethod(event.target.value as HttpMethod)}
              >
                {httpMethods.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/status"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t(locale, 'request.query')}
                </label>
                <button
                  type="button"
                  className="text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
                  onClick={addQueryRow}
                >
                  {t(locale, 'request.addQuery')}
                </button>
              </div>
              <div className="mt-1 space-y-1">
                {queryRows.length === 0 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">—</p>
                )}
                {queryRows.map((row) => (
                  <div key={row.id} className="flex gap-1">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                      placeholder={t(locale, 'request.queryKey')}
                      value={row.key}
                      onChange={(e) => updateQueryRow(row.id, { key: e.target.value })}
                    />
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                      placeholder={t(locale, 'request.queryValue')}
                      value={row.value}
                      onChange={(e) => updateQueryRow(row.id, { value: e.target.value })}
                    />
                    <button
                      type="button"
                      className="shrink-0 px-1 text-rose-500"
                      onClick={() => removeQueryRow(row.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t(locale, 'request.headers')}</label>
              <textarea
                className="mt-1 min-h-[100px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                value={headersText}
                onChange={(event) => setHeadersText(event.target.value)}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t(locale, 'request.body')}</label>
              <textarea
                className="mt-1 min-h-[120px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                className="w-40 rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder={t(locale, 'request.timeout')}
              />
              <button
                type="button"
                className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? t(locale, 'request.sending') : t(locale, 'request.send')}
              </button>
            </div>

            {error && <div className="text-xs text-rose-500">{error}</div>}
            {sendError && <div className="text-xs text-rose-500">{sendError}</div>}
          </div>
        )}
      </div>

      <ResponsePanel locale={locale} response={response} />
    </div>
  )
}

const PlainPre = ({ code }: { code: string }) => (
  <pre className="mt-1 max-h-52 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
    {code || '—'}
  </pre>
)

const SyntaxBlock = ({
  code,
  language
}: {
  code: string
  language: 'json' | 'markup' | 'plain'
}) => {
  if (language === 'plain' || !code.trim()) {
    return <PlainPre code={code} />
  }
  return (
    <Suspense fallback={<PlainPre code={code} />}>
      <LazyPrismHighlight code={code} language={language} />
    </Suspense>
  )
}

const LazyPrismHighlight = ({ code, language }: { code: string; language: 'json' | 'markup' }) => {
  const [Component, setComponent] = useState<React.ComponentType<{ code: string; language: string }> | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      import('prismjs/components/prism-json'),
      import('prismjs/components/prism-markup'),
      import('prism-react-renderer')
    ])
      .then(([, , { Highlight, themes }]) => {
        if (cancelled) return
        setComponent(() => (props: { code: string; language: string }) => (
          <Highlight theme={themes.oneLight} code={props.code} language={props.language}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={`mt-1 max-h-52 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] ${className}`}
                style={style}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        ))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  if (error || !Component) return <PlainPre code={code} />
  return <Component code={code} language={language} />
}

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may fail in some contexts */
    }
  }
  return (
    <button
      type="button"
      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
      onClick={handleCopy}
      title={label}
    >
      {copied ? 'Копирано!' : 'Копирай'}
    </button>
  )
}

const ResponsePanel = ({
  locale,
  response
}: {
  locale: AppSettings['locale']
  response: ResponseData | null
}) => {
  const parsedText =
    response?.parsedBody !== undefined ? JSON.stringify(response.parsedBody, null, 2) : ''
  const rawText = response?.body ?? '—'

  return (
    <div className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'response.title')}</h2>
      {!response && (
        <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {t(locale, 'response.none')}
        </div>
      )}
      {response && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>Статус: {response.status || response.statusText}</span>
            <span>Време: {response.durationMs} ms</span>
            {response.parsedType && <span>Тип: {response.parsedType}</span>}
            {response.error && <span className="text-rose-500">{response.error}</span>}
          </div>

          {parsedText && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Parsed</span>
                <CopyButton text={parsedText} label="Копирай parsed отговор" />
              </div>
              <SyntaxBlock code={parsedText} language="json" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Raw</span>
              <CopyButton text={rawText} label="Копирай raw отговор" />
            </div>
            <SyntaxBlock
              code={rawText}
              language={
                response.parsedType === 'json'
                  ? 'json'
                  : response.parsedType === 'xml'
                    ? 'markup'
                    : 'plain'
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}

const HistoryPanel = ({
  locale,
  history,
  selectedId,
  onSelect,
  onClear,
  onReplay,
  onDuplicateToRequest,
  selectedEntry,
  devices
}: {
  locale: AppSettings['locale']
  history: HistoryEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onClear: () => void
  onReplay: (entry: HistoryEntry) => void
  onDuplicateToRequest: (entry: HistoryEntry) => void
  selectedEntry: HistoryEntry | null
  devices: Device[]
}) => {
  const [filterMethod, setFilterMethod] = useState<string>('')
  const [filterPath, setFilterPath] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      if (filterMethod && entry.method.toLowerCase() !== filterMethod.toLowerCase()) return false
      if (filterPath && !entry.path.toLowerCase().includes(filterPath.toLowerCase())) return false
      if (filterStatus) {
        const status = String(entry.response?.status ?? '')
        if (!status.includes(filterStatus)) return false
      }
      return true
    })
  }, [history, filterMethod, filterPath, filterStatus])

  return (
  <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.1fr] gap-6">
    <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'history.title')}</h2>
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={onClear}
        >
          {t(locale, 'history.clear')}
        </button>
      </div>

      <div className="mt-2 shrink-0 space-y-2">
        <div className="grid grid-cols-3 gap-1">
          <input
            className="rounded border border-slate-200 px-2 py-1 text-[11px]"
            placeholder="Method"
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            title="GET, POST, ..."
          />
          <input
            className="rounded border border-slate-200 px-2 py-1 text-[11px]"
            placeholder="Path"
            value={filterPath}
            onChange={(e) => setFilterPath(e.target.value)}
          />
          <input
            className="rounded border border-slate-200 px-2 py-1 text-[11px]"
            placeholder="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            title="200, 404, ..."
          />
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {filteredHistory.length === 0 && (
          <div className="text-xs text-slate-500">
            {history.length === 0 ? 'Историята е празна.' : 'Няма резултати за филтъра.'}
          </div>
        )}
        {filteredHistory.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={`w-full rounded border px-3 py-2 text-left text-xs ${
              selectedId === entry.id
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => onSelect(entry.id)}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{new Date(entry.timestamp).toLocaleString()}</span>
              <span>{entry.response?.status ?? 'ERR'}</span>
            </div>
            <div className="mt-1 font-medium">
              {entry.method} {entry.path}
            </div>
            <div className="text-[11px] text-slate-500">{entry.url}</div>
          </button>
        ))}
      </div>
    </div>

    <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'history.details')}</h2>
        {selectedEntry && (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => onDuplicateToRequest(selectedEntry)}
            >
              {t(locale, 'request.duplicate')}
            </button>
            {devices.some((d) => d.id === selectedEntry.deviceId) && (
              <button
                type="button"
                className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
                onClick={() => onReplay(selectedEntry)}
              >
                {t(locale, 'history.replay')}
              </button>
            )}
          </div>
        )}
      </div>
      {!selectedEntry && (
        <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {t(locale, 'history.pick')}
        </div>
      )}
      {selectedEntry && (
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">URL</div>
            <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
              {selectedEntry.url}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500">Headers</div>
            <pre className="mt-1 max-h-36 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
              {JSON.stringify(selectedEntry.headers, null, 2)}
            </pre>
          </div>
          {selectedEntry.body && (
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Body</div>
              <pre className="mt-1 max-h-36 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
                {selectedEntry.body}
              </pre>
            </div>
          )}
          <ResponsePanel locale={locale} response={selectedEntry.response ?? null} />
        </div>
      )}
    </div>
  </div>
  )
}

const MacroPanel = ({
  locale,
  devices,
  folders,
  macro,
  macros,
  runResult,
  error,
  onSelect,
  onSave,
  onRemove,
  onRun,
  onCreateFolder,
  onUpdateFolder,
  onRemoveFolder
}: {
  locale: AppSettings['locale']
  devices: Device[]
  folders: MacroFolder[]
  macro: Macro | null
  macros: Macro[]
  runResult: MacroRunResult | null
  error: string | null
  onSelect: (id: string | null) => void
  onSave: (input: MacroInput) => void
  onRemove: (id: string) => void
  onRun: (id: string) => void
  onCreateFolder: (name: string) => void
  onUpdateFolder: (id: string, name: string) => void
  onRemoveFolder: (id: string) => void
}) => {
  const [form, setForm] = useState<MacroFormState>(() =>
    macroToForm(macro, devices[0]?.id ?? '')
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [renamingMacroId, setRenamingMacroId] = useState<string | null>(null)
  const [renameMacroDraft, setRenameMacroDraft] = useState('')

  useEffect(() => {
    setForm(macroToForm(macro, devices[0]?.id ?? ''))
  }, [macro?.id, devices])

  const handleCreateFolder = () => {
    const name = newFolderName.trim()
    if (name) {
      onCreateFolder(name)
      setNewFolderName('')
      setShowFolderForm(false)
    }
  }

  const uncategorized = macros.filter((m) => !m.folderId)
  const macrosByFolder = folders.map((f) => ({ folder: f, macros: macros.filter((m) => m.folderId === f.id) }))

  const updateForm = (patch: Partial<MacroFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const updateStep = (stepId: string, patch: Partial<MacroStepForm>) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step))
    }))
  }

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: crypto.randomUUID(),
          name: `Стъпка ${prev.steps.length + 1}`,
          method: 'GET',
          path: '',
          headersText: '{}',
          body: '',
          delayMs: ''
        }
      ]
    }))
  }

  const removeStep = (stepId: string) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId)
    }))
  }

  const moveStep = (fromIndex: number, toIndex: number) => {
    setForm((prev) => {
      const steps = [...prev.steps]
      if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex >= steps.length) {
        return prev
      }
      const [removed] = steps.splice(fromIndex, 1)
      steps.splice(toIndex, 0, removed)
      return { ...prev, steps }
    })
  }

  const commitMacroRename = (macroId: string) => {
    const m = macros.find((x) => x.id === macroId)
    const name = renameMacroDraft.trim()
    if (!m || !name) {
      setRenamingMacroId(null)
      return
    }
    onSave({
      id: m.id,
      name,
      deviceId: m.deviceId,
      folderId: m.folderId,
      steps: m.steps
    })
    setRenamingMacroId(null)
  }

  const handleSave = () => {
    try {
      const { input } = formToMacroInput(form)
      if (!input) {
        setFormError('Невалиден макрос')
        return
      }
      setFormError(null)
      onSave(input)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Грешка при запис')
    }
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-6">
      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'macros.title')}</h2>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => onSelect(null)}
            >
              {t(locale, 'macros.new')}
            </button>
            <button
              type="button"
              className="rounded border border-emerald-500 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
              onClick={() => setShowFolderForm((v) => !v)}
            >
              {t(locale, 'macros.makeFolder')}
            </button>
          </div>
        </div>
        {showFolderForm && (
          <div className="mt-3 flex gap-2 rounded border border-slate-200 bg-slate-50 p-2">
            <input
              className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Име на папка"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') setShowFolderForm(false)
              }}
            />
            <button
              className="shrink-0 rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
              onClick={handleCreateFolder}
            >
              Създай
            </button>
            <button
              className="shrink-0 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              onClick={() => setShowFolderForm(false)}
            >
              Отказ
            </button>
          </div>
        )}
        <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto">
          {macros.length === 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">{t(locale, 'macros.empty')}</div>
          )}
          {uncategorized.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Без папка</div>
              <div className="space-y-2">
                {uncategorized.map((item) => (
                  <div key={item.id} className="flex gap-1">
                    {renamingMacroId === item.id ? (
                      <div className="flex min-w-0 flex-1 gap-1">
                        <input
                          className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] dark:border-slate-600 dark:bg-slate-800"
                          value={renameMacroDraft}
                          onChange={(e) => setRenameMacroDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitMacroRename(item.id)
                            if (e.key === 'Escape') setRenamingMacroId(null)
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white"
                          onClick={() => commitMacroRename(item.id)}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`min-w-0 flex-1 rounded border px-2 py-2 text-left text-xs ${
                            item.id === macro?.id
                              ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
                          }`}
                          onClick={() => onSelect(item.id)}
                        >
                          <div className="font-medium">{item.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t(locale, 'macros.steps')}: {item.steps.length}
                          </div>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                          title={t(locale, 'macros.rename')}
                          onClick={() => {
                            setRenamingMacroId(item.id)
                            setRenameMacroDraft(item.name)
                          }}
                        >
                          ✎
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {macrosByFolder.map(({ folder, macros: folderMacros }) => (
              <div key={folder.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  {editingFolderId === folder.id ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <input
                        className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingFolderName.trim()) {
                              onUpdateFolder(folder.id, editingFolderName.trim())
                              setEditingFolderId(null)
                            }
                          }
                          if (e.key === 'Escape') setEditingFolderId(null)
                        }}
                        autoFocus
                      />
                      <button
                        className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white hover:bg-emerald-600"
                        onClick={() => {
                          if (editingFolderName.trim()) {
                            onUpdateFolder(folder.id, editingFolderName.trim())
                            setEditingFolderId(null)
                          }
                        }}
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate text-[11px] font-medium text-slate-500">{folder.name}</span>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          className="rounded px-1 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          onClick={() => {
                            setEditingFolderId(folder.id)
                            setEditingFolderName(folder.name)
                          }}
                          title="Преименувай"
                        >
                          ✎
                        </button>
                        <button
                          className="rounded px-1 text-[10px] text-rose-400 hover:bg-rose-50"
                          onClick={() => onRemoveFolder(folder.id)}
                          title="Изтрий папка"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  {folderMacros.map((item) => (
                    <div key={item.id} className="flex gap-1">
                      {renamingMacroId === item.id ? (
                        <div className="flex min-w-0 flex-1 gap-1">
                          <input
                            className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] dark:border-slate-600 dark:bg-slate-800"
                            value={renameMacroDraft}
                            onChange={(e) => setRenameMacroDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitMacroRename(item.id)
                              if (e.key === 'Escape') setRenamingMacroId(null)
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white"
                            onClick={() => commitMacroRename(item.id)}
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`min-w-0 flex-1 rounded border px-2 py-2 text-left text-xs ${
                              item.id === macro?.id
                                ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
                            }`}
                            onClick={() => onSelect(item.id)}
                          >
                            <div className="font-medium">{item.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {t(locale, 'macros.steps')}: {item.steps.length}
                            </div>
                          </button>
                          <button
                            type="button"
                            className="shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                            title={t(locale, 'macros.rename')}
                            onClick={() => {
                              setRenamingMacroId(item.id)
                              setRenameMacroDraft(item.name)
                            }}
                          >
                            ✎
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4">
        <div className="shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Конфигурация</h2>
          {macro && (
            <button
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              onClick={() => onRemove(macro.id)}
            >
              Изтрий
            </button>
          )}
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-200 px-2 py-1"
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Име на макрос"
            />
            <select
              className="rounded border border-slate-200 px-2 py-1"
              value={form.deviceId}
              onChange={(event) => updateForm({ deviceId: event.target.value })}
            >
              <option value="">Избери устройство</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
            <select
              className="col-span-2 rounded border border-slate-200 px-2 py-1"
              value={form.folderId}
              onChange={(event) => updateForm({ folderId: event.target.value })}
            >
              <option value="">Без папка</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;token&#125;&#125;</code>,{' '}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;baseUrl&#125;&#125;</code> — от
            глобалните променливи;{' '}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;step1&#125;&#125;</code>,{' '}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">&#123;&#123;step2.field&#125;&#125;</code> — от
            предишни стъпки
          </div>
          <div className="space-y-3">
            {form.steps.map((step, index) => (
              <div
                key={step.id}
                className="rounded border border-slate-200 p-3 dark:border-slate-600"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(index))
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
                  if (!Number.isFinite(from)) return
                  moveStep(from, index)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="cursor-grab select-none text-[11px] text-slate-400 active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    ⋮⋮
                  </span>
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                    value={step.name}
                    onChange={(event) => updateStep(step.id, { name: event.target.value })}
                    placeholder={`Стъпка ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="ml-2 shrink-0 text-xs text-rose-500"
                    onClick={() => removeStep(step.id)}
                  >
                    X
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
                  <select
                    className="rounded border border-slate-200 px-2 py-1"
                    value={step.method}
                    onChange={(event) => updateStep(step.id, { method: event.target.value as HttpMethod })}
                  >
                    {httpMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded border border-slate-200 px-2 py-1"
                    value={step.path}
                    onChange={(event) => updateStep(step.id, { path: event.target.value })}
                    placeholder="/configure или {{step1.id}}"
                    title="Променливи: {{step1}}, {{step2.field}}"
                  />
                </div>
                <textarea
                  className="mt-2 min-h-[60px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px]"
                  value={step.headersText}
                  onChange={(event) => updateStep(step.id, { headersText: event.target.value })}
                  placeholder='{"Authorization": "Bearer {{step1.token}}"}'
                  title="Стойностите могат да използват {{step1.field}}"
                />
                <textarea
                  className="mt-2 min-h-[80px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px]"
                  value={step.body}
                  onChange={(event) => updateStep(step.id, { body: event.target.value })}
                  placeholder='{"id": "{{step1.id}}" или празно'
                  title="Променливи: {{step1}}, {{step2.field}}"
                />
                <input
                  className="mt-2 w-full rounded border border-slate-200 px-2 py-1"
                  value={step.delayMs}
                  onChange={(event) => updateStep(step.id, { delayMs: event.target.value })}
                  placeholder="Delay (ms)"
                />
              </div>
            ))}
          </div>

          <button
            className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={addStep}
          >
            Добави стъпка
          </button>

          {formError && <div className="text-xs text-rose-500">{formError}</div>}

          <div className="flex items-center gap-2">
            <button
              className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
              onClick={handleSave}
            >
              Запази
            </button>
            {macro && (
              <button
                className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => onRun(macro.id)}
              >
                Изпълни
              </button>
            )}
          </div>

          {error && <div className="text-xs text-rose-500">{error}</div>}

          {runResult && (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="font-semibold text-slate-600">
                Резултат ({runResult.results.length} стъпки,{' '}
                {runResult.finishedAt - runResult.startedAt} ms)
              </div>
              <div className="mt-2 space-y-3">
                {runResult.results.map((result, idx) => {
                  const isError = !!result.error || (result.response?.status ?? 0) >= 400
                  return (
                    <div
                      key={result.stepId}
                      className={`rounded border p-3 ${
                        isError ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">
                          {result.stepName || `Стъпка ${idx + 1}`}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            isError ? 'bg-rose-200 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {result.response != null
                            ? `${result.response.status} ${result.response.statusText}`
                            : 'ERR'}
                        </span>
                      </div>
                      {result.response?.durationMs != null && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          Време: {result.response.durationMs} ms
                        </div>
                      )}
                      {result.error && (
                        <div className="mt-2 rounded border border-rose-200 bg-white p-2 text-[11px] text-rose-700">
                          <strong>Грешка:</strong> {result.error}
                        </div>
                      )}
                      {result.response?.error && (
                        <div className="mt-2 rounded border border-rose-200 bg-white p-2 text-[11px] text-rose-700">
                          <strong>Съобщение:</strong> {result.response.error}
                        </div>
                      )}
                      {result.response?.body && result.response.body.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-700">
                            Body ({result.response.body.length} символа)
                          </summary>
                          <pre className="mt-1 max-h-32 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px]">
                            {result.response.body.length > 500
                              ? result.response.body.slice(0, 500) + '...'
                              : result.response.body}
                          </pre>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
