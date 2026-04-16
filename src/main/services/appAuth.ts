/** Персистентен файл под userData за локален акаунт (не се бърка с vault store). */
import { app } from 'electron'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { existsSync, promises as fs } from 'fs'
import path from 'path'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

export type AppAuthRecord = {
  username: string
  salt: string
  hash: string
}

let sessionUnlocked = false

function authPath(): string {
  return path.join(app.getPath('userData'), 'app-auth.json')
}

export function hasAuthAccount(): boolean {
  return existsSync(authPath())
}

export async function readAuthRecord(): Promise<AppAuthRecord | null> {
  try {
    const raw = await fs.readFile(authPath(), 'utf-8')
    const p = JSON.parse(raw) as AppAuthRecord
    if (!p.username || typeof p.salt !== 'string' || typeof p.hash !== 'string') return null
    return p
  } catch {
    return null
  }
}

export function isAppSessionUnlocked(): boolean {
  return sessionUnlocked
}

export function lockAppSession(): void {
  sessionUnlocked = false
}

function hashPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P })
}

export async function registerAccount(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  if (hasAuthAccount()) {
    return { ok: false, error: 'EXISTS' }
  }
  const u = username.trim()
  if (u.length < 2) {
    return { ok: false, error: 'USERNAME_SHORT' }
  }
  if (password.length < 8) {
    return { ok: false, error: 'PASSWORD_SHORT' }
  }
  const salt = randomBytes(16)
  const hash = hashPassword(password, salt)
  const rec: AppAuthRecord = {
    username: u,
    salt: salt.toString('hex'),
    hash: hash.toString('hex')
  }
  await fs.mkdir(path.dirname(authPath()), { recursive: true })
  await fs.writeFile(authPath(), JSON.stringify(rec), 'utf-8')
  sessionUnlocked = true
  return { ok: true }
}

export async function verifyLogin(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const rec = await readAuthRecord()
  if (!rec) {
    return { ok: false, error: 'NO_ACCOUNT' }
  }
  if (rec.username !== username.trim()) {
    return { ok: false, error: 'BAD_CREDENTIALS' }
  }
  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(rec.salt, 'hex')
    expected = Buffer.from(rec.hash, 'hex')
  } catch {
    return { ok: false, error: 'BAD_CREDENTIALS' }
  }
  const actual = hashPassword(password, salt)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, error: 'BAD_CREDENTIALS' }
  }
  sessionUnlocked = true
  return { ok: true }
}
