import type { Abi, AbiFunction, Address, Mutable } from 'viem'

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

type GetMultipleSignatures<F> = F extends {
  (...args: infer A1): any
  (...args: infer A2): any
}
  ? A1 extends Record<any, any>
    ? A2
    : A1 extends A2
      ? A1
      : A1 | A2
  : undefined

type ExcludeCallOptionsTuple<T1> = T1 extends [args: infer A, options?: any]
  ? [args: A]
  : T1 extends [options?: any]
    ? [args: readonly []]
    : T1

type ExcludeMutationOptionsTuple<T1> = T1 extends [args: infer A, options: any]
  ? [args: A]
  : T1 extends [options?: any]
    ? [args: readonly []]
    : T1

type SimplifyArgs<T> = T extends [args: infer A extends object] ? Mutable<A> : never

export type ExtractCallArgs<T> = SimplifyArgs<ExcludeCallOptionsTuple<GetMultipleSignatures<T>>>
export type ExtractMutationArgs<T> = SimplifyArgs<ExcludeMutationOptionsTuple<GetMultipleSignatures<T>>>
