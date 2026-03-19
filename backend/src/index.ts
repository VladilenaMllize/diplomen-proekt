import express from 'express'
import { healthRouter } from './routes/health.js'
import { sensorsRouter } from './routes/sensors.js'
import { configRouter } from './routes/config.js'

const app = express()
const basePort = Number(process.env.PORT) || 3000

app.use(express.json())
app.use('/health', healthRouter)
app.use('/sensors', sensorsRouter)
app.use('/config', configRouter)

function tryListen(port: number) {
  const server = app.listen(port, () => {
    console.log(`Backend on http://localhost:${port}`)
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
