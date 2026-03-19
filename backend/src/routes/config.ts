import { Router } from 'express'
import { config } from '../data.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(config)
})

router.put('/', (req, res) => {
  const body = req.body as { name?: string; version?: string }
  if (body?.name !== undefined) config.name = String(body.name)
  if (body?.version !== undefined) config.version = String(body.version)
  res.json(config)
})

export { router as configRouter }
