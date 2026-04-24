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
  /** Absolute path to the loaded `dap.config.js`. Undefined in plugin-only
   *  mode — the server was launched in a directory with no local config but
   *  has plugins in node_modules. */
  configPath?: string
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
