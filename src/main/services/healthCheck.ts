import type { Device, DeviceStatus } from '../../shared/types'
import { buildRequestHeaders, buildUrl, sendHttpRequest } from './httpClient'

const DEFAULT_TIMEOUT_MS = 5000
const MIN_INTERVAL_SEC = 5

export class HealthCheckManager {
  private timers = new Map<string, NodeJS.Timeout>()
  private running = new Set<string>()

  constructor(private onUpdate: (deviceId: string, status: DeviceStatus) => void) {}

  sync(devices: Device[]) {
    this.clearAll()

    devices
      .filter((device) => device.healthCheck?.enabled)
      .forEach((device) => {
        const interval = Math.max(
          MIN_INTERVAL_SEC,
          device.healthCheck?.intervalSec ?? 30
        )
        const timer = setInterval(() => this.checkDevice(device), interval * 1000)
        this.timers.set(device.id, timer)
        this.checkDevice(device)
      })
  }

  stop(deviceId: string) {
    const timer = this.timers.get(deviceId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(deviceId)
    }
  }

  clearAll() {
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
  }

  private async checkDevice(device: Device) {
    if (this.running.has(device.id)) {
      return
    }

    this.running.add(device.id)
    try {
      const healthPath = device.healthCheck?.path?.trim() || '/health'
      const timeoutMs = device.healthCheck?.timeoutMs ?? DEFAULT_TIMEOUT_MS

      const headers = buildRequestHeaders(undefined, device.auth)
      const url = buildUrl(device, healthPath)
      const response = await sendHttpRequest({
        url,
        method: 'GET',
        headers,
        timeoutMs
      })

      const status: DeviceStatus = {
        state: response.error
          ? 'offline'
          : response.status >= 200 && response.status < 400
            ? 'online'
            : 'offline',
        lastCheckedAt: Date.now(),
        latencyMs: response.durationMs,
        statusCode: response.status,
        error: response.error
      }

      this.onUpdate(device.id, status)
    } finally {
      this.running.delete(device.id)
    }
  }
}
