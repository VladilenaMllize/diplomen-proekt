import { test, expect } from '@playwright/test'

test.describe('Mock sensor backend', () => {
  test('health, paginated sensors, zod validation, config update', async ({ request }) => {
    const health = await request.get('/health')
    expect(health.ok()).toBeTruthy()
    const healthJson = (await health.json()) as { status?: string }
    expect(healthJson.status).toBe('ok')

    const spec = await request.get('/openapi.yaml')
    expect(spec.ok()).toBeTruthy()

    const list = await request.get('/sensors?page=1&limit=2&q=temp')
    expect(list.ok()).toBeTruthy()
    const page = await list.json()
    expect(page).toHaveProperty('items')
    expect(page).toHaveProperty('total')
    expect(page).toHaveProperty('page', 1)
    expect(page).toHaveProperty('limit', 2)
    expect(Array.isArray(page.items)).toBeTruthy()

    const bad = await request.post('/sensors', {
      data: {},
      headers: { 'Content-Type': 'application/json' }
    })
    expect(bad.status()).toBe(400)

    const upsert = await request.post('/sensors', {
      data: { id: 'e2e-sensor', value: 42, unit: 'x' },
      headers: { 'Content-Type': 'application/json' }
    })
    expect([200, 201]).toContain(upsert.status())

    const badConfig = await request.put('/config', {
      data: {},
      headers: { 'Content-Type': 'application/json' }
    })
    expect(badConfig.status()).toBe(400)

    const cfg = await request.put('/config', {
      data: { name: 'E2E Hub', version: '9.9.9' },
      headers: { 'Content-Type': 'application/json' }
    })
    expect(cfg.ok()).toBeTruthy()
    const cfgJson = await cfg.json()
    expect(cfgJson.name).toBe('E2E Hub')
    expect(cfgJson.version).toBe('9.9.9')
  })
})
