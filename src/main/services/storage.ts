import { app } from 'electron'
import { existsSync, promises as fs } from 'fs'
import path from 'path'
import type { Store } from '../../shared/types'

const STORE_VERSION = 2
const DEFAULT_STORE: Store = {
  version: STORE_VERSION,
  devices: [],
  macros: [],
  folders: [],
  history: []
}

let store: Store = DEFAULT_STORE
let loadStartupError: string | null = null

export function consumeStoreLoadError(): string | null {
  const message = loadStartupError
  loadStartupError = null
  return message
}

export async function initStore() {
  store = await loadStore()
}

export function getStore(): Store {
  return store
}

export async function updateStore(mutator: (current: Store) => void) {
  mutator(store)
  await writeStoreToDisk(store)
}

async function loadStore(): Promise<Store> {
  const filePath = getStorePath()
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
      return DEFAULT_STORE
    }

    const fromBackup = await tryParseFile(backupPath)
    if (fromBackup) {
      loadStartupError =
        'Основният файл store.json е повреден. Възстановени са данни от резервно копие (store.json.bak).'
      await writeStoreToDisk(fromBackup)
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
    return DEFAULT_STORE
  }
}

async function writeStoreToDisk(nextStore: Store) {
  const filePath = getStorePath()
  const backupPath = getBackupPath()
  const tmpPath = `${filePath}.tmp`
  const payload = JSON.stringify(nextStore, null, 2)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(tmpPath, payload, 'utf-8')
  try {
    if (existsSync(filePath)) {
      await fs.copyFile(filePath, backupPath)
    }
  } catch {
    /* best-effort backup of previous main file */
  }
  try {
    await fs.rename(tmpPath, filePath)
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {})
    throw err
  }
}

function getStorePath() {
  return path.join(app.getPath('userData'), 'store.json')
}

function getBackupPath() {
  return path.join(app.getPath('userData'), 'store.json.bak')
}

function normalizeStore(input: Partial<Store>): Store {
  return {
    version: STORE_VERSION,
    devices: Array.isArray(input.devices) ? input.devices : [],
    macros: Array.isArray(input.macros) ? input.macros : [],
    folders: Array.isArray(input.folders) ? input.folders : [],
    history: Array.isArray(input.history) ? input.history : []
  }
}
