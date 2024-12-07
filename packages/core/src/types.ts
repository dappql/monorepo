import type { Abi, AbiFunction, Address } from 'viem'

export type Request = {
  contractName: string
  method: AbiFunction['name']
  args?: readonly any[]
  address?: Address
  deployAddress?: Address
  defaultValue?: unknown
  getAbi: () => Abi
}
export type RequestCollection = Record<string, Request>

export type MutationConfig<M extends string, Args extends readonly any[]> = {
  contractName: string
  functionName: M
  deployAddress?: Address
  argsType?: Args
  getAbi: () => Abi
}
export type MutationCollection<T extends Record<string, MutationConfig<any, any>>> = T

export type ExtractArgs<T> = T extends (...args: infer P) => any ? P : never
