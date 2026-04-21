export type Address = `0x${string}`

export type AbiParameter = {
  name: string
  type: string
  components?: AbiParameter[]
  indexed?: boolean
}

export type AbiFunction = {
  name: string
  type?: 'function' | 'constructor' | 'event'
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'
  inputs?: AbiParameter[]
  outputs?: AbiParameter[]
  anonymous?: boolean
}

export type ContractConfig = {
  address?: Address
  isTemplate?: boolean
  abi?: AbiFunction[]
}

export type Contracts = Record<string, ContractConfig>

export type ProtocolMeta = {
  name?: string
  description?: string
  website?: string
  docs?: string
  explorer?: string
  repo?: string
}

export type PackageConfig = {
  name: string
  version: string
  description?: string
  license?: string
  outDir?: string
  /** Path to a directory of user-authored TypeScript to bundle alongside the
   *  generated contracts. When set, generated contracts are nested under
   *  `./contracts/` inside the output source tree; user code imports from
   *  `'./contracts/sdk.js'` to get the typed `createSdk` factory. */
  source?: string
  /** Entry file within `source`, relative path. Defaults to `'index.ts'`. */
  main?: string
  protocol?: ProtocolMeta
}

export type Config = {
  contracts: Contracts
  targetPath: string
  abiSourcePath?: string
  etherscanApiKey?: string
  etherscanApi?: string
  chainId?: number
  isModule?: boolean
  isSdk?: boolean
  agentsFile?: boolean | string
  package?: PackageConfig
}
