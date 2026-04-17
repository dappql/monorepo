import type { Config as CodegenConfig, ContractConfig } from '@dappql/codegen'

export type McpConfigExtension = {
  rpc?: string
  allowWrites?: boolean
  allowCodegen?: boolean
}

export type DappConfig = CodegenConfig & {
  mcp?: McpConfigExtension
}

export type { ContractConfig }

export type ProjectContext = {
  root: string
  configPath: string
  config: DappConfig
  rpcUrl: string
  chainId?: number
  writesEnabled: boolean
  writesReason: string
  codegenEnabled: boolean
  codegenReason: string
}
