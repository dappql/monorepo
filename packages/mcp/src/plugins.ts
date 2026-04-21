import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import type { AbiFunction, ProtocolMeta } from '@dappql/codegen'

/** The `dappql` field inside a published package's package.json — matches what
 *  the CLI `pack` command emits. */
export type PluginManifest = {
  manifestVersion: number
  chainId?: number
  protocol?: ProtocolMeta
  contracts?: string
  sdk?: string
  abis?: string
  addresses?: string
  agents?: string
}

export type PluginContract = {
  name: string
  address?: `0x${string}`
  abi: AbiFunction[]
  isTemplate?: boolean
}

export type Plugin = {
  /** npm package name, e.g. `@underscore/dappql` */
  name: string
  version?: string
  /** Absolute path to the package's root directory on disk */
  packageDir: string
  chainId?: number
  protocol?: ProtocolMeta
  contracts: Record<string, PluginContract>
  /** Absolute path to the AGENTS.md shipped with the plugin, if any */
  agentsPath?: string
}

type PackageJsonWithDappql = {
  name?: string
  version?: string
  dappql?: PluginManifest
}

const SKIP_TOP_LEVEL = new Set(['.bin', '.cache', '.pnpm', '.modules.yaml', '.package-lock.json'])

/** Iterate over every package directory directly present in `node_modules/`.
 *  Handles scoped packages by descending one level into `@scope/`. Skips
 *  pnpm/npm bookkeeping entries. */
function* iterateTopLevelPackages(nodeModulesDir: string): Generator<string> {
  if (!existsSync(nodeModulesDir)) return
  let entries: string[]
  try {
    entries = readdirSync(nodeModulesDir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (SKIP_TOP_LEVEL.has(entry)) continue
    const full = join(nodeModulesDir, entry)
    let stats
    try {
      stats = statSync(full)
    } catch {
      continue
    }
    if (!stats.isDirectory()) continue
    if (entry.startsWith('@')) {
      // Scoped: descend one level
      let scoped: string[]
      try {
        scoped = readdirSync(full)
      } catch {
        continue
      }
      for (const sub of scoped) {
        yield join(full, sub)
      }
    } else {
      yield full
    }
  }
}

function readPackageJson(packageDir: string): PackageJsonWithDappql | null {
  const pkgPath = join(packageDir, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
}

function resolveManifestPath(packageDir: string, relative: string | undefined): string | null {
  if (!relative) return null
  // Manifest paths are package-relative. Strip `./` if present.
  const cleaned = relative.replace(/^\.\//, '')
  const resolved = join(packageDir, cleaned)
  return existsSync(resolved) ? resolved : null
}

function loadPlugin(packageDir: string, pkgJson: PackageJsonWithDappql): Plugin | null {
  const manifest = pkgJson.dappql
  if (!manifest || !pkgJson.name) return null

  // Load ABIs (required to do anything useful)
  const abisPath = resolveManifestPath(packageDir, manifest.abis)
  if (!abisPath) return null
  let abis: Record<string, AbiFunction[]>
  try {
    abis = JSON.parse(readFileSync(abisPath, 'utf8'))
  } catch {
    return null
  }

  // Load addresses (optional — undefined for template contracts)
  let addresses: Record<string, string | undefined> = {}
  const addressesPath = resolveManifestPath(packageDir, manifest.addresses)
  if (addressesPath) {
    try {
      addresses = JSON.parse(readFileSync(addressesPath, 'utf8'))
    } catch {
      // ignore — addresses stay empty
    }
  }

  // Build contracts map
  const contracts: Record<string, PluginContract> = {}
  for (const [name, abi] of Object.entries(abis)) {
    if (!Array.isArray(abi)) continue
    const address = addresses[name]
    contracts[name] = {
      name,
      abi,
      address: address as `0x${string}` | undefined,
    }
  }

  const agentsPath = resolveManifestPath(packageDir, manifest.agents) ?? undefined

  return {
    name: pkgJson.name,
    version: pkgJson.version,
    packageDir,
    chainId: manifest.chainId,
    protocol: manifest.protocol,
    contracts,
    agentsPath,
  }
}

/** Walk the project's node_modules, return every package whose package.json
 *  declares a `dappql` manifest field. Respects both flat (npm/yarn) and
 *  pnpm-hoisted layouts. Transitive deps are included — if a DappQL-packaged
 *  protocol is in the install graph, agents see it. */
export function discoverPlugins(projectRoot: string): Plugin[] {
  const nodeModulesDir = join(projectRoot, 'node_modules')
  const plugins: Plugin[] = []
  const seen = new Set<string>()

  for (const packageDir of iterateTopLevelPackages(nodeModulesDir)) {
    const pkg = readPackageJson(packageDir)
    if (!pkg?.dappql || !pkg.name) continue
    if (seen.has(pkg.name)) continue
    const plugin = loadPlugin(packageDir, pkg)
    if (plugin) {
      plugins.push(plugin)
      seen.add(pkg.name)
    }
  }

  return plugins.sort((a, b) => a.name.localeCompare(b.name))
}
