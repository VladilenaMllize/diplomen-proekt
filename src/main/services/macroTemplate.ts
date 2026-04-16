import type { ResponseData } from '../../shared/types'

/**
 * Шаблони за макроси (само типове от shared; без IO).
 * App-wide `{{name}}`; оставя `{{stepN...}}` за подстановка от стъпки.
 */
export function substituteGlobals(text: string, globals: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_m, inner: string) => {
    const key = inner.trim()
    if (/^step\d+/i.test(key)) return `{{${inner}}}`
    return globals[key] ?? ''
  })
}

export function applyTemplateChain(
  text: string,
  globals: Record<string, string>,
  stepResults: Map<number, ResponseData>
): string {
  return substituteVariables(substituteGlobals(text, globals), stepResults)
}

export function substituteHeadersFull(
  headers: Record<string, string> | undefined,
  globals: Record<string, string>,
  stepResults: Map<number, ResponseData>
): Record<string, string> | undefined {
  if (!headers || Object.keys(headers).length === 0) return headers
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = applyTemplateChain(v, globals, stepResults)
  }
  return out
}

export function getByPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined
  const segments = path.split('.')
  let current: unknown = obj
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined
    const key = /^\d+$/.test(seg) ? Number.parseInt(seg, 10) : seg
    current =
      typeof current === 'object' && current !== null && key in current
        ? (current as Record<string | number, unknown>)[key]
        : undefined
  }
  return current
}

export function substituteVariables(text: string, stepResults: Map<number, ResponseData>): string {
  return text.replace(/\{\{step(\d+)(?:\.([^}]+))?\}\}/g, (_, stepNum, path) => {
    const n = Number.parseInt(stepNum, 10)
    const response = stepResults.get(n)
    if (!response) return ''
    if (!path || path.trim() === '') return response.body ?? ''
    if (path.trim() === 'status') return String(response.status)
    const value = getByPath(response.parsedBody, path.trim())
    if (value === undefined) return ''
    return typeof value === 'object' || typeof value === 'boolean'
      ? JSON.stringify(value)
      : String(value)
  })
}

export function substituteHeaders(
  headers: Record<string, string> | undefined,
  stepResults: Map<number, ResponseData>
): Record<string, string> | undefined {
  if (!headers || Object.keys(headers).length === 0) return headers
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = substituteVariables(v, stepResults)
  }
  return out
}

