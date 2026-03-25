import { describe, expect, it, vi } from 'vitest'
import { buildRequestHeaders, buildUrl, redactHeaders, sendHttpRequest } from '../../src/main/services/httpClient'

describe('httpClient', () => {
  it('buildUrl combines protocol, host, basePath and request path', () => {
    const url = buildUrl(
      { protocol: 'http', ip: '127.0.0.1', port: 3000, basePath: '/api/' },
      'health'
    )
    expect(url).toBe('http://127.0.0.1:3000/api/health')
  })

  it('buildUrl returns absolute URL unchanged', () => {
    expect(buildUrl({ protocol: 'http', ip: 'x', port: 1 }, 'https://example.com/a')).toBe(
      'https://example.com/a'
    )
  })

  it('buildRequestHeaders applies auth overlays', () => {
    const basic = buildRequestHeaders({ 'X-Test': '1' }, { type: 'basic', basic: { username: 'u', password: 'p' } })
    expect(basic['X-Test']).toBe('1')
    expect(basic.Authorization).toMatch(/^Basic /)

    const bearer = buildRequestHeaders(undefined, { type: 'bearer', bearer: { token: 't' } })
    expect(bearer.Authorization).toBe('Bearer t')

    const apiKey = buildRequestHeaders(undefined, { type: 'apiKey', apiKey: { headerName: 'X-KEY', value: 'v' } })
    expect(apiKey['X-KEY']).toBe('v')
  })

  it('redactHeaders masks authorization and api key headers', () => {
    const redacted = redactHeaders({
      Authorization: 'secret',
      'X-API-Key': 'secret2',
      'x-apikey-token': 'secret3',
      'Content-Type': 'application/json'
    })
    expect(redacted.Authorization).toBe('***')
    expect(redacted['X-API-Key']).toBe('***')
    expect(redacted['x-apikey-token']).toBe('***')
    expect(redacted['Content-Type']).toBe('application/json')
  })

  it('sendHttpRequest parses json when content-type is json', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      return {
        status: 200,
        statusText: 'OK',
        text: async () => '{"a":1}',
        headers: {
          forEach: (cb: (value: string, key: string) => void) => {
            cb('application/json', 'content-type')
          }
        }
      } as unknown as Response
    }) as unknown as typeof fetch

    const res = await sendHttpRequest({ url: 'http://x', method: 'GET', headers: {} })
    expect(res.parsedType).toBe('json')
    expect(res.parsedBody).toEqual({ a: 1 })

    globalThis.fetch = originalFetch
  })

  it('sendHttpRequest parses xml when content-type is xml', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      return {
        status: 200,
        statusText: 'OK',
        text: async () => '<root><a>1</a></root>',
        headers: {
          forEach: (cb: (value: string, key: string) => void) => {
            cb('application/xml', 'content-type')
          }
        }
      } as unknown as Response
    }) as unknown as typeof fetch

    const res = await sendHttpRequest({ url: 'http://x', method: 'GET', headers: {} })
    expect(res.parsedType).toBe('xml')
    expect(res.parsedBody).toMatchObject({ root: { a: 1 } })

    globalThis.fetch = originalFetch
  })
})

