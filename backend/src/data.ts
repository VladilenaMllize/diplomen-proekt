export interface Sensor {
  id: string
  value: number
  unit?: string
}

export interface DeviceConfig {
  name: string
  version: string
}
