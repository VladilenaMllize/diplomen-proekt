import { Router } from 'express'
import { getConfig, updateConfig } from '../db/index.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getConfig())
})

router.put('/', (req, res) => {
  const body = req.body as { name?: string; version?: string }
  const config = updateConfig({
    name: body?.name !== undefined ? String(body.name) : undefined,
    version: body?.version !== undefined ? String(body.version) : undefined
  })
  res.json(config)
})

export { router as configRouter }
