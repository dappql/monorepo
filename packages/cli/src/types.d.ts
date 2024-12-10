type Address = `0x${string}`
type AbiParameter = {
  name: string
  type: string
  components?: AbiParameter[]
  indexed?: boolean
}

type AbiFunction = {
  name: string
  type?: 'function' | 'constructor' | 'event'
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'
  inputs?: AbiParameter[]
  outputs?: AbiParameter[]
  anonymous?: boolean
}
type ContractConfig = { address?: Address; abi?: AbiFunction[] }
type Contracts = Record<string, ContractConfig>
type Config = {
  contracts: Contracts
  targetPath: string
  abiSourcePath?: string
  etherscanApiKey?: string
  etherscanApi?: string
  isModule?: boolean
}
