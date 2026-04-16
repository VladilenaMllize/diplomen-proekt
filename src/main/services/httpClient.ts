/** Парсер за XML отговори (вградени/индустриални API). */
import { XMLParser } from 'fast-xml-parser'

import type { AuthConfig, HttpMethod, ResponseData } from '../../shared/types'

const xmlParser = new XMLParser({
  ignoreAttributes: false
})

export function buildUrl(device: { protocol: string; ip: string; port: number; basePath?: string }, path: string): string {
  const trimmedPath = path?.trim() ?? ''
  if (/^https?:\/\//i.test(trimmedPath)) {
    return trimmedPath
  }

  const basePath = normalizeBasePath(device.basePath)
  const requestPath = normalizeRequestPath(trimmedPath)

  return `${device.protocol}://${device.ip}:${device.port}${basePath}${requestPath}`
}

export function buildUrlWithQuery(
  device: { protocol: string; ip: string; port: number; basePath?: string },
  path: string,
  query?: Record<string, string>
): string {
  let url = buildUrl(device, path)
  if (!query || Object.keys(query).length === 0) return url
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.append(k, v)
  }
  const qs = params.toString()
  if (!qs) return url
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

export function buildRequestHeaders(
  baseHeaders: Record<string, string> | undefined,
  auth?: AuthConfig
): Record<string, string> {
  const headers: Record<string, string> = { ...(baseHeaders ?? {}) }

  if (!auth || auth.type === 'none') {
    return headers
  }

  if (auth.type === 'basic' && auth.basic) {
    const password = auth.basic.password ?? ''
    const token = Buffer.from(`${auth.basic.username}:${password}`).toString('base64')
    headers.Authorization = `Basic ${token}`
  }

  if (auth.type === 'bearer' && auth.bearer) {
    headers.Authorization = `Bearer ${auth.bearer.token ?? ''}`
  }

  if (auth.type === 'apiKey' && auth.apiKey) {
    const headerName = auth.apiKey.headerName?.trim() || 'X-API-Key'
    headers[headerName] = auth.apiKey.value ?? ''
  }

  return headers
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase()
    if (lower === 'authorization' || lower.includes('api-key') || lower.includes('apikey')) {
      redacted[key] = '***'
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

export async function sendHttpRequest(input: {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body?: string
  timeoutMs?: number
}): Promise<ResponseData> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeoutMs = input.timeoutMs ?? 10000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const shouldSendBody = input.body && !['GET', 'DELETE'].includes(input.method)
    const response = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: shouldSendBody ? input.body : undefined,
      signal: controller.signal
    })

    const bodyText = await response.text()
    const durationMs = Date.now() - startedAt
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    const { parsedBody, parsedType } = parseBody(bodyText, headers['content-type'])

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      body: bodyText,
      parsedBody,
      parsedType,
      durationMs
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    return {
      status: 0,
      statusText: 'ERROR',
      headers: {},
      body: '',
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeBasePath(value?: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  const withoutSlashes = trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
  return withoutSlashes ? `/${withoutSlashes}` : ''
}

function normalizeRequestPath(value?: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  const withoutLeading = trimmed.replace(/^\/+/, '')
  return `/${withoutLeading}`
}

function parseBody(bodyText: string, contentType?: string) {
  const trimmed = bodyText.trim()
  if (!trimmed) {
    return { parsedBody: undefined, parsedType: undefined }
  }

  const normalizedType = contentType?.toLowerCase() ?? ''

  if (normalizedType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return { parsedBody: JSON.parse(trimmed), parsedType: 'json' as const }
    } catch {
      return { parsedBody: undefined, parsedType: 'text' as const }
    }
  }

  if (normalizedType.includes('xml') || trimmed.startsWith('<')) {
    try {
      return { parsedBody: xmlParser.parse(trimmed), parsedType: 'xml' as const }
    } catch {
      return { parsedBody: undefined, parsedType: 'text' as const }
    }
  }

  return { parsedBody: undefined, parsedType: 'text' as const }
}
