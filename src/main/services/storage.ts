import { app } from 'electron'
import { promises as fs } from 'fs'
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

export async function initStore() {
  store = await loadStore()
}

export function getStore(): Store {
  return store
}

export async function updateStore(mutator: (current: Store) => void) {
  mutator(store)
  await writeStore(store)
}

async function loadStore(): Promise<Store> {
  const filePath = getStorePath()
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Store>
    return normalizeStore(parsed)
  } catch (error) {
    const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
    if (code === 'ENOENT') {
      return DEFAULT_STORE
    }
    return DEFAULT_STORE
  }
}

async function writeStore(nextStore: Store) {
  const filePath = getStorePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(nextStore, null, 2), 'utf-8')
}

function getStorePath() {
  return path.join(app.getPath('userData'), 'store.json')
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
