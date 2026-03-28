import { Router } from 'express'
import { z } from 'zod'
import { getConfig, updateConfig } from '../db/index.js'

const router = Router()

const putSchema = z
  .object({
    name: z.string().min(1).optional(),
    version: z.string().min(1).optional()
  })
  .refine((data) => data.name !== undefined || data.version !== undefined, {
    message: 'At least one of name, version required'
  })

router.get('/', (_req, res) => {
  res.json(getConfig())
})

router.put('/', (req, res) => {
  const parsed = putSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const config = updateConfig({
    name: parsed.data.name,
    version: parsed.data.version
  })
  res.json(config)
})

export { router as configRouter }
