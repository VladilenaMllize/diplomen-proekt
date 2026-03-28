import type { AuthType, Device, DeviceInput } from '@shared/types'

export type DeviceFormState = {
  id?: string
  name: string
  ip: string
  port: string
  protocol: 'http' | 'https'
  basePath: string
  authType: AuthType
  username: string
  password: string
  token: string
  apiKeyHeader: string
  apiKeyValue: string
  healthEnabled: boolean
  healthPath: string
  healthInterval: string
  healthTimeout: string
}

export const authTypes: AuthType[] = ['none', 'basic', 'bearer', 'apiKey']

export function createEmptyDeviceForm(): DeviceFormState {
  return {
    name: '',
    ip: '',
    port: '80',
    protocol: 'http',
    basePath: '',
    authType: 'none',
    username: '',
    password: '',
    token: '',
    apiKeyHeader: 'X-API-Key',
    apiKeyValue: '',
    healthEnabled: false,
    healthPath: '/health',
    healthInterval: '30',
    healthTimeout: ''
  }
}

export function deviceToForm(device?: Device | null): DeviceFormState {
  if (!device) {
    return createEmptyDeviceForm()
  }

  return {
    id: device.id,
    name: device.name ?? '',
    ip: device.ip ?? '',
    port: String(device.port ?? 80),
    protocol: device.protocol ?? 'http',
    basePath: device.basePath ?? '',
    authType: device.auth?.type ?? 'none',
    username: device.auth?.basic?.username ?? '',
    password: device.auth?.basic?.password ?? '',
    token: device.auth?.bearer?.token ?? '',
    apiKeyHeader: device.auth?.apiKey?.headerName ?? 'X-API-Key',
    apiKeyValue: device.auth?.apiKey?.value ?? '',
    healthEnabled: device.healthCheck?.enabled ?? false,
    healthPath: device.healthCheck?.path ?? '/health',
    healthInterval: String(device.healthCheck?.intervalSec ?? 30),
    healthTimeout: device.healthCheck?.timeoutMs ? String(device.healthCheck.timeoutMs) : ''
  }
}

export function formToDeviceInput(form: DeviceFormState): DeviceInput {
  const portValue = Number(form.port)
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : 80
  const basePath = form.basePath.trim()
  const authType = form.authType ?? 'none'

  const auth =
    authType === 'basic'
      ? {
          type: 'basic' as const,
          basic: {
            username: form.username,
            password: form.password
          }
        }
      : authType === 'bearer'
        ? {
            type: 'bearer' as const,
            bearer: {
              token: form.token
            }
          }
        : authType === 'apiKey'
          ? {
              type: 'apiKey' as const,
              apiKey: {
                headerName: form.apiKeyHeader || 'X-API-Key',
                value: form.apiKeyValue
              }
            }
          : { type: 'none' as const }

  const intervalValue = Number(form.healthInterval)
  const timeoutValue = Number(form.healthTimeout)

  return {
    id: form.id,
    name: form.name,
    ip: form.ip,
    port,
    protocol: form.protocol,
    basePath: basePath.length ? basePath : undefined,
    auth,
    healthCheck: {
      enabled: form.healthEnabled,
      path: form.healthPath || '/health',
      intervalSec: Number.isFinite(intervalValue) && intervalValue > 0 ? intervalValue : 30,
      timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : undefined
    }
  }
}
