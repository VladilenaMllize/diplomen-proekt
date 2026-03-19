export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type AuthType = 'none' | 'basic' | 'bearer' | 'apiKey'

export interface AuthConfig {
  type: AuthType
  basic?: {
    username: string
    password: string
  }
  bearer?: {
    token: string
  }
  apiKey?: {
    headerName: string
    value: string
  }
}

export interface DeviceHealthCheck {
  enabled: boolean
  path: string
  intervalSec: number
  timeoutMs?: number
}

export type DeviceStatusState = 'online' | 'offline' | 'unknown'

export interface DeviceStatus {
  state: DeviceStatusState
  lastCheckedAt?: number
  latencyMs?: number
  statusCode?: number
  error?: string
}

export interface Device {
  id: string
  name: string
  ip: string
  port: number
  protocol: 'http' | 'https'
  basePath?: string
  auth?: AuthConfig
  healthCheck?: DeviceHealthCheck
  status?: DeviceStatus
}

export type DeviceInput = Omit<Device, 'id' | 'status'> & {
  id?: string
  status?: DeviceStatus
}

export interface RequestOptions {
  deviceId: string
  method: HttpMethod
  path: string
  headers?: Record<string, string>
  body?: string
  authOverride?: AuthConfig
  timeoutMs?: number
}

export type ResponseParsedType = 'json' | 'xml' | 'text'

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  parsedType?: ResponseParsedType
  parsedBody?: unknown
  durationMs: number
  error?: string
}

export interface HistoryEntry {
  id: string
  deviceId: string
  method: HttpMethod
  path: string
  url: string
  headers: Record<string, string>
  body?: string
  timestamp: number
  response?: ResponseData
}

export interface MacroStep {
  id: string
  name?: string
  method: HttpMethod
  path: string
  headers?: Record<string, string>
  body?: string
  delayMs?: number
}

export interface MacroFolder {
  id: string
  name: string
  parentId?: string
}

export interface Macro {
  id: string
  name: string
  deviceId: string
  steps: MacroStep[]
  folderId?: string
  createdAt: number
  updatedAt: number
}

export type MacroInput = Omit<Macro, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: number
  updatedAt?: number
}

export interface MacroRunResult {
  macroId: string
  startedAt: number
  finishedAt: number
  results: Array<{
    stepId: string
    response?: ResponseData
    error?: string
  }>
}

export interface Store {
  version: number
  devices: Device[]
  macros: Macro[]
  folders: MacroFolder[]
  history: HistoryEntry[]
}

export interface DeviceStatusUpdate {
  deviceId: string
  status: DeviceStatus
}
