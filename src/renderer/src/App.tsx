import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
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

const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE']
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
      body: entry.body
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

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-80 flex-col overflow-hidden border-r border-slate-200 bg-white">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">REST API Устройства</h1>
            <p className="text-xs text-slate-500">Desktop REST Client</p>
          </div>
          <button
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() => setSelectedDeviceId(null)}
          >
            Ново
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Устройства</h2>
            <div className="flex gap-1">
              <button
                className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                onClick={handleExportConfig}
              >
                Export
              </button>
              <button
                className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                onClick={handleImportConfig}
              >
                Import
              </button>
            </div>
          </div>
          {startupLoadError && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              {startupLoadError}
            </div>
          )}
          {importError && (
            <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-600">
              {importError}
            </div>
          )}
          <div className="mt-2 space-y-2">
            {devices.length === 0 ? (
              <p className="text-xs text-slate-500">Няма добавени устройства.</p>
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
                    key={device.id}
                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm ${
                      device.id === selectedDeviceId
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 hover:bg-slate-50'
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

        <div className="border-t border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Детайли</h2>
          <DeviceForm
            device={selectedDevice}
            onSave={handleSaveDevice}
            onRemove={handleRemoveDevice}
          />
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <TabButton label="Заявки" active={activeTab === 'request'} onClick={() => setActiveTab('request')} />
          <TabButton
            label="История"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
          <TabButton label="Макроси" active={activeTab === 'macros'} onClick={() => setActiveTab('macros')} />
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          {activeTab === 'request' && (
            <RequestPanel
              device={selectedDevice}
              sending={sending}
              sendError={requestSendError}
              response={lastResponse}
              onSend={handleSendRequest}
            />
          )}

          {activeTab === 'history' && (
            <HistoryPanel
              history={history}
              selectedId={historySelection}
              onSelect={setHistorySelection}
              onClear={handleClearHistory}
              onReplay={handleReplayRequest}
              selectedEntry={selectedHistory}
              devices={devices}
            />
          )}

          {activeTab === 'macros' && (
            <MacroPanel
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
    onClick={onClick}
    className={`rounded px-3 py-1 text-sm font-medium ${
      active ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    {label}
  </button>
)

const DeviceForm = ({
  device,
  onSave,
  onRemove
}: {
  device: Device | null
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
          Запази
        </button>
        {device && (
          <button
            type="button"
            className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={() => onRemove(device.id)}
          >
            Изтрий
          </button>
        )}
      </div>
    </form>
  )
}

const RequestPanel = ({
  device,
  response,
  onSend,
  sending,
  sendError
}: {
  device: Device | null
  response: ResponseData | null
  onSend: (request: RequestOptions) => void
  sending: boolean
  sendError: string | null
}) => {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [path, setPath] = useState('')
  const [headersText, setHeadersText] = useState('{}')
  const [body, setBody] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('')
  const [error, setError] = useState<string | null>(null)

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
        setError('Невалиден JSON за headers')
        return
      }
    }

    setError(null)
    const timeoutValue = Number(timeoutMs)
    void onSend({
      deviceId: device.id,
      method,
      path,
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
      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4">
        <h2 className="shrink-0 text-sm font-semibold text-slate-700">HTTP заявка</h2>
        <p className="mt-1 text-xs text-slate-500">Base URL: {baseUrl}</p>

        {!device && (
          <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500">
            Избери устройство за изпращане на заявки.
          </div>
        )}

        {device && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <select
                className="rounded border border-slate-200 px-2 py-1"
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
                className="rounded border border-slate-200 px-2 py-1"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/status"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500">Headers (JSON)</label>
              <textarea
                className="mt-1 min-h-[100px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px]"
                value={headersText}
                onChange={(event) => setHeadersText(event.target.value)}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500">Body</label>
              <textarea
                className="mt-1 min-h-[120px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px]"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                className="w-40 rounded border border-slate-200 px-2 py-1"
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder="Timeout (ms)"
              />
              <button
                className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? 'Изпращане...' : 'Изпрати'}
              </button>
            </div>

            {error && <div className="text-xs text-rose-500">{error}</div>}
            {sendError && <div className="text-xs text-rose-500">{sendError}</div>}
          </div>
        )}
      </div>

      <ResponsePanel response={response} />
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

const ResponsePanel = ({ response }: { response: ResponseData | null }) => {
  const parsedText =
    response?.parsedBody !== undefined ? JSON.stringify(response.parsedBody, null, 2) : ''
  const rawText = response?.body ?? '—'

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Отговор</h2>
      {!response && (
        <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500">
          Няма получен отговор.
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
  history,
  selectedId,
  onSelect,
  onClear,
  onReplay,
  selectedEntry,
  devices
}: {
  history: HistoryEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onClear: () => void
  onReplay: (entry: HistoryEntry) => void
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
    <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4">
      <div className="shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">История</h2>
        <button
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          onClick={onClear}
        >
          Изчисти
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

    <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4">
      <div className="shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Детайли</h2>
        {selectedEntry && devices.some((d) => d.id === selectedEntry.deviceId) && (
          <button
            className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
            onClick={() => onReplay(selectedEntry)}
          >
            Изпрати отново
          </button>
        )}
      </div>
      {!selectedEntry && (
        <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500">
          Избери заявка от историята.
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
          <ResponsePanel response={selectedEntry.response ?? null} />
        </div>
      )}
    </div>
  </div>
  )
}

const MacroPanel = ({
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
      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Макроси</h2>
          <div className="flex gap-1">
            <button
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              onClick={() => onSelect(null)}
            >
              Нов
            </button>
            <button
              className="rounded border border-emerald-500 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              onClick={() => setShowFolderForm((v) => !v)}
            >
              Make a folder
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
            <div className="text-xs text-slate-500">Няма макроси.</div>
          )}
          {uncategorized.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-slate-500">Без папка</div>
              <div className="space-y-2">
                {uncategorized.map((item) => (
                  <button
                    key={item.id}
                    className={`block w-full rounded border px-3 py-2 text-left text-xs ${
                      item.id === macro?.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => onSelect(item.id)}
                  >
                    <div className="font-medium">{item.name}</div>
                    <div className="text-[11px] text-slate-500">Стъпки: {item.steps.length}</div>
                  </button>
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
                    <button
                      key={item.id}
                      className={`block w-full rounded border px-3 py-2 text-left text-xs ${
                        item.id === macro?.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => onSelect(item.id)}
                    >
                      <div className="font-medium">{item.name}</div>
                      <div className="text-[11px] text-slate-500">Стъпки: {item.steps.length}</div>
                    </button>
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

          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
            Променливи: <code className="rounded bg-slate-200 px-1">&#123;&#123;step1&#125;&#125;</code>,{' '}
            <code className="rounded bg-slate-200 px-1">&#123;&#123;step2.field&#125;&#125;</code> — референция към отговори от предишни стъпки
          </div>
          <div className="space-y-3">
            {form.steps.map((step, index) => (
              <div key={step.id} className="rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <input
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    value={step.name}
                    onChange={(event) => updateStep(step.id, { name: event.target.value })}
                    placeholder={`Стъпка ${index + 1}`}
                  />
                  <button
                    className="ml-2 text-xs text-rose-500"
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
