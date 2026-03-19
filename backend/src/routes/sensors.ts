import { Router } from 'express'
import { sensors } from '../data.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(sensors)
})

router.post('/', (req, res) => {
  const body = req.body as { id?: string; value?: number; unit?: string }
  if (!body || typeof body.id !== 'string') {
    res.status(400).json({ error: 'Invalid body: id required' })
    return
  }
  const existing = sensors.find((s) => s.id === body.id)
  if (existing) {
    if (typeof body.value === 'number') existing.value = body.value
    if (body.unit !== undefined) existing.unit = body.unit
    res.json(existing)
  } else {
    const sensor = {
      id: body.id,
      value: typeof body.value === 'number' ? body.value : 0,
      unit: body.unit
    }
    sensors.push(sensor)
    res.status(201).json(sensor)
  }
})

export { router as sensorsRouter }
