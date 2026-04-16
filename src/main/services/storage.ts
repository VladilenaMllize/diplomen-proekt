/** Пътища към userData и интеграция с Electron при запис на файлове. */
import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import path from 'path'

import type { AppSettings, Store } from '../../shared/types'
/** Шифроване на полета за автентикация чрез OS safeStorage преди JSON на диска. */
import { deserializeAuthFromDisk, serializeAuthForDisk } from './authSecrets'
/** AES-GCM обвивка за целия store (vault файл) и derive от парола. */
import {
  decryptPayloadWithKey,
  encryptPayloadWithKey,
  sealWithNewPassword,
  tryOpenWithPassword
} from './vaultCrypto'
/** Гейт преди достъп до store: приложната сесия трябва да е отключена. */
import { isAppSessionUnlocked } from './appAuth'

const STORE_VERSION = 3

const defaultSettings: AppSettings = {
  theme: 'light',
  locale: 'bg',
  globalVariables: {},
  security: { idleLockMinutes: 0 }
}

const DEFAULT_STORE: Store = {
  version: STORE_VERSION,
  settings: {
    ...defaultSettings,
    globalVariables: { ...defaultSettings.globalVariables },
    security: { ...defaultSettings.security }
  },
  devices: [],
  macros: [],
  folders: [],
  history: []
}

let store: Store = structuredClone(DEFAULT_STORE)
let loadStartupError: string | null = null

/** Encrypted file exists on disk */
let vaultFileOnDisk = false
/** User entered password this session (or plain JSON mode) */
let vaultSessionUnlocked = true
/** AES key for vault file; cleared on lock */
let vaultSessionKey: Buffer | null = null
let vaultSaltB64: string | null = null

export function consumeStoreLoadError(): string | null {
  const message = loadStartupError
  loadStartupError = null
  return message
}

export function isVaultLockedForUse(): boolean {
  return vaultFileOnDisk && !vaultSessionUnlocked
}

export function getVaultStatus(): { diskEncrypted: boolean; unlocked: boolean } {
  return { diskEncrypted: vaultFileOnDisk, unlocked: vaultSessionUnlocked }
}

export function getStore(): Store {
  if (!isAppSessionUnlocked()) {
    throw new Error('APP_AUTH_LOCKED')
  }
  if (isVaultLockedForUse()) {
    throw new Error('VAULT_LOCKED')
  }
  return store
}

export async function initStore() {
  loadStartupError = null
  vaultSessionKey = null
  vaultSaltB64 = null

  const vaultPath = getVaultPath()
  const jsonPath = getStorePath()

  if (existsSync(vaultPath)) {
    vaultFileOnDisk = true
    vaultSessionUnlocked = false
    store = structuredClone(DEFAULT_STORE)
    return
  }

  vaultFileOnDisk = false
  vaultSessionUnlocked = true
  store = await loadPlainJsonStore(jsonPath)
}

async function loadPlainJsonStore(filePath: string): Promise<Store> {
  const backupPath = getBackupPath()

  const tryParseFile = async (file: string): Promise<Store | null> => {
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<Store>
      return normalizeStore(parsed)
    } catch {
      return null
    }
  }

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Store>
    return normalizeStore(parsed)
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
    if (code === 'ENOENT') {
      return structuredClone(DEFAULT_STORE)
    }

    const fromBackup = await tryParseFile(backupPath)
    if (fromBackup) {
      loadStartupError =
        'Основният файл store.json е повреден. Възстановени са данни от резервно копие (store.json.bak).'
      await writePlainStoreToDisk(fromBackup)
      return fromBackup
    }

    try {
      const corruptName = `${filePath}.corrupt.${Date.now()}`
      await fs.rename(filePath, corruptName)
    } catch {
      /* ignore */
    }

    loadStartupError =
      'Неуспешно четене на данните (store.json). Стартиране с празни данни. Повреденият файл е запазен с разширение .corrupt.'
    return structuredClone(DEFAULT_STORE)
  }
}

function buildDiskPayload(nextStore: Store): string {
  const forDisk: Store = {
    ...nextStore,
    devices: nextStore.devices.map((d) => ({
      ...d,
      auth: serializeAuthForDisk(d.auth)
    }))
  }
  return JSON.stringify(forDisk, null, 2)
}

async function writePlainStoreToDisk(nextStore: Store) {
  const filePath = getStorePath()
  const backupPath = getBackupPath()
  const tmpPath = `${filePath}.tmp`
  const payload = buildDiskPayload(nextStore)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(tmpPath, payload, 'utf-8')
  try {
    if (existsSync(filePath)) {
      await fs.copyFile(filePath, backupPath)
    }
  } catch {
    /* best-effort */
  }
  try {
    await fs.rename(tmpPath, filePath)
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {})
    throw err
  }
}

async function writeVaultStoreToDisk() {
  if (!vaultSessionKey || !vaultSaltB64) {
    throw new Error('Vault key missing')
  }
  const payload = buildDiskPayload(store)
  const envelope = encryptPayloadWithKey(payload, vaultSessionKey, vaultSaltB64)
  const vaultPath = getVaultPath()
  const tmpPath = `${vaultPath}.tmp`
  await fs.mkdir(path.dirname(vaultPath), { recursive: true })
  await fs.writeFile(tmpPath, envelope, 'utf-8')
  await fs.rename(tmpPath, vaultPath)
  if (existsSync(getStorePath())) {
    await fs.unlink(getStorePath()).catch(() => {})
  }
}

export async function updateStore(mutator: (current: Store) => void) {
  if (!isAppSessionUnlocked()) {
    throw new Error('APP_AUTH_LOCKED')
  }
  if (isVaultLockedForUse()) {
    throw new Error('VAULT_LOCKED')
  }
  mutator(store)
  await writeStoreToDisk()
}

export async function writeStoreToDisk() {
  if (vaultFileOnDisk) {
    if (!vaultSessionUnlocked || !vaultSessionKey) {
      throw new Error('Cannot persist while vault is locked')
    }
    await writeVaultStoreToDisk()
  } else {
    await writePlainStoreToDisk(store)
  }
}

export async function unlockVault(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!vaultFileOnDisk) {
    return { ok: false, error: 'NO_VAULT' }
  }
  try {
    const raw = await fs.readFile(getVaultPath(), 'utf-8')
    const opened = tryOpenWithPassword(raw, password)
    if (!opened.ok) {
      return { ok: false, error: 'BAD_PASSWORD' }
    }
    let parsed: Partial<Store>
    try {
      parsed = JSON.parse(opened.plaintext) as Partial<Store>
    } catch {
      return { ok: false, error: 'CORRUPT' }
    }
    store = normalizeStore(parsed)
    vaultSessionKey = opened.key
    vaultSaltB64 = opened.saltB64
    vaultSessionUnlocked = true
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'UNLOCK_FAILED' }
  }
}

export async function lockVaultSession(): Promise<void> {
  if (!vaultFileOnDisk || !vaultSessionUnlocked) {
    return
  }
  if (vaultSessionKey && vaultSaltB64) {
    await writeVaultStoreToDisk()
  }
  vaultSessionKey = null
  vaultSaltB64 = null
  vaultSessionUnlocked = false
  store = structuredClone(DEFAULT_STORE)
}

export async function enableVault(password: string): Promise<{ ok: boolean; error?: string }> {
  if (vaultFileOnDisk) {
    return { ok: false, error: 'ALREADY_ENABLED' }
  }
  if (password.length < 8) {
    return { ok: false, error: 'PASSWORD_SHORT' }
  }
  try {
    const payload = buildDiskPayload(store)
    const { envelope, key, saltB64 } = sealWithNewPassword(payload, password)
    const vaultPath = getVaultPath()
    await fs.mkdir(path.dirname(vaultPath), { recursive: true })
    await fs.writeFile(vaultPath, envelope, 'utf-8')
    if (existsSync(getStorePath())) {
      await fs.unlink(getStorePath())
    }
    vaultFileOnDisk = true
    vaultSessionUnlocked = true
    vaultSessionKey = key
    vaultSaltB64 = saltB64
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'ENABLE_FAILED' }
  }
}

export async function disableVault(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!vaultFileOnDisk) {
    return { ok: false, error: 'NO_VAULT' }
  }
  try {
    const raw = await fs.readFile(getVaultPath(), 'utf-8')
    const opened = tryOpenWithPassword(raw, password)
    if (!opened.ok) {
      return { ok: false, error: 'BAD_PASSWORD' }
    }
    let parsed: Partial<Store>
    try {
      parsed = JSON.parse(opened.plaintext) as Partial<Store>
    } catch {
      return { ok: false, error: 'CORRUPT' }
    }
    store = normalizeStore(parsed)
    await writePlainStoreToDisk(store)
    await fs.unlink(getVaultPath())
    vaultFileOnDisk = false
    vaultSessionUnlocked = true
    vaultSessionKey = null
    vaultSaltB64 = null
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'DISABLE_FAILED' }
  }
}

export async function changeVaultPassword(
  currentPassword: string,
  nextPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!vaultFileOnDisk || !vaultSessionUnlocked || !vaultSessionKey) {
    return { ok: false, error: 'NOT_UNLOCKED' }
  }
  if (nextPassword.length < 8) {
    return { ok: false, error: 'PASSWORD_SHORT' }
  }
  try {
    const raw = await fs.readFile(getVaultPath(), 'utf-8')
    const check = tryOpenWithPassword(raw, currentPassword)
    if (!check.ok) {
      return { ok: false, error: 'BAD_PASSWORD' }
    }
    const payload = buildDiskPayload(store)
    const { envelope, key, saltB64 } = sealWithNewPassword(payload, nextPassword)
    await fs.writeFile(getVaultPath(), envelope, 'utf-8')
    vaultSessionKey = key
    vaultSaltB64 = saltB64
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'CHANGE_FAILED' }
  }
}

function getStorePath() {
  return path.join(app.getPath('userData'), 'store.json')
}

function getVaultPath() {
  return path.join(app.getPath('userData'), 'store.vault')
}

function getBackupPath() {
  return path.join(app.getPath('userData'), 'store.json.bak')
}

function normalizeStore(input: Partial<Store>): Store {
  const devices = Array.isArray(input.devices) ? input.devices : []
  const secIn = input.settings?.security
  const settings: AppSettings = {
    ...defaultSettings,
    ...(input.settings ?? {}),
    globalVariables: {
      ...defaultSettings.globalVariables,
      ...(input.settings?.globalVariables ?? {})
    },
    security: {
      idleLockMinutes:
        secIn?.idleLockMinutes ?? defaultSettings.security?.idleLockMinutes ?? 0
    }
  }
  return {
    version: STORE_VERSION,
    settings,
    devices: devices.map((d) => ({
      ...d,
      auth: deserializeAuthFromDisk(d.auth)
    })),
    macros: Array.isArray(input.macros) ? input.macros : [],
    folders: Array.isArray(input.folders) ? input.folders : [],
    history: Array.isArray(input.history) ? input.history : []
  }
}
