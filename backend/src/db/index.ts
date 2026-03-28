import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import type { Sensor } from '../data.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../../data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
const dbPath = path.join(dataDir, 'sensors.db')

const db = new Database(dbPath)

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY,
    value REAL NOT NULL DEFAULT 0,
    unit TEXT
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// Seed initial data if empty
const sensorCount = db.prepare('SELECT COUNT(*) as c FROM sensors').get() as { c: number }
if (sensorCount.c === 0) {
  const insert = db.prepare('INSERT INTO sensors (id, value, unit) VALUES (?, ?, ?)')
  insert.run('temp1', 22.5, '°C')
  insert.run('humidity1', 65, '%')
  insert.run('pressure1', 1013, 'hPa')
}

const configCount = db.prepare('SELECT COUNT(*) as c FROM config').get() as { c: number }
if (configCount.c === 0) {
  const insert = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)')
  insert.run('name', 'Sensor Hub')
  insert.run('version', '1.0.0')
}

export function getAllSensors(): Sensor[] {
  const rows = db.prepare('SELECT id, value, unit FROM sensors').all() as { id: string; value: number; unit: string | null }[]
  return rows.map((r) => ({ id: r.id, value: r.value, unit: r.unit ?? undefined }))
}

export function listSensorsPaged(options: { page?: number; limit?: number; q?: string }): {
  items: Sensor[]
  page: number
  limit: number
  total: number
} {
  let rows = getAllSensors()
  const q = options.q?.trim().toLowerCase()
  if (q) {
    rows = rows.filter(
      (s) => s.id.toLowerCase().includes(q) || (s.unit ?? '').toLowerCase().includes(q)
    )
  }
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(100, Math.max(1, options.limit ?? 50))
  const total = rows.length
  const start = (page - 1) * limit
  const items = rows.slice(start, start + limit)
  return { items, page, limit, total }
}

export function upsertSensor(sensor: { id: string; value?: number; unit?: string }): Sensor {
  const existing = db.prepare('SELECT * FROM sensors WHERE id = ?').get(sensor.id) as { id: string; value: number; unit: string | null } | undefined
  const value = typeof sensor.value === 'number' ? sensor.value : existing?.value ?? 0
  const unit = sensor.unit ?? existing?.unit ?? null

  db.prepare('INSERT INTO sensors (id, value, unit) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET value = ?, unit = ?')
    .run(sensor.id, value, unit, value, unit)

  return { id: sensor.id, value, unit: unit ?? undefined }
}

export function getConfig(): { name: string; version: string } {
  const rows = db.prepare('SELECT key, value FROM config').all() as { key: string; value: string }[]
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    name: map.name ?? 'Sensor Hub',
    version: map.version ?? '1.0.0'
  }
}

export function updateConfig(updates: { name?: string; version?: string }): { name: string; version: string } {
  const stmt = db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
  if (updates.name !== undefined) stmt.run('name', updates.name, updates.name)
  if (updates.version !== undefined) stmt.run('version', updates.version, updates.version)
  return getConfig()
}
