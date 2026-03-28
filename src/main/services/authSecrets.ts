import { safeStorage } from 'electron'
import type { AuthConfig } from '../../shared/types'

function encrypt(plain: string): string {
  return safeStorage.encryptString(plain).toString('base64')
}

function decrypt(encB64: string): string {
  return safeStorage.decryptString(Buffer.from(encB64, 'base64'))
}

/** Shape written to disk (no plaintext secrets when encryption works). */
export function serializeAuthForDisk(auth: AuthConfig | undefined): AuthConfig | undefined {
  if (!auth || auth.type === 'none') return auth
  if (!safeStorage.isEncryptionAvailable()) return auth

  if (auth.type === 'basic' && auth.basic) {
    const { username, password, passwordEnc } = auth.basic
    const next: AuthConfig = { type: 'basic', basic: { username } }
    if (password) next.basic!.passwordEnc = encrypt(password)
    else if (passwordEnc) next.basic!.passwordEnc = passwordEnc
    return next
  }

  if (auth.type === 'bearer' && auth.bearer) {
    const { token, tokenEnc } = auth.bearer
    const next: AuthConfig = { type: 'bearer', bearer: {} }
    if (token) next.bearer!.tokenEnc = encrypt(token)
    else if (tokenEnc) next.bearer!.tokenEnc = tokenEnc
    return next
  }

  if (auth.type === 'apiKey' && auth.apiKey) {
    const { headerName, value, valueEnc } = auth.apiKey
    const next: AuthConfig = {
      type: 'apiKey',
      apiKey: { headerName: headerName || 'X-API-Key' }
    }
    if (value) next.apiKey!.valueEnc = encrypt(value)
    else if (valueEnc) next.apiKey!.valueEnc = valueEnc
    return next
  }

  return auth
}

/** Restore plaintext fields for in-memory store and renderer. */
export function deserializeAuthFromDisk(auth: AuthConfig | undefined): AuthConfig | undefined {
  if (!auth || auth.type === 'none') return auth
  if (!safeStorage.isEncryptionAvailable()) return auth

  try {
    if (auth.type === 'basic' && auth.basic) {
      const { username, passwordEnc, password } = auth.basic
      if (passwordEnc && !password) {
        return {
          type: 'basic',
          basic: { username, password: decrypt(passwordEnc) }
        }
      }
      return auth
    }

    if (auth.type === 'bearer' && auth.bearer) {
      const { tokenEnc, token } = auth.bearer
      if (tokenEnc && !token) {
        return { type: 'bearer', bearer: { token: decrypt(tokenEnc) } }
      }
      return auth
    }

    if (auth.type === 'apiKey' && auth.apiKey) {
      const { headerName, valueEnc, value } = auth.apiKey
      if (valueEnc && !value) {
        return {
          type: 'apiKey',
          apiKey: { headerName: headerName || 'X-API-Key', value: decrypt(valueEnc) }
        }
      }
      return auth
    }
  } catch {
    return auth
  }

  return auth
}
