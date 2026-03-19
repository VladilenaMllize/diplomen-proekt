import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime())
  })
})

export { router as healthRouter }
