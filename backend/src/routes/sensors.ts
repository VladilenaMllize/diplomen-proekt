import { Router } from 'express'
import { getAllSensors, upsertSensor } from '../db/index.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(getAllSensors())
})

router.post('/', (req, res) => {
  const body = req.body as { id?: string; value?: number; unit?: string }
  if (!body || typeof body.id !== 'string') {
    res.status(400).json({ error: 'Invalid body: id required' })
    return
  }
  const id = body.id as string
  const existed = getAllSensors().some((s) => s.id === id)
  const sensor = upsertSensor({ id, value: body.value, unit: body.unit })
  res.status(existed ? 200 : 201).json(sensor)
})

export { router as sensorsRouter }
