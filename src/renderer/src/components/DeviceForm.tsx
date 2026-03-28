import { useEffect, useState, type FormEvent } from 'react'
import type { AppSettings, AuthType, Device, DeviceInput } from '@shared/types'
import { t } from '../i18n'
import {
  authTypes,
  deviceToForm,
  formToDeviceInput,
  type DeviceFormState
} from '../lib/deviceForm'

type Props = {
  device: Device | null
  locale: AppSettings['locale']
  onSave: (input: DeviceInput) => void
  onRemove: (deviceId: string) => void
}

export function DeviceForm({ device, locale, onSave, onRemove }: Props) {
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

  const field =
    'rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
  const label = 'text-[11px] font-semibold text-slate-500 dark:text-slate-400'
  const panel = 'rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-800/80'

  return (
    <form className="mt-3 space-y-3 text-xs" onSubmit={handleSubmit}>
      <div>
        <label className={label}>Име</label>
        <input
          className={`mt-1 w-full ${field}`}
          value={form.name}
          onChange={(event) => updateForm({ name: event.target.value })}
          placeholder="Device A"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className={label}>IP адрес</label>
          <input
            className={`mt-1 w-full ${field}`}
            value={form.ip}
            onChange={(event) => updateForm({ ip: event.target.value })}
            placeholder="192.168.0.10"
          />
        </div>
        <div>
          <label className={label}>Порт</label>
          <input
            className={`mt-1 w-full ${field}`}
            value={form.port}
            onChange={(event) => updateForm({ port: event.target.value })}
            placeholder="80"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Протокол</label>
          <select
            className={`mt-1 w-full ${field}`}
            value={form.protocol}
            onChange={(event) => updateForm({ protocol: event.target.value as 'http' | 'https' })}
          >
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
        </div>
        <div>
          <label className={label}>Base path</label>
          <input
            className={`mt-1 w-full ${field}`}
            value={form.basePath}
            onChange={(event) => updateForm({ basePath: event.target.value })}
            placeholder="/api"
          />
        </div>
      </div>

      <div className={panel}>
        <div className={label}>Автентикация</div>
        <select
          className={`mt-1 w-full ${field}`}
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
              className={field}
              value={form.username}
              onChange={(event) => updateForm({ username: event.target.value })}
              placeholder="Username"
            />
            <input
              className={field}
              type="password"
              value={form.password}
              onChange={(event) => updateForm({ password: event.target.value })}
              placeholder="Password"
            />
          </div>
        )}

        {form.authType === 'bearer' && (
          <input
            className={`mt-2 w-full ${field}`}
            value={form.token}
            onChange={(event) => updateForm({ token: event.target.value })}
            placeholder="Bearer token"
          />
        )}

        {form.authType === 'apiKey' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className={field}
              value={form.apiKeyHeader}
              onChange={(event) => updateForm({ apiKeyHeader: event.target.value })}
              placeholder="Header name"
            />
            <input
              className={field}
              value={form.apiKeyValue}
              onChange={(event) => updateForm({ apiKeyValue: event.target.value })}
              placeholder="API key"
            />
          </div>
        )}
      </div>

      <div className={panel}>
        <div className="flex items-center justify-between">
          <div className={label}>Health check</div>
          <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
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
            className={field}
            value={form.healthPath}
            onChange={(event) => updateForm({ healthPath: event.target.value })}
            placeholder="/health"
          />
          <input
            className={field}
            value={form.healthInterval}
            onChange={(event) => updateForm({ healthInterval: event.target.value })}
            placeholder="Interval (sec)"
          />
          <input
            className={`col-span-2 ${field}`}
            value={form.healthTimeout}
            onChange={(event) => updateForm({ healthTimeout: event.target.value })}
            placeholder="Timeout (ms)"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
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
