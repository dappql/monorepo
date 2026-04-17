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
}
