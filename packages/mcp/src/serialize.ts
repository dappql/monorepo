import type { AbiParameter } from 'viem'

export function coerceArg(value: unknown, param: AbiParameter): unknown {
  if (value === null || value === undefined) return value
  const type = param.type

  if (type.endsWith('[]') || type.match(/\[\d+\]$/)) {
    if (!Array.isArray(value)) throw new Error(`Expected array for ${param.name || param.type}`)
    const innerType = type.replace(/\[\d*\]$/, '')
    const inner: AbiParameter = { ...param, type: innerType }
    return value.map((v) => coerceArg(v, inner))
  }

  if (type === 'tuple') {
    const components = (param as { components?: readonly AbiParameter[] }).components ?? []
    if (Array.isArray(value)) {
      return value.map((v, i) => coerceArg(v, components[i]!))
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const c of components) {
        out[c.name!] = coerceArg(obj[c.name!], c)
      }
      return out
    }
    throw new Error(`Expected tuple value for ${param.name || 'tuple'}`)
  }

  if (type.startsWith('uint') || type.startsWith('int')) {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number') return BigInt(value)
    if (typeof value === 'string') return BigInt(value)
    throw new Error(`Expected numeric value for ${param.name || type}`)
  }

  if (type === 'bool') {
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    throw new Error(`Expected boolean for ${param.name || type}`)
  }

  return value
}

export function coerceArgs(values: unknown[], params: readonly AbiParameter[]): unknown[] {
  if (values.length !== params.length) {
    throw new Error(`Expected ${params.length} args but got ${values.length}`)
  }
  return values.map((v, i) => coerceArg(v, params[i]))
}

export function serializeValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(serializeValue)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeValue(v)
    }
    return out
  }
  return value
}
