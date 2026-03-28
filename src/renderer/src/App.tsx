import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
} from '@shared/types'
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

type TabKey = 'request' | 'history' | 'macros'

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
  const [vaultNeedsUnlock, setVaultNeedsUnlock] = useState(false)
  const [vaultDiskEncrypted, setVaultDiskEncrypted] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [vaultFormError, setVaultFormError] = useState<string | null>(null)
  const [vaultEnablePass, setVaultEnablePass] = useState('')
  const [vaultEnableConfirm, setVaultEnableConfirm] = useState('')
  const [vaultDisablePass, setVaultDisablePass] = useState('')
  const [vaultChangeCurrent, setVaultChangeCurrent] = useState('')
  const [vaultChangeNext, setVaultChangeNext] = useState('')
  const [vaultChangeConfirm, setVaultChangeConfirm] = useState('')

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
        globalVariables: { ...(state.settings?.globalVariables ?? {}) },
        security: {
          idleLockMinutes: state.settings?.security?.idleLockMinutes ?? 0
        }
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
      const st = await window.api.getVaultStatus()
      setVaultDiskEncrypted(st.diskEncrypted)
    } catch (error) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
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
    try {
      localStorage.setItem(THEME_PREF_KEY, settings.theme)
    } catch {
      /* ignore */
    }
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

  const idleMinutes = settings.security?.idleLockMinutes ?? 0
  useEffect(() => {
    if (!window.api || idleMinutes <= 0 || !vaultDiskEncrypted || vaultNeedsUnlock) {
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
      void (async () => {
        await window.api.vaultLock()
        setVaultNeedsUnlock(true)
        setDevices([])
        setFolders([])
        setHistory([])
        setMacros([])
        setSelectedDeviceId(null)
        setSelectedMacroId(null)
      })()
    }, 10_000)
    return () => {
      window.clearInterval(id)
      events.forEach((ev) => window.removeEventListener(ev, mark))
    }
  }, [idleMinutes, vaultDiskEncrypted, vaultNeedsUnlock])

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

  const handleManualVaultLock = async () => {
    if (!window.api) return
    await window.api.vaultLock()
    setVaultNeedsUnlock(true)
    setDevices([])
    setFolders([])
    setHistory([])
    setMacros([])
    setSelectedDeviceId(null)
    setSelectedMacroId(null)
  }

  const handleVaultEnable = async (e: FormEvent) => {
    e.preventDefault()
    if (!window.api) return
    setVaultFormError(null)
    if (vaultEnablePass !== vaultEnableConfirm) {
      setVaultFormError(t(settings.locale, 'vault.passwordMismatch'))
      return
    }
    const r = await window.api.vaultEnable(vaultEnablePass)
    if (r.ok) {
      setVaultEnablePass('')
      setVaultEnableConfirm('')
      setVaultDiskEncrypted(true)
      await loadState()
    } else {
      setVaultFormError(vaultErrorMessage(settings.locale, r.error))
    }
  }

  const handleVaultDisable = async (e: FormEvent) => {
    e.preventDefault()
    if (!window.api) return
    setVaultFormError(null)
    const r = await window.api.vaultDisable(vaultDisablePass)
    if (r.ok) {
      setVaultDisablePass('')
      setVaultDiskEncrypted(false)
      await loadState()
    } else {
      setVaultFormError(vaultErrorMessage(settings.locale, r.error))
    }
  }

  const handleVaultChangePw = async (e: FormEvent) => {
    e.preventDefault()
    if (!window.api) return
    setVaultFormError(null)
    if (vaultChangeNext !== vaultChangeConfirm) {
      setVaultFormError(t(settings.locale, 'vault.passwordMismatch'))
      return
    }
    const r = await window.api.vaultChangePassword(vaultChangeCurrent, vaultChangeNext)
    if (r.ok) {
      setVaultChangeCurrent('')
      setVaultChangeNext('')
      setVaultChangeConfirm('')
    } else {
      setVaultFormError(vaultErrorMessage(settings.locale, r.error))
    }
  }

  const selectedHistory = useMemo(
    () => history.find((entry) => entry.id === historySelection) ?? null,
    [history, historySelection]
  )

  if (!window.api) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="rounded border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/40">
          <h1 className="text-lg font-semibold text-rose-700 dark:text-rose-300">Грешка при зареждане</h1>
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
            window.api не е наличен. Проверете дали preload скриптът е зареден правилно.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Моля, рестартирайте приложението.</p>
        </div>
      </div>
    )
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
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppSidebar
        locale={loc}
        settings={settings}
        persistAppSettings={persistAppSettings}
        globalsText={globalsText}
        setGlobalsText={setGlobalsText}
        vaultDiskEncrypted={vaultDiskEncrypted}
        vaultFormError={vaultFormError}
        vaultEnablePass={vaultEnablePass}
        setVaultEnablePass={setVaultEnablePass}
        vaultEnableConfirm={vaultEnableConfirm}
        setVaultEnableConfirm={setVaultEnableConfirm}
        vaultDisablePass={vaultDisablePass}
        setVaultDisablePass={setVaultDisablePass}
        vaultChangeCurrent={vaultChangeCurrent}
        setVaultChangeCurrent={setVaultChangeCurrent}
        vaultChangeNext={vaultChangeNext}
        setVaultChangeNext={setVaultChangeNext}
        vaultChangeConfirm={vaultChangeConfirm}
        setVaultChangeConfirm={setVaultChangeConfirm}
        onManualVaultLock={handleManualVaultLock}
        onVaultEnable={handleVaultEnable}
        onVaultDisable={handleVaultDisable}
        onVaultChangePw={handleVaultChangePw}
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
