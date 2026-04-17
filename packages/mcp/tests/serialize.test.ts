import { describe, expect, it } from 'vitest'

import { coerceArg, coerceArgs, serializeValue } from '../src/serialize.js'

describe('coerceArg', () => {
  it('converts strings to bigint for uint types', () => {
    const out = coerceArg('1000000', { name: 'x', type: 'uint256' } as any)
    expect(out).toBe(1000000n)
  })

  it('converts numbers to bigint for int types', () => {
    const out = coerceArg(42, { name: 'x', type: 'int64' } as any)
    expect(out).toBe(42n)
  })

  it('accepts hex-prefixed string for uint', () => {
    const out = coerceArg('0x1f4', { name: 'x', type: 'uint256' } as any)
    expect(out).toBe(500n)
  })

  it('passes through addresses and strings', () => {
    expect(coerceArg('0xabc', { name: 'a', type: 'address' } as any)).toBe('0xabc')
    expect(coerceArg('hello', { name: 's', type: 'string' } as any)).toBe('hello')
  })

  it('coerces string booleans', () => {
    expect(coerceArg('true', { name: 'b', type: 'bool' } as any)).toBe(true)
    expect(coerceArg('false', { name: 'b', type: 'bool' } as any)).toBe(false)
    expect(coerceArg(true, { name: 'b', type: 'bool' } as any)).toBe(true)
  })

  it('coerces arrays element-by-element', () => {
    const out = coerceArg(['1', '2', '3'], { name: 'xs', type: 'uint256[]' } as any)
    expect(out).toEqual([1n, 2n, 3n])
  })
})

describe('coerceArgs', () => {
  it('mismatched length throws', () => {
    expect(() =>
      coerceArgs([1], [
        { name: 'a', type: 'uint256' },
        { name: 'b', type: 'address' },
      ] as any),
    ).toThrow(/Expected 2 args/)
  })

  it('coerces each arg per its ABI slot', () => {
    const out = coerceArgs(['42', '0x0000000000000000000000000000000000000001'], [
      { name: 'n', type: 'uint256' },
      { name: 'a', type: 'address' },
    ] as any)
    expect(out).toEqual([42n, '0x0000000000000000000000000000000000000001'])
  })
})

describe('serializeValue', () => {
  it('stringifies bigints', () => {
    expect(serializeValue(42n)).toBe('42')
  })

  it('recurses into arrays and objects', () => {
    const out = serializeValue({ a: 1n, b: [2n, { c: 3n }] })
    expect(out).toEqual({ a: '1', b: ['2', { c: '3' }] })
  })

  it('passes primitives through', () => {
    expect(serializeValue('hello')).toBe('hello')
    expect(serializeValue(true)).toBe(true)
    expect(serializeValue(null)).toBe(null)
  })
})
