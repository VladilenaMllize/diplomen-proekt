import { Suspense, useEffect, useState } from 'react'
import type {
  AppSettings,
  Device,
  HistoryEntry,
  HttpMethod,
  RequestOptions,
  ResponseData
} from '@shared/types'
import { t } from '../i18n'
import { httpMethods } from '../lib/macroForm'
import { useIsDarkClass } from '../lib/theme'

type QueryRow = { id: string; key: string; value: string }

type RequestPanelProps = {
  device: Device | null
  locale: AppSettings['locale']
  response: ResponseData | null
  onSend: (request: RequestOptions) => void
  sending: boolean
  sendError: string | null
  seedFromHistory: HistoryEntry | null
  onSeedConsumed: () => void
}

export function RequestPanel({
  device,
  locale,
  response,
  onSend,
  sending,
  sendError,
  seedFromHistory,
  onSeedConsumed
}: RequestPanelProps) {
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [path, setPath] = useState('')
  const [headersText, setHeadersText] = useState('{}')
  const [body, setBody] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('')
  const [queryRows, setQueryRows] = useState<QueryRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!seedFromHistory) return
    setMethod(seedFromHistory.method)
    setPath(seedFromHistory.path)
    setHeadersText(
      Object.keys(seedFromHistory.headers).length > 0
        ? JSON.stringify(seedFromHistory.headers, null, 2)
        : '{}'
    )
    setBody(seedFromHistory.body ?? '')
    const q = seedFromHistory.query
    if (q && Object.keys(q).length > 0) {
      setQueryRows(
        Object.entries(q).map(([key, value]) => ({
          id: crypto.randomUUID(),
          key,
          value: String(value)
        }))
      )
    } else {
      setQueryRows([])
    }
    onSeedConsumed()
  }, [seedFromHistory, onSeedConsumed])

  const addQueryRow = () => {
    setQueryRows((r) => [...r, { id: crypto.randomUUID(), key: '', value: '' }])
  }

  const updateQueryRow = (id: string, patch: Partial<QueryRow>) => {
    setQueryRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeQueryRow = (id: string) => {
    setQueryRows((rows) => rows.filter((row) => row.id !== id))
  }

  const handleSend = () => {
    if (!device) {
      return
    }

    let headers: Record<string, string> | undefined
    if (headersText.trim()) {
      try {
        const parsed = JSON.parse(headersText)
        if (parsed && typeof parsed === 'object') {
          headers = parsed
        } else {
          throw new Error('Headers should be object')
        }
      } catch {
        setError(locale === 'en' ? 'Invalid JSON for headers' : 'Невалиден JSON за headers')
        return
      }
    }

    const query: Record<string, string> = {}
    for (const row of queryRows) {
      const k = row.key.trim()
      if (k) query[k] = row.value
    }

    setError(null)
    const timeoutValue = Number(timeoutMs)
    void onSend({
      deviceId: device.id,
      method,
      path,
      query: Object.keys(query).length > 0 ? query : undefined,
      headers,
      body: body || undefined,
      timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : undefined
    })
  }

  const baseUrl = device
    ? `${device.protocol}://${device.ip}:${device.port}${device.basePath ?? ''}`
    : '—'

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[1.1fr_1fr] gap-6">
      <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'request.title')}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t(locale, 'request.baseUrl')}: {baseUrl}
        </p>

        {!device && (
          <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
            {t(locale, 'request.pickDevice')}
          </div>
        )}

        {device && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <select
                className="rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                value={method}
                onChange={(event) => setMethod(event.target.value as HttpMethod)}
              >
                {httpMethods.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/status"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t(locale, 'request.query')}
                </label>
                <button
                  type="button"
                  className="text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
                  onClick={addQueryRow}
                >
                  {t(locale, 'request.addQuery')}
                </button>
              </div>
              <div className="mt-1 space-y-1">
                {queryRows.length === 0 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">—</p>
                )}
                {queryRows.map((row) => (
                  <div key={row.id} className="flex gap-1">
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                      placeholder={t(locale, 'request.queryKey')}
                      value={row.key}
                      onChange={(e) => updateQueryRow(row.id, { key: e.target.value })}
                    />
                    <input
                      className="min-w-0 flex-1 rounded border border-slate-200 px-1 py-0.5 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                      placeholder={t(locale, 'request.queryValue')}
                      value={row.value}
                      onChange={(e) => updateQueryRow(row.id, { value: e.target.value })}
                    />
                    <button
                      type="button"
                      className="shrink-0 px-1 text-rose-500"
                      onClick={() => removeQueryRow(row.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t(locale, 'request.headers')}</label>
              <textarea
                className="mt-1 min-h-[100px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                value={headersText}
                onChange={(event) => setHeadersText(event.target.value)}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t(locale, 'request.body')}</label>
              <textarea
                className="mt-1 min-h-[120px] w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-800"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                className="w-40 rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
                placeholder={t(locale, 'request.timeout')}
              />
              <button
                type="button"
                className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? t(locale, 'request.sending') : t(locale, 'request.send')}
              </button>
            </div>

            {error && <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>}
            {sendError && <div className="text-xs text-rose-600 dark:text-rose-400">{sendError}</div>}
          </div>
        )}
      </div>

      <ResponsePanel locale={locale} response={response} />
    </div>
  )
}

function PlainPre({ code }: { code: string }) {
  return (
    <pre className="mt-1 max-h-52 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
      {code || '—'}
    </pre>
  )
}

function LazyPrismHighlight({ code, language }: { code: string; language: 'json' | 'markup' }) {
  const isDark = useIsDarkClass()
  const [lib, setLib] = useState<{
    Highlight: typeof import('prism-react-renderer').Highlight
    themes: typeof import('prism-react-renderer').themes
  } | null>(null)
  const [loadError, setLoadError] = useState(false)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      import('prismjs/components/prism-json'),
      import('prismjs/components/prism-markup'),
      import('prism-react-renderer')
    ])
      .then(([, , mod]) => {
        if (cancelled) return
        setLib({ Highlight: mod.Highlight, themes: mod.themes })
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  if (loadError || !lib) return <PlainPre code={code} />
  const { Highlight, themes } = lib
  const prismTheme = isDark ? themes.oneDark : themes.oneLight
  return (
    <Highlight theme={prismTheme} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`mt-1 max-h-52 overflow-auto rounded border p-2 text-[11px] ${
            isDark ? 'border-slate-600 bg-slate-950' : 'border-slate-200 bg-slate-50'
          } ${className}`}
          style={style}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}

function SyntaxBlock({
  code,
  language
}: {
  code: string
  language: 'json' | 'markup' | 'plain'
}) {
  if (language === 'plain' || !code.trim()) {
    return <PlainPre code={code} />
  }
  return (
    <Suspense fallback={<PlainPre code={code} />}>
      <LazyPrismHighlight code={code} language={language} />
    </Suspense>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may fail */
    }
  }
  return (
    <button
      type="button"
      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      onClick={handleCopy}
      title={label}
    >
      {copied ? 'Копирано!' : 'Копирай'}
    </button>
  )
}

type ResponsePanelProps = {
  locale: AppSettings['locale']
  response: ResponseData | null
}

export function ResponsePanel({ locale, response }: ResponsePanelProps) {
  const parsedText =
    response?.parsedBody !== undefined ? JSON.stringify(response.parsedBody, null, 2) : ''
  const rawText = response?.body ?? '—'

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">{t(locale, 'response.title')}</h2>
      {!response && (
        <div className="mt-4 rounded border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {t(locale, 'response.none')}
        </div>
      )}
      {response && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span>Статус: {response.status || response.statusText}</span>
            <span>Време: {response.durationMs} ms</span>
            {response.parsedType && <span>Тип: {response.parsedType}</span>}
            {response.error && <span className="text-rose-600 dark:text-rose-400">{response.error}</span>}
          </div>

          {parsedText && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Parsed</span>
                <CopyButton text={parsedText} label="Копирай parsed отговор" />
              </div>
              <SyntaxBlock code={parsedText} language="json" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Raw</span>
              <CopyButton text={rawText} label="Копирай raw отговор" />
            </div>
            <SyntaxBlock
              code={rawText}
              language={
                response.parsedType === 'json'
                  ? 'json'
                  : response.parsedType === 'xml'
                    ? 'markup'
                    : 'plain'
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
