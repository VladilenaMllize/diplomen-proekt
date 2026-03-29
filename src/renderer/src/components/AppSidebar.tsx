import type { AppSettings, Device, DeviceInput } from '@shared/types'
import { DeviceForm } from './DeviceForm'
import { t } from '../i18n'

export type AppSidebarProps = {
  locale: AppSettings['locale']
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
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{t(loc, 'app.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t(loc, 'app.subtitle')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1">
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => void window.api.openSettingsWindow()}
          >
            {t(loc, 'nav.settings')}
          </button>
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => onSelectDeviceId(null)}
          >
            {t(loc, 'nav.new')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between">
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
