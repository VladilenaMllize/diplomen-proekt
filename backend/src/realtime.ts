import { WebSocket, type WebSocketServer } from 'ws'
import type { Sensor } from './data.js'

let wss: WebSocketServer | null = null

export function setSensorHubWss(server: WebSocketServer) {
  wss = server
}

export function broadcastSensorUpdate(sensor: Sensor) {
  if (!wss) return
  const msg = JSON.stringify({ type: 'sensor:upsert', payload: sensor })
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg)
  }
}
