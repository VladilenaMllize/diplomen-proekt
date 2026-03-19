export interface Sensor {
  id: string
  value: number
  unit?: string
}

export interface DeviceConfig {
  name: string
  version: string
}

export const sensors: Sensor[] = [
  { id: 'temp1', value: 22.5, unit: '°C' },
  { id: 'humidity1', value: 65, unit: '%' },
  { id: 'pressure1', value: 1013, unit: 'hPa' }
]

export let config: DeviceConfig = {
  name: 'Sensor Hub',
  version: '1.0.0'
}
