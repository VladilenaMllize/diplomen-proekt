import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const

export type VaultEnvelope = {
  v: 1
  salt: string
  iv: string
  tag: string
  ciphertext: string
}

export function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, SCRYPT_OPTS)
}

export function encryptPayloadWithKey(plaintext: string, key: Buffer, saltB64: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const env: VaultEnvelope = {
    v: 1,
    salt: saltB64,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64')
  }
  return JSON.stringify(env)
}

export function decryptPayloadWithKey(envelopeStr: string, key: Buffer): string {
  const env = JSON.parse(envelopeStr) as VaultEnvelope
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(env.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8')
}

export function sealWithNewPassword(plaintext: string, password: string): { envelope: string; key: Buffer; saltB64: string } {
  const salt = randomBytes(16)
  const saltB64 = salt.toString('base64')
  const key = deriveKey(password, salt)
  const envelope = encryptPayloadWithKey(plaintext, key, saltB64)
  return { envelope, key, saltB64 }
}

export function tryOpenWithPassword(
  envelopeStr: string,
  password: string
): { ok: true; plaintext: string; key: Buffer; saltB64: string } | { ok: false } {
  try {
    const env = JSON.parse(envelopeStr) as VaultEnvelope
    if (env.v !== 1 || !env.salt || !env.iv || !env.tag || !env.ciphertext) return { ok: false }
    const salt = Buffer.from(env.salt, 'base64')
    const key = deriveKey(password, salt)
    const plaintext = decryptPayloadWithKey(envelopeStr, key)
    return { ok: true, plaintext, key, saltB64: env.salt }
  } catch {
    return { ok: false }
  }
}
