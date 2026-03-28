import { Router } from 'express'
import { z } from 'zod'
import { getAllSensors, listSensorsPaged, upsertSensor } from '../db/index.js'
import { broadcastSensorUpdate } from '../realtime.js'

const router = Router()

const upsertSchema = z.object({
  id: z.string().min(1, 'id required'),
  value: z.number().finite().optional(),
  unit: z.string().nullable().optional()
})

router.get('/', (req, res) => {
  const page = req.query.page ? Number(req.query.page) : undefined
  const limit = req.query.limit ? Number(req.query.limit) : undefined
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  const result = listSensorsPaged({
    page: Number.isFinite(page) ? page : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    q
  })
  res.json(result)
})

router.post('/', (req, res) => {
  const parsed = upsertSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors })
    return
  }
  const body = parsed.data
  const existed = getAllSensors().some((s) => s.id === body.id)
  const sensor = upsertSensor({
    id: body.id,
    value: body.value,
    unit: body.unit === null ? undefined : body.unit
  })
  broadcastSensorUpdate(sensor)
  res.status(existed ? 200 : 201).json(sensor)
})

export { router as sensorsRouter }
