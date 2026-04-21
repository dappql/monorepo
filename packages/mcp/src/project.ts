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
  const fromConfig = config.mcp?.rpc?.trim()
  const fromEnv = process.env.DAPPQL_RPC_URL?.trim()
  const rpc = fromConfig || fromEnv
  if (!rpc) {
    throw new Error(
      'No RPC URL configured. Set `mcp.rpc` in dapp.config.js or the DAPPQL_RPC_URL environment variable.',
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
  if (!configPath) return null

  const config = await loadConfig(configPath)
  const root = dirname(configPath)
  const rpcUrl = resolveRpcUrl(config)
  const { enabled: writesEnabled, reason: writesReason } = resolveWritesPolicy(config)
  const { enabled: codegenEnabled, reason: codegenReason } = resolveCodegenPolicy(config)
  const plugins = discoverPlugins(root)

  return {
    root,
    configPath,
    config,
    rpcUrl,
    chainId: config.chainId,
    writesEnabled,
    writesReason,
    codegenEnabled,
    codegenReason,
    plugins,
  }
}
