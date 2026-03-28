import { describe, expect, it } from 'vitest'
import {
  substituteGlobals,
  substituteHeaders,
  substituteVariables
} from '../../src/main/services/macroTemplate'
import type { ResponseData } from '../../src/shared/types'

describe('macroTemplate', () => {
  const step1: ResponseData = {
    status: 201,
    statusText: 'Created',
    headers: {},
    body: '{"id":"abc","nested":{"x":true},"arr":[{"v":2}]}',
    parsedType: 'json',
    parsedBody: { id: 'abc', nested: { x: true }, arr: [{ v: 2 }] },
    durationMs: 5
  }

  it('substituteVariables replaces {{stepN}} with raw body', () => {
    const m = new Map<number, ResponseData>([[1, step1]])
    expect(substituteVariables('payload={{step1}}', m)).toContain(step1.body)
  })

  it('substituteVariables supports status and deep paths', () => {
    const m = new Map<number, ResponseData>([[1, step1]])
    expect(substituteVariables('{{step1.status}}', m)).toBe('201')
    expect(substituteVariables('{{step1.id}}', m)).toBe('abc')
    expect(substituteVariables('{{step1.nested}}', m)).toBe(JSON.stringify({ x: true }))
    expect(substituteVariables('{{step1.nested.x}}', m)).toBe('true')
    expect(substituteVariables('{{step1.arr.0.v}}', m)).toBe('2')
  })

  it('substituteVariables returns empty string for missing step/path', () => {
    const m = new Map<number, ResponseData>([[1, step1]])
    expect(substituteVariables('{{step2.id}}', m)).toBe('')
    expect(substituteVariables('{{step1.nope}}', m)).toBe('')
  })

  it('substituteHeaders substitutes all header values', () => {
    const m = new Map<number, ResponseData>([[1, step1]])
    const headers = substituteHeaders({ Authorization: 'Bearer {{step1.id}}', X: '{{step1.status}}' }, m)
    expect(headers).toEqual({ Authorization: 'Bearer abc', X: '201' })
  })

  it('substituteGlobals replaces {{name}} but preserves {{stepN}}', () => {
    const g = { token: 'SECRET', baseUrl: 'v1' }
    expect(substituteGlobals('/{{baseUrl}}/x?k={{token}}', g)).toBe('/v1/x?k=SECRET')
    expect(substituteGlobals('{{step1.id}} and {{token}}', g)).toBe('{{step1.id}} and SECRET')
  })
})

