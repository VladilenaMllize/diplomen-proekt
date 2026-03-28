import type { FormEvent } from 'react'
import type { AppSettings } from '@shared/types'
import { t } from '../i18n'

type Props = {
  locale: AppSettings['locale']
  password: string
  setPassword: (value: string) => void
  error: string | null
  onSubmit: (e: FormEvent) => void
}

export function VaultUnlockScreen({ locale, password, setPassword, error, onSubmit }: Props) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t(locale, 'vault.title')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t(locale, 'vault.subtitle')}</p>
        <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">
          {t(locale, 'vault.password')}
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {t(locale, 'vault.unlock')}
        </button>
      </form>
    </div>
  )
}
