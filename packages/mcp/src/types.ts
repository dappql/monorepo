import type { Config as CodegenConfig, ContractConfig } from '@dappql/codegen'

import type { Plugin } from './plugins.js'

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
  /** DappQL packages discovered in the project's node_modules via their
   *  `dappql` manifest field. Each plugin contributes typed contracts that
   *  agents can query alongside the project's own contracts. */
  plugins: Plugin[]
}
