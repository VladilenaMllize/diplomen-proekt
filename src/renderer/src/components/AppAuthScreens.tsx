import { useEffect, useState, type FormEvent } from 'react'
import type { LocaleCode } from '@shared/types'
import { t } from '../i18n'
import { authErrorMessage } from '../lib/authUi'

const fieldClass =
  'mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800'

function detectLocale(): LocaleCode {
  return navigator.language.toLowerCase().startsWith('bg') ? 'bg' : 'en'
}

type RegisterProps = {
  onRegistered: () => void
}

export function AppRegisterScreen({ onRegistered }: RegisterProps) {
  const loc = detectLocale()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (username.trim().length < 2) {
      setError(t(loc, 'auth.error.usernameShort'))
      return
    }
    if (password.length < 8) {
      setError(t(loc, 'auth.error.passwordShort'))
      return
    }
    if (password !== confirm) {
      setError(t(loc, 'auth.error.mismatch'))
      return
    }
    setBusy(true)
    try {
      const r = await window.api.authRegister(username.trim(), password)
      if (r.ok) {
        onRegistered()
      } else {
        setError(authErrorMessage(loc, r.error))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t(loc, 'auth.registerTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t(loc, 'auth.registerSubtitle')}</p>
        <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {t(loc, 'auth.username')}
          <input
            className={fieldClass}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {t(loc, 'auth.password')}
          <input
            type="password"
            className={fieldClass}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {t(loc, 'auth.confirmPassword')}
          <input
            type="password"
            className={fieldClass}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? t(loc, 'auth.loading') : t(loc, 'auth.submitRegister')}
        </button>
      </form>
    </div>
  )
}

type LoginProps = {
  onLoggedIn: () => void
}

export function AppLoginScreen({ onLoggedIn }: LoginProps) {
  const loc = detectLocale()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const u = await window.api.authGetUsername()
      if (u) setUsername(u)
    })()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const r = await window.api.authLogin(username.trim(), password)
      if (r.ok) {
        onLoggedIn()
      } else {
        setError(authErrorMessage(loc, r.error))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t(loc, 'auth.loginTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t(loc, 'auth.loginSubtitle')}</p>
        <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {t(loc, 'auth.username')}
          <input
            className={fieldClass}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {t(loc, 'auth.password')}
          <input
            type="password"
            className={fieldClass}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? t(loc, 'auth.loading') : t(loc, 'auth.submitLogin')}
        </button>
      </form>
    </div>
  )
}
