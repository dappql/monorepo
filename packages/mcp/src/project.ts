import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { pathToFileURL } from 'url'

import { discoverPlugins } from './plugins.js'
import type { DappConfig, ProjectContext } from './types.js'

const CONFIG_FILENAMES = ['dapp.config.js', 'dapp.config.mjs', 'dapp.config.cjs']

export function findConfigPath(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir)
  while (true) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name)
      if (existsSync(candidate)) return candidate
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export async function loadConfig(configPath: string): Promise<DappConfig> {
  const url = pathToFileURL(configPath).href
  const mod = await import(url)
  const config = (mod.default ?? mod) as DappConfig
  if (!config || typeof config !== 'object' || !config.contracts) {
    throw new Error(`Invalid dapp.config: expected an object with a \`contracts\` map at ${configPath}`)
  }
  return config
}

function resolveRpcUrl(config: DappConfig): string {
  // Precedence: local/secret (.env or shell) wins over committed defaults.
  //   1. `mcp.rpc` in dapp.config.js (explicit override in code)
  //   2. DAPPQL_RPC_URL — local, belongs in .env or shell env
  //   3. DAPPQL_DEFAULT_RPC_URL — committed default, belongs in .mcp.json
  const fromConfig = config.mcp?.rpc?.trim()
  const fromEnv = process.env.DAPPQL_RPC_URL?.trim()
  const fromDefault = process.env.DAPPQL_DEFAULT_RPC_URL?.trim()
  const rpc = fromConfig || fromEnv || fromDefault
  if (!rpc) {
    throw new Error(
      'No RPC URL configured. Set `mcp.rpc` in dapp.config.js, DAPPQL_RPC_URL (local .env), or DAPPQL_DEFAULT_RPC_URL (committed in .mcp.json).',
    )
  }
  return rpc
}

function resolveWritesPolicy(config: DappConfig): { enabled: boolean; reason: string } {
  const optedIn = config.mcp?.allowWrites === true
  const hasKey = Boolean(process.env.DAPPQL_PRIVATE_KEY?.trim() || process.env.MNEMONIC?.trim())

  if (!optedIn && !hasKey) {
    return { enabled: false, reason: 'writes disabled: not opted in and no signing key available' }
  }
  if (!optedIn) {
    return { enabled: false, reason: 'writes disabled: `mcp.allowWrites: true` missing from dapp.config.js' }
  }
  if (!hasKey) {
    return { enabled: false, reason: 'writes disabled: neither DAPPQL_PRIVATE_KEY nor MNEMONIC is set' }
  }
  return { enabled: true, reason: 'writes enabled (opted in + signing key present)' }
}

function resolveCodegenPolicy(config: DappConfig): { enabled: boolean; reason: string } {
  if (config.mcp?.allowCodegen === true) {
    return { enabled: true, reason: 'codegen enabled (mcp.allowCodegen: true)' }
  }
  return { enabled: false, reason: 'codegen disabled: `mcp.allowCodegen: true` missing from dapp.config.js' }
}

export async function loadProjectContext(startDir: string = process.cwd()): Promise<ProjectContext | null> {
  const configPath = findConfigPath(startDir)
  let config: DappConfig
  let root: string

  if (configPath) {
    config = await loadConfig(configPath)
    root = dirname(configPath)
  } else {
    // Plugin-only mode: no dap.config.js anywhere up the tree. Treat cwd as
    // the root and use an empty config. This lets agents consume DappQL
    // plugins from a plain repo whose only purpose is wiring @dappql/mcp +
    // one or more `@org/sdk` npm packages.
    root = resolve(startDir)
    config = { contracts: {}, targetPath: '' }
  }

  const plugins = discoverPlugins(root)

  // If we have neither a config nor any plugins, there's nothing for the
  // server to do — bail so the client can surface a clear error.
  if (!configPath && plugins.length === 0) return null

  const rpcUrl = resolveRpcUrl(config)
  const { enabled: writesEnabled, reason: writesReason } = resolveWritesPolicy(config)
  const { enabled: codegenEnabled, reason: codegenReason } = resolveCodegenPolicy(config)

  // In plugin-only mode with a single plugin, adopt its chainId as the
  // project default. Multi-plugin setups need an explicit config.chainId
  // (tools can still call across chains by overriding per-request).
  const chainId =
    config.chainId ?? (!configPath && plugins.length === 1 ? plugins[0].chainId : undefined)

  return {
    root,
    configPath: configPath ?? undefined,
    config,
    rpcUrl,
    chainId,
    writesEnabled,
    writesReason,
    codegenEnabled,
    codegenReason,
    plugins,
  }
}
