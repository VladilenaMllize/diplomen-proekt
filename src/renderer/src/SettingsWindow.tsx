import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { SettingsVaultPanel } from './components/SettingsVaultPanel'
import { t } from './i18n'
import { defaultAppSettings, parseGlobalsText } from './lib/appSettings'
import { THEME_PREF_KEY } from './lib/theme'

export function SettingsWindow() {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [vaultDiskEncrypted, setVaultDiskEncrypted] = useState(false)
  const [globalsText, setGlobalsText] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errorLocale, setErrorLocale] = useState<'bg' | 'en'>('en')
  const [saveHint, setSaveHint] = useState(false)

  const loc = settings.locale

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    try {
      localStorage.setItem(THEME_PREF_KEY, settings.theme)
    } catch {
      /* ignore */
    }
  }, [settings.theme])

  useEffect(() => {
    document.title = t(loc, 'settings.windowTitle')
  }, [loc])

  useEffect(() => {
    let cancelled = false
    let requestId = 0

    const bootstrap = async () => {
      const id = ++requestId
      setLoadError(null)
      try {
        const auth = await window.api.authGetBootstrap()
        if (cancelled || id !== requestId) return
        if (!auth.sessionUnlocked) {
          const errLoc: 'bg' | 'en' = navigator.language.toLowerCase().startsWith('bg') ? 'bg' : 'en'
          setErrorLocale(errLoc)
          setLoadError(t(errLoc, 'settings.authRequired'))
          return
        }
        const state = await window.api.getState()
        if (cancelled || id !== requestId) return
        const s: AppSettings = {
          theme: state.settings?.theme ?? 'light',
          locale: state.settings?.locale ?? 'bg',
          globalVariables: { ...(state.settings?.globalVariables ?? {}) },
          security: {
            idleLockMinutes: state.settings?.security?.idleLockMinutes ?? 0
          }
        }
        setSettings(s)
        setGlobalsText(
          Object.entries(s.globalVariables)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')
        )
        const vst = await window.api.getVaultStatus()
        if (cancelled || id !== requestId) return
        setVaultDiskEncrypted(vst.diskEncrypted)
      } catch (error) {
        if (cancelled || id !== requestId) return
        const errLoc: 'bg' | 'en' = navigator.language.toLowerCase().startsWith('bg') ? 'bg' : 'en'
        setErrorLocale(errLoc)
        const msg = error instanceof Error ? error.message : ''
        if (msg === 'APP_AUTH_LOCKED' || msg.includes('APP_AUTH_LOCKED')) {
          setLoadError(t(errLoc, 'settings.authRequired'))
        } else if (msg === 'VAULT_LOCKED' || msg.includes('VAULT_LOCKED')) {
          setLoadError(t(errLoc, 'settings.vaultLocked'))
        } else {
          setLoadError(t(errLoc, 'settings.loadFailed'))
        }
      }
    }

    void bootstrap()
    const onFocus = () => void bootstrap()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    const sub = window.api.subscribeSettingsUpdated
    if (typeof sub !== 'function') return
    return sub((next) => {
      setSettings(next)
      setGlobalsText(
        Object.entries(next.globalVariables ?? {})
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      )
    })
  }, [])

  const persist = async (next: AppSettings) => {
    const stored = await window.api.updateSettings(next)
    if (stored) setSettings(stored)
  }

  const onThemeChange = (theme: AppSettings['theme']) => {
    void persist({ ...settings, theme })
  }

  const onLocaleChange = (locale: AppSettings['locale']) => {
    void persist({ ...settings, locale })
  }

  const onSaveGlobals = async () => {
    await persist({
      ...settings,
      globalVariables: parseGlobalsText(globalsText)
    })
    setSaveHint(true)
    window.setTimeout(() => setSaveHint(false), 2000)
  }

  const field =
    'rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
  const label = 'text-xs font-semibold text-slate-600 dark:text-slate-400'

  if (loadError) {
    return (
      <div className="flex h-full min-h-0 flex-col items-start justify-start gap-3 bg-slate-50 p-4 pt-4 text-left dark:bg-slate-950">
        <p className="max-w-sm text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={() => void window.api.focusMainWindow()}
          >
            {t(errorLocale, 'settings.openMainWindow')}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
            onClick={() => window.close()}
          >
            {t(errorLocale, 'settings.closeWindow')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-start overflow-y-auto bg-slate-50 p-4 pt-4 text-left text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <h1 className="text-lg font-semibold">{t(loc, 'settings.windowTitle')}</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(loc, 'settings.windowSubtitle')}</p>

      <div className="mt-4 w-full max-w-md flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
        <span className={label}>{t(loc, 'settings.theme')}</span>
        <select
          className={`${field} text-sm`}
          value={settings.theme}
          onChange={(e) => onThemeChange(e.target.value as AppSettings['theme'])}
        >
          <option value="light">{t(loc, 'settings.theme.light')}</option>
          <option value="dark">{t(loc, 'settings.theme.dark')}</option>
        </select>
        <span className={label}>{t(loc, 'settings.locale')}</span>
        <select
          className={`${field} text-sm`}
          value={settings.locale}
          onChange={(e) => onLocaleChange(e.target.value as AppSettings['locale'])}
        >
          <option value="bg">БГ</option>
          <option value="en">EN</option>
        </select>
      </div>

      <div className="mt-4 w-full max-w-md">
        <label className={label}>{t(loc, 'settings.globals')}</label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{t(loc, 'settings.globalsHelp')}</p>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded border border-slate-200 px-2 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
          value={globalsText}
          onChange={(e) => setGlobalsText(e.target.value)}
          placeholder={'token=secret\nbaseUrl=v1'}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={() => void onSaveGlobals()}
          >
            {t(loc, 'settings.saveGlobals')}
          </button>
          {saveHint && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{t(loc, 'settings.saved')}</span>
          )}
        </div>
      </div>

      <SettingsVaultPanel
        locale={loc}
        settings={settings}
        vaultDiskEncrypted={vaultDiskEncrypted}
        persistAppSettings={persist}
        onVaultDiskEncryptedChange={setVaultDiskEncrypted}
      />

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          className="rounded border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40"
          onClick={() => void window.api.authLockSession()}
        >
          {t(loc, 'settings.logout')}
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => window.close()}
        >
          {t(loc, 'settings.closeWindow')}
        </button>
      </div>
    </div>
  )
}
