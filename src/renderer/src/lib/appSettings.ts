import type { AppSettings } from '@shared/types'

export function defaultAppSettings(): AppSettings {
  return {
    theme: 'light',
    locale: 'bg',
    globalVariables: {},
    security: { idleLockMinutes: 0 }
  }
}

export function parseGlobalsText(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (k) out[k] = v
  }
  return out
}
