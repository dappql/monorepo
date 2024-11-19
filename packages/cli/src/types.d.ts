type Address = `0x${string}`
type AbiFunction = {
  type?: 'function' | 'constructor' | 'event'
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'
}
type ContractConfig = { address?: Address; abi?: AbiFunction[] }
type Contracts = Record<string, ContractConfig>
type Config = {
  contracts: Contracts
  targetPath: string
  abiSourcePath?: string
  etherscanApiKey?: string
  etherscanApi?: string
}
