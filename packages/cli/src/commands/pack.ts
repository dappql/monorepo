import { createAgentsFile, createContractsCollection } from '@dappql/codegen'
import { spawnSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { createRequire } from 'module'

import { RUNNING_DIRECTORY } from '../utils/constants.js'
import extractAbis from '../utils/extractAbis.js'
import getConfig from '../utils/getConfig.js'
import logger, { Severity } from '../utils/logger.js'

const require = createRequire(import.meta.url)

type RootPackageJson = {
  name?: string
  version?: string
  description?: string
  license?: string
  author?: unknown
  keywords?: unknown
  bugs?: unknown
  homepage?: unknown
  repository?: unknown
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** Best-effort read of the repo's root package.json. Pack uses it as a source
 *  of truth for metadata (name, version, license, author, bugs, deps, …) so
 *  maintainers don't have to restate everything in dapp.config.js. Returns an
 *  empty object for greenfield projects without a package.json. */
function readRootPackageJson(): RootPackageJson {
  const path = join(RUNNING_DIRECTORY, 'package.json')
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

function resolveTscBin(cwd: string): string | null {
  try {
    // Walk up from cwd, trying to resolve typescript's package.json from each parent.
    // This finds tsc even with pnpm's nested node_modules layout.
    let dir = cwd
    while (true) {
      const candidate = join(dir, 'node_modules', 'typescript', 'bin', 'tsc')
      if (existsSync(candidate)) return candidate
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    // Last resort: node's resolver from our CLI's location
    const pkg = require.resolve('typescript/package.json')
    return join(dirname(pkg), 'bin', 'tsc')
  } catch {
    return null
  }
}

const DEFAULT_OUT_DIR = './dappql-package'

export default async function pack() {
  logger('Loading config file ...\n', Severity.warning)
  const config = await getConfig()
  const rootPkg = readRootPackageJson()

  // Pack can run with zero config.package so long as the repo's package.json
  // supplies name + version. This lets existing SDK repos adopt pack without
  // duplicating metadata. `config.package` overrides anything in rootPkg.
  const pkgCfg = config.package ?? {}
  const pkgName = pkgCfg.name ?? rootPkg.name
  const pkgVersion = pkgCfg.version ?? rootPkg.version

  if (!pkgName) {
    throw new Error(
      'Package name not found. Set `package.name` in dapp.config.js or add a "name" field to package.json.',
    )
  }
  if (!pkgVersion) {
    throw new Error(
      'Package version not found. Set `package.version` in dapp.config.js or add a "version" field to package.json.',
    )
  }

  const outDir = resolve(RUNNING_DIRECTORY, pkgCfg.outDir ?? DEFAULT_OUT_DIR)
  const srcDir = join(outDir, 'src')
  const distDir = join(outDir, 'dist')

  // When the user supplies a source dir, bundle their code and nest generated
  // contracts under `./contracts/`. User code imports `./contracts/sdk.js`.
  const hasSource = !!pkgCfg.source
  const contractsOutDir = hasSource ? join(srcDir, 'contracts') : srcDir

  logger(`Packing to ${relative(RUNNING_DIRECTORY, outDir) || outDir}/`, Severity.info)

  // Reset outDir
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  mkdirSync(srcDir, { recursive: true })

  // Copy user source first (if provided), then codegen will write into contracts/
  // which overwrites any stale generated output the user had committed.
  if (pkgCfg.source) {
    const userSrc = resolve(RUNNING_DIRECTORY, pkgCfg.source)
    if (!existsSync(userSrc)) {
      throw new Error(`package.source directory not found: ${userSrc}`)
    }
    cpSync(userSrc, srcDir, { recursive: true })
    // Clean any stale contracts/ from the user's copy; fresh codegen will repopulate.
    const existingContracts = join(srcDir, 'contracts')
    if (existsSync(existingContracts)) {
      rmSync(existingContracts, { recursive: true, force: true })
    }
    logger(`Copied source from ${relative(RUNNING_DIRECTORY, userSrc)}/`, Severity.info)
  }
  mkdirSync(contractsOutDir, { recursive: true })

  // Fetch ABIs
  logger('Fetching ABIs...')
  const contracts = (await extractAbis(config)).sort((c1, c2) => (c1.contractName < c2.contractName ? -1 : 1))

  const missingAbis = contracts.filter((c) => !c.abi)
  if (missingAbis.length)
    logger(`Missing ABIs for:\n${missingAbis.map((c) => `\n\t- ${c.contractName}`).join('')}\n`, Severity.error)

  const contractsWithAbis = contracts.filter((c) => !!c.abi)
  if (!contractsWithAbis.length) {
    throw new Error('No contracts with ABIs — nothing to pack.')
  }

  // Generate typed contract modules + sdk.ts into contractsOutDir.
  // createContractsCollection expects `target` to be joined under rootDir, so pass a
  // relative path and let its default rootDir (cwd) handle it.
  logger(`Generating typed contracts for:\n${contractsWithAbis.map((c) => `\n\t- ${c.contractName}`).join('')}\n`)
  const relContractsOut = relative(RUNNING_DIRECTORY, contractsOutDir)
  createContractsCollection(contractsWithAbis, relContractsOut, /* isModule */ true, /* isSdk */ true)

  // Generate AGENTS.md at package root
  const agentsPath = join(outDir, 'AGENTS.md')
  const packConfig = { ...config, agentsFile: agentsPath }
  const agents = createAgentsFile(contractsWithAbis, packConfig)
  if (agents) {
    logger(`Wrote AGENTS.md`, Severity.info)
  }

  // Write ABIs + addresses JSON (consumed by @dappql/mcp at plugin load)
  const abis: Record<string, unknown> = {}
  const addresses: Record<string, string | undefined> = {}
  for (const c of contractsWithAbis) {
    abis[c.contractName] = c.abi
    addresses[c.contractName] = c.address
  }
  writeFileSync(join(outDir, 'abis.json'), JSON.stringify(abis, null, 2))
  writeFileSync(join(outDir, 'addresses.json'), JSON.stringify(addresses, null, 2))
  logger(`Wrote abis.json + addresses.json`, Severity.info)

  // tsconfig for the packed source. Generated contracts use @ts-nocheck, but declaration
  // emit still resolves types enough to occasionally trip TS2589 from viem's deep Abi
  // types. noEmitOnError: false lets tsc emit JS + .d.ts despite those resolver bails.
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      declaration: true,
      declarationMap: true,
      outDir: './dist',
      rootDir: './src',
      strict: false,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      noEmitOnError: false,
    },
    include: ['src'],
  }
  writeFileSync(join(outDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

  // Run tsc (find typescript in the consumer's node_modules, pnpm-aware walk)
  logger('Compiling TypeScript ...')
  const tscBin = resolveTscBin(RUNNING_DIRECTORY)
  if (!tscBin) {
    throw new Error(
      'Could not find TypeScript. Install it as a dev dep: `pnpm add -D typescript`.',
    )
  }
  const tscResult = spawnSync(process.execPath, [tscBin, '-p', outDir], {
    cwd: RUNNING_DIRECTORY,
    stdio: 'inherit',
  })
  // Accept tsc warnings (e.g., TS2589 from viem's deep Abi types) as long as emit
  // produced output. If dist/ has no index.js, treat as a real failure.
  const distIndex = join(distDir, 'index.js')
  if (!existsSync(distIndex)) {
    throw new Error('tsc compilation failed — no output produced. See errors above.')
  }
  if (tscResult.status !== 0) {
    logger('(tsc reported warnings above — emit continued)', Severity.warning)
  }

  // Compute entry paths. With user source, the main entry is the user's file;
  // generated contracts live under ./contracts/. Without, the generated barrel is main.
  const userMainFile = pkgCfg.main ?? 'index.ts'
  const userMainBase = userMainFile.replace(/\.tsx?$/, '')
  const mainPath = hasSource ? `./dist/${userMainBase}.js` : './dist/index.js'
  const typesPath = hasSource ? `./dist/${userMainBase}.d.ts` : './dist/index.d.ts'
  const contractsJs = hasSource ? './dist/contracts/index.js' : './dist/index.js'
  const contractsTypes = hasSource ? './dist/contracts/index.d.ts' : './dist/index.d.ts'
  const sdkJs = hasSource ? './dist/contracts/sdk.js' : './dist/sdk.js'
  const sdkTypes = hasSource ? './dist/contracts/sdk.d.ts' : './dist/sdk.d.ts'

  // Merge dependencies: repo's package.json is the source of truth. Config can
  // override, and we always ensure the two runtime deps pack needs are present.
  const dependencies: Record<string, string> = {
    ...(rootPkg.dependencies ?? {}),
  }
  const peerDependencies: Record<string, string> = {
    ...(rootPkg.peerDependencies ?? {}),
  }
  if (!dependencies['@dappql/async'] && !peerDependencies['@dappql/async']) {
    dependencies['@dappql/async'] = '^1.0.0'
  }
  if (!dependencies.viem && !peerDependencies.viem) {
    peerDependencies.viem = '^2.0.0'
  }

  // Build the package.json, merging rootPkg → config → pack defaults.
  const pkgJson: Record<string, unknown> = {
    name: pkgName,
    version: pkgVersion,
    description:
      pkgCfg.description ??
      rootPkg.description ??
      (pkgCfg.protocol?.name ? `${pkgCfg.protocol.name} contracts for DappQL` : undefined),
    type: 'module',
    main: mainPath,
    types: typesPath,
    exports: {
      '.': {
        import: mainPath,
        types: typesPath,
      },
      './contracts': {
        import: contractsJs,
        types: contractsTypes,
      },
      './sdk': {
        import: sdkJs,
        types: sdkTypes,
      },
      './abis': './abis.json',
      './addresses': './addresses.json',
      './agents': './AGENTS.md',
    },
    files: ['dist', 'abis.json', 'addresses.json', 'AGENTS.md', 'README.md'],
    license: pkgCfg.license ?? rootPkg.license ?? 'MIT',
  }

  // Pass through standard npm metadata fields when the repo has them. These
  // don't affect runtime behavior but matter for npm page / consumer tooling.
  for (const field of ['author', 'keywords', 'bugs', 'homepage', 'repository'] as const) {
    if (rootPkg[field] !== undefined) pkgJson[field] = rootPkg[field]
  }

  if (Object.keys(dependencies).length) pkgJson.dependencies = dependencies
  if (Object.keys(peerDependencies).length) pkgJson.peerDependencies = peerDependencies

  pkgJson.dappql = {
    manifestVersion: 1,
    chainId: config.chainId,
    protocol: pkgCfg.protocol,
    contracts: contractsJs,
    sdk: sdkJs,
    abis: './abis.json',
    addresses: './addresses.json',
    agents: './AGENTS.md',
  }

  writeFileSync(join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n')
  logger(`Wrote package.json`, Severity.info)

  // Write README
  const readme = renderReadme({
    name: pkgName,
    description: pkgCfg.description ?? rootPkg.description,
    protocol: pkgCfg.protocol,
    contractCount: contractsWithAbis.length,
  })
  writeFileSync(join(outDir, 'README.md'), readme)

  logger('\n\nPacked! 🎉', Severity.success)
  logger(`\n  cd ${relative(RUNNING_DIRECTORY, outDir) || outDir}`, Severity.info)
  logger(`  npm publish --access public\n`, Severity.info)
}

function renderReadme(args: {
  name: string
  description?: string
  protocol?: NonNullable<Awaited<ReturnType<typeof getConfig>>['package']>['protocol']
  contractCount: number
}): string {
  const { name, description, protocol, contractCount } = args
  const protocolName = protocol?.name ?? name
  const lines: string[] = []
  lines.push(`# ${name}`)
  lines.push('')
  lines.push(
    description ?? `Typed ${protocolName} contracts for DappQL — ${contractCount} contract${contractCount === 1 ? '' : 's'} packaged for humans and AI agents.`,
  )
  lines.push('')
  lines.push('## Install')
  lines.push('')
  lines.push('```bash')
  lines.push(`pnpm add ${name}`)
  lines.push('```')
  lines.push('')
  lines.push('## Use with DappQL MCP')
  lines.push('')
  lines.push(
    'Once installed, `@dappql/mcp` auto-discovers this package as a plugin and exposes ' +
      'its contracts, ABIs, and SDK to your AI coding agent.',
  )
  lines.push('')
  lines.push('## Use the SDK directly')
  lines.push('')
  lines.push('```ts')
  lines.push(`import createSdk from '${name}/sdk'`)
  lines.push(`import { createPublicClient, http } from 'viem'`)
  lines.push('')
  lines.push(`const publicClient = createPublicClient({ transport: http() })`)
  lines.push(`const sdk = createSdk(publicClient)`)
  lines.push('```')
  lines.push('')
  if (protocol?.docs || protocol?.website || protocol?.repo) {
    lines.push('## Links')
    lines.push('')
    if (protocol.website) lines.push(`- Website: ${protocol.website}`)
    if (protocol.docs) lines.push(`- Docs: ${protocol.docs}`)
    if (protocol.explorer) lines.push(`- Explorer: ${protocol.explorer}`)
    if (protocol.repo) lines.push(`- Repo: ${protocol.repo}`)
    lines.push('')
  }
  lines.push('---')
  lines.push('')
  lines.push('Built with [DappQL](https://dappql.com).')
  lines.push('')
  return lines.join('\n')
}
