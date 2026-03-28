import { useMemo, useState } from 'react'
import type { AppSettings, Device, HistoryEntry } from '@shared/types'
import { t } from '../i18n'
import { ResponsePanel } from './RequestPanel'

type Props = {
  locale: AppSettings['locale']
  history: HistoryEntry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onClear: () => void
  onReplay: (entry: HistoryEntry) => void
  onDuplicateToRequest: (entry: HistoryEntry) => void
  selectedEntry: HistoryEntry | null
  devices: Device[]
}

export function HistoryPanel({
  locale,
  history,
  selectedId,
  onSelect,
  onClear,
  onReplay,
  onDuplicateToRequest,
  selectedEntry,
  devices
}: Props) {
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
      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="shrink-0 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'history.title')}</h2>
          <button
            type="button"
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onClear}
          >
            {t(locale, 'history.clear')}
          </button>
        </div>

        <div className="mt-2 shrink-0 space-y-2">
          <div className="grid grid-cols-3 gap-1">
            <input
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Method"
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              title="GET, POST, ..."
            />
            <input
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Path"
              value={filterPath}
              onChange={(e) => setFilterPath(e.target.value)}
            />
            <input
              className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              title="200, 404, ..."
            />
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {filteredHistory.length === 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {history.length === 0 ? 'Историята е празна.' : 'Няма резултати за филтъра.'}
            </div>
          )}
          {filteredHistory.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={`w-full rounded border px-3 py-2 text-left text-xs ${
                selectedId === entry.id
                  ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'
              }`}
              onClick={() => onSelect(entry.id)}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                <span>{entry.response?.status ?? 'ERR'}</span>
              </div>
              <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {entry.method} {entry.path}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{entry.url}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'history.details')}</h2>
          {selectedEntry && (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => onDuplicateToRequest(selectedEntry)}
              >
                {t(locale, 'request.duplicate')}
              </button>
              {devices.some((d) => d.id === selectedEntry.deviceId) && (
                <button
                  type="button"
                  className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
                  onClick={() => onReplay(selectedEntry)}
                >
                  {t(locale, 'history.replay')}
                </button>
              )}
            </div>
          )}
        </div>
        {!selectedEntry && (
          <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
            {t(locale, 'history.pick')}
          </div>
        )}
        {selectedEntry && (
          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto text-xs">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">URL</div>
              <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
                {selectedEntry.url}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Headers</div>
              <pre className="mt-1 max-h-36 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
                {JSON.stringify(selectedEntry.headers, null, 2)}
              </pre>
            </div>
            {selectedEntry.body && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Body</div>
                <pre className="mt-1 max-h-36 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
                  {selectedEntry.body}
                </pre>
              </div>
            )}
            <ResponsePanel locale={locale} response={selectedEntry.response ?? null} />
          </div>
        )}
      </div>
    </div>
  )
}
