/**
 * Корен на UI: табове заявка/история/макроси, странична лента с устройства,
 * връзка с main през `window.api` (preload bridge). Не импортира Node модули.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import type {
  AppSettings,
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

import { AppLoginScreen, AppRegisterScreen } from './components/AppAuthScreens'
import { AppSidebar } from './components/AppSidebar'
import { HistoryPanel } from './components/HistoryPanel'
import { MacroPanel } from './components/MacroPanel'
import { RequestPanel } from './components/RequestPanel'
import { TabButton } from './components/TabButton'
import { VaultUnlockScreen } from './components/VaultUnlockScreen'
import { t } from './i18n'
import { defaultAppSettings } from './lib/appSettings'
import { THEME_PREF_KEY } from './lib/theme'
import { vaultErrorMessage } from './lib/vaultUi'

const fallbackMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function readStoredTheme(): 'light' | 'dark' {
  try {
    const s = localStorage.getItem(THEME_PREF_KEY)
    if (s === 'dark' || s === 'light') return s
  } catch {
    /* ignore */
  }
  return defaultAppSettings().theme
}

type TabKey = 'request' | 'history' | 'macros'

type AuthPhase = 'loading' | 'register' | 'login' | 'session'

function tryParseJson(value: string): unknown | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

async function sendDirectRequest(input: {
  method: HttpMethod
  url: string
  headersText: string
  bodyText: string
  timeoutMs: number
}): Promise<ResponseData> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), Math.max(100, input.timeoutMs))
  try {
    const parsedHeaders = input.headersText.trim() ? JSON.parse(input.headersText) : {}
    const headers =
      parsedHeaders && typeof parsedHeaders === 'object'
        ? (parsedHeaders as Record<string, string>)
        : {}
    const shouldSendBody = !!input.bodyText && !['GET', 'DELETE'].includes(input.method)
    const response = await fetch(input.url, {
      method: input.method,
      headers,
      body: shouldSendBody ? input.bodyText : undefined,
      signal: controller.signal
    })
    const body = await response.text()
    const outHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      outHeaders[key] = value
    })
    const parsedBody = tryParseJson(body)
    return {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
      body,
      parsedBody,
      parsedType: parsedBody !== undefined ? 'json' : 'text',
      durationMs: Date.now() - startedAt
    }
  } catch (error) {
    return {
      status: 0,
      statusText: 'ERROR',
      headers: {},
      body: '',
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Request failed'
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

function NoBackendRequestScreen() {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('http://localhost:8080/')
  const [headersText, setHeadersText] = useState('{}')
  const [bodyText, setBodyText] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('10000')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<ResponseData | null>(null)

  const onSend = async () => {
    setError(null)
    setResponse(null)
    const timeout = Number(timeoutMs)
    if (!Number.isFinite(timeout) || timeout <= 0) {
      setError('Timeout must be a positive number.')
      return
    }
    try {
      if (headersText.trim()) JSON.parse(headersText)
    } catch {
      setError('Headers must be valid JSON object.')
      return
    }
    setSending(true)
    const res = await sendDirectRequest({
      method,
      url: url.trim(),
      headersText,
      bodyText,
      timeoutMs: timeout
    })
    setResponse(res)
    setSending(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
        Backend bridge is not available. Using direct browser request mode.
      </div>
      <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
        <select
          className="rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
        >
          {fallbackMethods.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/api"
        />
      </div>
      <textarea
        className="min-h-[100px] rounded border border-slate-200 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
        value={headersText}
        onChange={(e) => setHeadersText(e.target.value)}
      />
      <textarea
        className="min-h-[140px] rounded border border-slate-200 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <input
          className="w-44 rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
          value={timeoutMs}
          onChange={(e) => setTimeoutMs(e.target.value)}
          placeholder="Timeout (ms)"
        />
        <button
          type="button"
          className="rounded bg-emerald-500 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-600"
          disabled={sending}
          onClick={() => void onSend()}
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
      {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
      {response && (
        <pre className="min-h-[160px] overflow-auto rounded border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  )
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
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...defaultAppSettings(),
    theme: readStoredTheme()
  }))
  const [historyToRequestSeed, setHistoryToRequestSeed] = useState<HistoryEntry | null>(null)
  const [vaultNeedsUnlock, setVaultNeedsUnlock] = useState(false)
  const [vaultDiskEncrypted, setVaultDiskEncrypted] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [authPhase, setAuthPhase] = useState<AuthPhase>('loading')

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
      const auth = await window.api.authGetBootstrap()
      if (!auth.sessionUnlocked) {
        setVaultNeedsUnlock(false)
        setAuthPhase('login')
        return
      }
      const state = await window.api.getState()
      setDevices(state.devices)
      setFolders(state.folders ?? [])
      setHistory(state.history)
      setMacros(state.macros)
      const nextSettings: AppSettings = {
        theme: state.settings?.theme ?? 'light',
        locale: state.settings?.locale ?? 'bg',
        globalVariables: { ...(state.settings?.globalVariables ?? {}) },
        security: {
          idleLockMinutes: state.settings?.security?.idleLockMinutes ?? 0
        }
      }
      setSettings(nextSettings)

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
      const st = await window.api.getVaultStatus()
      setVaultDiskEncrypted(st.diskEncrypted)
    } catch (error) {
      if (error instanceof Error && error.message === 'APP_AUTH_LOCKED') {
        setVaultNeedsUnlock(false)
        setAuthPhase('login')
        return
      }
      if (error instanceof Error && error.message === 'VAULT_LOCKED') {
        setVaultNeedsUnlock(true)
        setDevices([])
        setFolders([])
        setHistory([])
        setMacros([])
        setSelectedDeviceId(null)
        setSelectedMacroId(null)
        const st = await window.api.getVaultStatus()
        setVaultDiskEncrypted(st.diskEncrypted)
        return
      }
      console.error('Failed to load state:', error)
    }
  }

  useEffect(() => {
    if (!window.api) return
    let cancelled = false
    void (async () => {
      const b = await window.api.authGetBootstrap()
      if (cancelled) return
      if (!b.hasAccount) {
        setAuthPhase('register')
        return
      }
      if (!b.sessionUnlocked) {
        setAuthPhase('login')
        return
      }
      setAuthPhase('session')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (authPhase !== 'session' || !window.api) return
    let cancelled = false
    void (async () => {
      const st = await window.api.getVaultStatus()
      if (cancelled) return
      setVaultDiskEncrypted(st.diskEncrypted)
      if (st.diskEncrypted && !st.unlocked) {
        setVaultNeedsUnlock(true)
        return
      }
      await loadState()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phase-driven bootstrap
  }, [authPhase])

  useEffect(() => {
    if (!window.api) return
    void (async () => {
      const err = await window.api.getStoreLoadError()
      if (err) setStartupLoadError(err)
    })()
  }, [])

  useEffect(() => {
    if (authPhase === 'session') {
      document.documentElement.classList.toggle('dark', settings.theme === 'dark')
      try {
        localStorage.setItem(THEME_PREF_KEY, settings.theme)
      } catch {
        /* ignore */
      }
      return
    }
    let dark = settings.theme === 'dark'
    try {
      const s = localStorage.getItem(THEME_PREF_KEY)
      if (s === 'dark') dark = true
      else if (s === 'light') dark = false
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle('dark', dark)
  }, [settings.theme, authPhase])

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

  useEffect(() => {
    if (!window.api) return
    const sub = window.api.subscribeSettingsUpdated
    if (typeof sub !== 'function') return
    return sub((next) => {
      setSettings({
        theme: next.theme ?? 'light',
        locale: next.locale ?? 'bg',
        globalVariables: { ...(next.globalVariables ?? {}) },
        security: {
          idleLockMinutes: next.security?.idleLockMinutes ?? 0
        }
      })
    })
  }, [])

  useEffect(() => {
    if (!window.api) return
    const sub = window.api.subscribeVaultStatus
    if (typeof sub !== 'function') return
    return sub((st) => {
      setVaultDiskEncrypted(st.diskEncrypted)
      setVaultNeedsUnlock(st.diskEncrypted && !st.unlocked)
      if (st.diskEncrypted && !st.unlocked) {
        setDevices([])
        setFolders([])
        setHistory([])
        setMacros([])
        setSelectedDeviceId(null)
        setSelectedMacroId(null)
      }
    })
  }, [])

  useEffect(() => {
    if (!window.api) return
    const sub = window.api.subscribeSessionLocked
    if (typeof sub !== 'function') return
    return sub(() => {
      setVaultNeedsUnlock(false)
      setDevices([])
      setFolders([])
      setHistory([])
      setMacros([])
      setSelectedDeviceId(null)
      setSelectedMacroId(null)
      void window.api.getVaultStatus().then((st) => {
        setVaultDiskEncrypted(st.diskEncrypted)
      })
      setAuthPhase('login')
    })
  }, [])

  const idleMinutes = settings.security?.idleLockMinutes ?? 0
  useEffect(() => {
    if (!window.api || idleMinutes <= 0 || authPhase !== 'session' || vaultNeedsUnlock) {
      return
    }
    const idleMs = idleMinutes * 60 * 1000
    let last = Date.now()
    const mark = () => {
      last = Date.now()
    }
    const events: (keyof WindowEventMap)[] = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'wheel'
    ]
    events.forEach((ev) => window.addEventListener(ev, mark, { passive: true }))
    const id = window.setInterval(() => {
      if (Date.now() - last < idleMs) return
      last = Date.now()
      void window.api.authLockSession()
    }, 10_000)
    return () => {
      window.clearInterval(id)
      events.forEach((ev) => window.removeEventListener(ev, mark))
    }
  }, [idleMinutes, authPhase, vaultNeedsUnlock])

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

  const handleUnlockSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!window.api) return
    setUnlockError(null)
    const r = await window.api.vaultUnlock(unlockPassword)
    if (r.ok) {
      setUnlockPassword('')
      setVaultNeedsUnlock(false)
      await loadState()
    } else {
      setUnlockError(vaultErrorMessage(settings.locale, r.error))
    }
  }

  const selectedHistory = useMemo(
    () => history.find((entry) => entry.id === historySelection) ?? null,
    [history, historySelection]
  )

  if (!window.api) {
    return <NoBackendRequestScreen />
  }

  if (authPhase === 'loading') {
    const loc = navigator.language.toLowerCase().startsWith('bg') ? 'bg' : 'en'
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        {t(loc, 'auth.loading')}
      </div>
    )
  }

  if (authPhase === 'register') {
    return <AppRegisterScreen onRegistered={() => setAuthPhase('session')} />
  }

  if (authPhase === 'login') {
    return <AppLoginScreen onLoggedIn={() => setAuthPhase('session')} />
  }

  if (vaultNeedsUnlock) {
    return (
      <VaultUnlockScreen
        locale={settings.locale}
        password={unlockPassword}
        setPassword={setUnlockPassword}
        error={unlockError}
        onSubmit={handleUnlockSubmit}
      />
    )
  }

  const loc = settings.locale

  return (
    <div className="flex h-full min-h-0 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppSidebar
        locale={loc}
        startupLoadError={startupLoadError}
        importError={importError}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDeviceId={setSelectedDeviceId}
        onExportConfig={handleExportConfig}
        onImportConfig={handleImportConfig}
        selectedDevice={selectedDevice}
        onSaveDevice={handleSaveDevice}
        onRemoveDevice={handleRemoveDevice}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-900">
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
