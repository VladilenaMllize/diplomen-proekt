import { type FormEvent, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { t } from '../i18n'
import { vaultErrorMessage } from '../lib/vaultUi'

type Props = {
  locale: AppSettings['locale']
  settings: AppSettings
  vaultDiskEncrypted: boolean
  persistAppSettings: (next: AppSettings) => Promise<void>
  onVaultDiskEncryptedChange: (v: boolean) => void
}

export function SettingsVaultPanel({
  locale: loc,
  settings,
  vaultDiskEncrypted,
  persistAppSettings,
  onVaultDiskEncryptedChange
}: Props) {
  const [vaultFormError, setVaultFormError] = useState<string | null>(null)
  const [vaultEnablePass, setVaultEnablePass] = useState('')
  const [vaultEnableConfirm, setVaultEnableConfirm] = useState('')
  const [vaultDisablePass, setVaultDisablePass] = useState('')
  const [vaultChangeCurrent, setVaultChangeCurrent] = useState('')
  const [vaultChangeNext, setVaultChangeNext] = useState('')
  const [vaultChangeConfirm, setVaultChangeConfirm] = useState('')

  const refreshVault = async () => {
    const st = await window.api.getVaultStatus()
    onVaultDiskEncryptedChange(st.diskEncrypted)
  }

  const handleVaultEnable = async (e: FormEvent) => {
    e.preventDefault()
    setVaultFormError(null)
    const r = await window.api.vaultEnable(vaultEnablePass)
    if (r.ok) {
      setVaultEnablePass('')
      setVaultEnableConfirm('')
      await refreshVault()
    } else {
      setVaultFormError(vaultErrorMessage(loc, r.error))
    }
  }

  const handleVaultDisable = async (e: FormEvent) => {
    e.preventDefault()
    setVaultFormError(null)
    const r = await window.api.vaultDisable(vaultDisablePass)
    if (r.ok) {
      setVaultDisablePass('')
      await refreshVault()
    } else {
      setVaultFormError(vaultErrorMessage(loc, r.error))
    }
  }

  const handleVaultChangePw = async (e: FormEvent) => {
    e.preventDefault()
    setVaultFormError(null)
    if (vaultChangeNext !== vaultChangeConfirm) {
      setVaultFormError(t(loc, 'vault.passwordMismatch'))
      return
    }
    const r = await window.api.vaultChangePassword(vaultChangeCurrent, vaultChangeNext)
    if (r.ok) {
      setVaultChangeCurrent('')
      setVaultChangeNext('')
      setVaultChangeConfirm('')
      await refreshVault()
    } else {
      setVaultFormError(vaultErrorMessage(loc, r.error))
    }
  }

  const handleManualLock = async () => {
    await window.api.authLockSession()
  }

  const field =
    'mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800'
  const label = 'text-xs font-semibold text-slate-600 dark:text-slate-400'

  return (
    <div className="mt-6 w-full max-w-md rounded-lg border border-slate-200 px-3 py-3 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(loc, 'vault.security')}</span>
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => void handleManualLock()}
        >
          {t(loc, 'auth.lockApp')}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
        {vaultDiskEncrypted ? t(loc, 'vault.enabled') : t(loc, 'vault.enableHint')}
      </p>
      <label className={`mt-3 block ${label}`}>
        {t(loc, 'vault.idleLock')}
        <select
          className="ml-1 rounded border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
          value={String(settings.security?.idleLockMinutes ?? 0)}
          onChange={(e) =>
            void persistAppSettings({
              ...settings,
              security: { idleLockMinutes: Number(e.target.value) }
            })
          }
        >
          <option value="0">{t(loc, 'vault.idle.off')}</option>
          <option value="5">{t(loc, 'vault.idle.5')}</option>
          <option value="15">{t(loc, 'vault.idle.15')}</option>
          <option value="30">{t(loc, 'vault.idle.30')}</option>
          <option value="60">{t(loc, 'vault.idle.60')}</option>
        </select>
      </label>
      <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-500">{t(loc, 'vault.idle.help')}</p>

      {vaultFormError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{vaultFormError}</p>}

      {!vaultDiskEncrypted ? (
        <form onSubmit={(e) => void handleVaultEnable(e)} className="mt-3 space-y-2">
          <input
            type="password"
            autoComplete="new-password"
            placeholder={t(loc, 'vault.newPassword')}
            className={field}
            value={vaultEnablePass}
            onChange={(e) => setVaultEnablePass(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder={t(loc, 'vault.confirmPassword')}
            className={field}
            value={vaultEnableConfirm}
            onChange={(e) => setVaultEnableConfirm(e.target.value)}
          />
          <button
            type="submit"
            className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-600"
          >
            {t(loc, 'vault.submitEnable')}
          </button>
        </form>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">{t(loc, 'vault.disableWarn')}</p>
          <form onSubmit={(e) => void handleVaultDisable(e)} className="space-y-2">
            <input
              type="password"
              autoComplete="current-password"
              placeholder={t(loc, 'vault.currentPassword')}
              className={field}
              value={vaultDisablePass}
              onChange={(e) => setVaultDisablePass(e.target.value)}
            />
            <button
              type="submit"
              className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            >
              {t(loc, 'vault.submitDisable')}
            </button>
          </form>
          <form onSubmit={(e) => void handleVaultChangePw(e)} className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{t(loc, 'vault.submitChange')}</div>
            <input
              type="password"
              autoComplete="current-password"
              placeholder={t(loc, 'vault.currentPassword')}
              className={field}
              value={vaultChangeCurrent}
              onChange={(e) => setVaultChangeCurrent(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t(loc, 'vault.newPassword')}
              className={field}
              value={vaultChangeNext}
              onChange={(e) => setVaultChangeNext(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder={t(loc, 'vault.confirmPassword')}
              className={field}
              value={vaultChangeConfirm}
              onChange={(e) => setVaultChangeConfirm(e.target.value)}
            />
            <button
              type="submit"
              className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-600"
            >
              {t(loc, 'vault.submitChange')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
