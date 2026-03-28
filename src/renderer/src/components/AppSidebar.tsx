import type { FormEvent } from 'react'
import type { AppSettings, Device, DeviceInput } from '@shared/types'
import { DeviceForm } from './DeviceForm'
import { t } from '../i18n'
import { parseGlobalsText } from '../lib/appSettings'

export type AppSidebarProps = {
  locale: AppSettings['locale']
  settings: AppSettings
  persistAppSettings: (next: AppSettings) => Promise<void>
  globalsText: string
  setGlobalsText: (value: string) => void
  vaultDiskEncrypted: boolean
  vaultFormError: string | null
  vaultEnablePass: string
  setVaultEnablePass: (value: string) => void
  vaultEnableConfirm: string
  setVaultEnableConfirm: (value: string) => void
  vaultDisablePass: string
  setVaultDisablePass: (value: string) => void
  vaultChangeCurrent: string
  setVaultChangeCurrent: (value: string) => void
  vaultChangeNext: string
  setVaultChangeNext: (value: string) => void
  vaultChangeConfirm: string
  setVaultChangeConfirm: (value: string) => void
  onManualVaultLock: () => void
  onVaultEnable: (e: FormEvent) => void
  onVaultDisable: (e: FormEvent) => void
  onVaultChangePw: (e: FormEvent) => void
  startupLoadError: string | null
  importError: string | null
  devices: Device[]
  selectedDeviceId: string | null
  onSelectDeviceId: (id: string | null) => void
  onExportConfig: () => void
  onImportConfig: () => void
  selectedDevice: Device | null
  onSaveDevice: (input: DeviceInput) => void
  onRemoveDevice: (deviceId: string) => void
}

export function AppSidebar({
  locale: loc,
  settings,
  persistAppSettings,
  globalsText,
  setGlobalsText,
  vaultDiskEncrypted,
  vaultFormError,
  vaultEnablePass,
  setVaultEnablePass,
  vaultEnableConfirm,
  setVaultEnableConfirm,
  vaultDisablePass,
  setVaultDisablePass,
  vaultChangeCurrent,
  setVaultChangeCurrent,
  vaultChangeNext,
  setVaultChangeNext,
  vaultChangeConfirm,
  setVaultChangeConfirm,
  onManualVaultLock,
  onVaultEnable,
  onVaultDisable,
  onVaultChangePw,
  startupLoadError,
  importError,
  devices,
  selectedDeviceId,
  onSelectDeviceId,
  onExportConfig,
  onImportConfig,
  selectedDevice,
  onSaveDevice,
  onRemoveDevice
}: AppSidebarProps) {
  return (
    <aside className="flex w-80 min-h-0 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div>
          <h1 className="text-lg font-semibold">{t(loc, 'app.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t(loc, 'app.subtitle')}</p>
        </div>
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onSelectDeviceId(null)}
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

        <div className="mt-3 rounded border border-slate-200 px-2 py-2 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {t(loc, 'vault.security')}
            </span>
            {vaultDiskEncrypted && (
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => void onManualVaultLock()}
              >
                {t(loc, 'vault.lockNow')}
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
            {vaultDiskEncrypted ? t(loc, 'vault.enabled') : t(loc, 'vault.enableHint')}
          </p>
          <label className="mt-2 block text-[10px] font-medium text-slate-600 dark:text-slate-400">
            {t(loc, 'vault.idleLock')}
            <select
              className="ml-1 rounded border border-slate-200 px-1 py-0.5 text-[10px] dark:border-slate-600 dark:bg-slate-800"
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
          {vaultFormError && (
            <p className="mt-2 text-[10px] text-rose-600 dark:text-rose-400">{vaultFormError}</p>
          )}
          {!vaultDiskEncrypted ? (
            <form onSubmit={(e) => void onVaultEnable(e)} className="mt-2 space-y-1">
              <input
                type="password"
                autoComplete="new-password"
                placeholder={t(loc, 'vault.newPassword')}
                className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
                value={vaultEnablePass}
                onChange={(e) => setVaultEnablePass(e.target.value)}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder={t(loc, 'vault.confirmPassword')}
                className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
                value={vaultEnableConfirm}
                onChange={(e) => setVaultEnableConfirm(e.target.value)}
              />
              <button
                type="submit"
                className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-white hover:bg-slate-800 dark:bg-slate-600"
              >
                {t(loc, 'vault.submitEnable')}
              </button>
            </form>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-[10px] text-slate-500">{t(loc, 'vault.disableWarn')}</p>
              <form onSubmit={(e) => void onVaultDisable(e)} className="space-y-1">
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder={t(loc, 'vault.currentPassword')}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
                  value={vaultDisablePass}
                  onChange={(e) => setVaultDisablePass(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                >
                  {t(loc, 'vault.submitDisable')}
                </button>
              </form>
              <form onSubmit={(e) => void onVaultChangePw(e)} className="space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder={t(loc, 'vault.currentPassword')}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
                  value={vaultChangeCurrent}
                  onChange={(e) => setVaultChangeCurrent(e.target.value)}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t(loc, 'vault.newPassword')}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
                  value={vaultChangeNext}
                  onChange={(e) => setVaultChangeNext(e.target.value)}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={t(loc, 'vault.confirmPassword')}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800"
                  value={vaultChangeConfirm}
                  onChange={(e) => setVaultChangeConfirm(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-white hover:bg-slate-800 dark:bg-slate-600"
                >
                  {t(loc, 'vault.submitChange')}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(loc, 'nav.devices')}</h2>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={onExportConfig}
            >
              {t(loc, 'nav.export')}
            </button>
            <button
              type="button"
              className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={onImportConfig}
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
                  onClick={() => onSelectDeviceId(device.id)}
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
        <DeviceForm device={selectedDevice} locale={loc} onSave={onSaveDevice} onRemove={onRemoveDevice} />
      </div>
    </aside>
  )
}
