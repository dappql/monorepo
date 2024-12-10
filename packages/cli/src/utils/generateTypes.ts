type ABIParameter = {
  name: string
  type: string
  components?: ABIParameter[]
}

const typeMap: Record<string, string> = {
  address: '`0x${string}`',
  string: 'string',
  bool: 'boolean',
  uint8: 'number',
  uint16: 'number',
  uint32: 'number',
  uint64: 'bigint',
  uint128: 'bigint',
  uint256: 'bigint',
  int8: 'number',
  int16: 'number',
  int32: 'number',
  int64: 'bigint',
  int128: 'bigint',
  int256: 'bigint',
  bytes: '`0x${string}`',
}

function generateContractTypes(abi: readonly AbiFunction[]) {
  const functions = abi.filter((item) => item.type === 'function')
  const events = abi.filter((item) => item.type === 'event')

  // Group overloaded functions
  const functionGroups = functions.reduce(
    (acc, func) => {
      if (!acc[func.name]) acc[func.name] = []
      acc[func.name].push(func)
      return acc
    },
    {} as Record<string, AbiFunction[]>,
  )

  const calls = Object.entries(functionGroups)
    .filter(([_, funcs]) => funcs[0].stateMutability === 'view' || funcs[0].stateMutability === 'pure')
    .map(([name, funcs]) => generateOverloadedType(name, funcs))
    .join('\n    ')

  const mutations = Object.entries(functionGroups)
    .filter(([_, funcs]) => funcs[0].stateMutability === 'nonpayable' || funcs[0].stateMutability === 'payable')
    .map(([name, funcs]) => generateOverloadedType(name, funcs))
    .join('\n    ')

  const eventTypes = events.map((event) => generateEventType(event)).join('\n    ')

  return `export type Contract = {
  calls: {
    ${calls}
  }
  mutations: {
    ${mutations}
  }
  events: {
    ${eventTypes}
  }
}`
}

function generateOverloadedType(name: string, funcs: AbiFunction[]) {
  // Sort by input length in descending order to get the most parameters first
  const sortedFuncs = funcs.sort((a, b) => (b.inputs?.length || 0) - (a.inputs?.length || 0))
  const baseFunc = sortedFuncs[0]

  const params =
    baseFunc.inputs
      ?.map((input, i) => {
        // Parameter is optional if any function signature has fewer parameters than this index
        const isOptional = sortedFuncs.some((f) => (f.inputs?.length || 0) < i + 1)
        return `${input.name.replace('_', '')}${isOptional ? '?' : ''}: ${getSolidityToTsType(input)}`
      })
      .join(', ') || ''

  const output =
    baseFunc.outputs && baseFunc.outputs.length === 1
      ? getSolidityToTsType(baseFunc.outputs[0])
      : baseFunc.outputs && baseFunc.outputs.length > 1
        ? `[${baseFunc.outputs.map((o) => getSolidityToTsType(o)).join(', ')}]`
        : 'void'

  return `${name}: (${params}) => Promise<${output}>`
}

function generateEventType(event: AbiFunction) {
  if (event.type !== 'event') return ''

  const params = event.inputs?.map((input) => `${input.name}: ${getSolidityToTsType(input)}`).join(', ') || ''

  return `${event.name}: (${params}) => Promise<void>`
}

function getSolidityToTsType(param: ABIParameter): string {
  if (param.type === 'tuple' && param.components) {
    const fields = param.components.map((comp) => `${comp.name}: ${getSolidityToTsType(comp)}`)
    return `{ ${fields.join('; ')} }`
  }

  if (param.type.endsWith('[]')) {
    const baseType = param.type.slice(0, -2)
    return `${getSolidityToTsType({ ...param, type: baseType })}[]`
  }

  if (param.type.startsWith('bytes')) {
    return '`0x${string}`'
  }

  return typeMap[param.type] || 'unknown'
}

export default generateContractTypes
