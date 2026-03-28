import express from 'express'
import rateLimit from 'express-rate-limit'
import { readFileSync } from 'fs'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import { healthRouter } from './routes/health.js'
import { sensorsRouter } from './routes/sensors.js'
import { configRouter } from './routes/config.js'
import { setSensorHubWss } from './realtime.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const basePort = Number(process.env.PORT) || 3000

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
)

app.use(express.json())

app.get('/openapi.yaml', (_req, res) => {
  const specPath = path.join(__dirname, '../openapi.yaml')
  try {
    const yaml = readFileSync(specPath, 'utf-8')
    res.type('application/yaml').send(yaml)
  } catch {
    res.status(404).send('OpenAPI spec not found')
  }
})

app.use('/health', healthRouter)
app.use('/sensors', sensorsRouter)
app.use('/config', configRouter)

const server = createServer(app)

const wss = new WebSocketServer({ server, path: '/ws' })
setSensorHubWss(wss)

function tryListen(port: number) {
  server.listen(port, () => {
    console.log(`Backend on http://localhost:${port}`)
    console.log(`OpenAPI: http://localhost:${port}/openapi.yaml  WebSocket: ws://localhost:${port}/ws`)
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && port < basePort + 10) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`)
      tryListen(port + 1)
    } else {
      console.error(err)
      process.exit(1)
    }
  })
}

tryListen(basePort)
