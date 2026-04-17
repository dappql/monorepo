import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

import type { AbiFunction, AbiParameter, ContractConfig } from './types.js'

const MARKER_START = '<!-- dappql:start -->'
const MARKER_END = '<!-- dappql:end -->'

type GeneratedContract = ContractConfig & {
  contractName: string
}

type MethodInfo = {
  name: string
  inputs: AbiParameter[]
}

type AnnotatedContract = GeneratedContract & {
  reads: MethodInfo[]
  writes: MethodInfo[]
  events: string[]
  hasRead: boolean
  hasWrite: boolean
}

function categorize(abi: AbiFunction[]) {
  const reads: MethodInfo[] = []
  const writes: MethodInfo[] = []
  const events: string[] = []
  const seen = { read: new Set<string>(), write: new Set<string>(), event: new Set<string>() }

  for (const a of abi) {
    if (a.type === 'function' && (a.stateMutability === 'view' || a.stateMutability === 'pure')) {
      if (!seen.read.has(a.name)) {
        seen.read.add(a.name)
        reads.push({ name: a.name, inputs: a.inputs ?? [] })
      }
    } else if (a.type === 'function' && (a.stateMutability === 'nonpayable' || a.stateMutability === 'payable')) {
      if (!seen.write.has(a.name)) {
        seen.write.add(a.name)
        writes.push({ name: a.name, inputs: a.inputs ?? [] })
      }
    } else if (a.type === 'event') {
      if (!seen.event.has(a.name)) {
        seen.event.add(a.name)
        events.push(a.name)
      }
    }
  }

  return { reads, writes, events }
}

function fmtList(items: MethodInfo[] | string[], max = 8): string {
  if (!items.length) return '—'
  const names = items.map((i) => (typeof i === 'string' ? i : i.name))
  if (names.length <= max) return names.map((n) => `\`${n}\``).join(', ')
  return names.slice(0, max).map((n) => `\`${n}\``).join(', ') + `, … (+${names.length - max})`
}

function renderArgs(inputs: AbiParameter[]): string {
  if (!inputs.length) return ''
  const names = inputs.map((i, idx) => i.name || `arg${idx}`)
  return `/* ${names.join(', ')} */`
}

function pickMethod(methods: MethodInfo[]): MethodInfo | undefined {
  return methods.find((m) => m.inputs.length === 0) ?? methods[0]
}

function normalizeImportPath(targetPath: string): string {
  return targetPath.replace(/\/+$/, '')
}

function annotate(contracts: GeneratedContract[]): AnnotatedContract[] {
  return contracts.map((c) => {
    const { reads, writes, events } = categorize(c.abi ?? [])
    return { ...c, reads, writes, events, hasRead: reads.length > 0, hasWrite: writes.length > 0 }
  })
}

function pickExampleContracts(generated: AnnotatedContract[]) {
  const readExample = generated.find((c) => c.hasRead && !c.isTemplate) ?? generated.find((c) => c.hasRead)
  const writeExample =
    generated.find((c) => c.hasWrite && !c.isTemplate && c !== readExample) ??
    generated.find((c) => c.hasWrite)
  const templateExample = generated.find((c) => c.isTemplate)
  return { readExample, writeExample, templateExample }
}

function buildContent(
  contracts: GeneratedContract[],
  config: { targetPath: string; isModule?: boolean; isSdk?: boolean; chainId?: number },
): string {
  const importPath = normalizeImportPath(config.targetPath)
  const generated = annotate(contracts)
  const { readExample, writeExample, templateExample } = pickExampleContracts(generated)

  const rows = generated
    .map((c) => {
      const shape = c.isTemplate ? 'template' : 'singleton'
      return `| \`${c.contractName}\` | ${shape} | ${fmtList(c.reads)} | ${fmtList(c.writes)} | ${fmtList(c.events)} |`
    })
    .join('\n')

  const reactReadExample = readExample
    ? (() => {
        const preferred = readExample.reads.filter((m) => m.inputs.length === 0).slice(0, 2)
        const pick = preferred.length ? preferred : readExample.reads.slice(0, 2)
        const query = pick.length
          ? pick
              .map((m) => `  ${m.name}: ${readExample.contractName}.call.${m.name}(${renderArgs(m.inputs)}),`)
              .join('\n')
          : `  // add reads here`
        return `import { ${readExample.contractName} } from '${importPath}'
import { useContextQuery } from '@dappql/react'

const { data, isLoading } = useContextQuery({
${query}
})`
      })()
    : `import { useContextQuery } from '@dappql/react'`

  const reactWriteExample = writeExample
    ? (() => {
        const method = pickMethod(writeExample.writes)!
        return `import { ${writeExample.contractName} } from '${importPath}'
import { useMutation } from '@dappql/react'

const tx = useMutation(${writeExample.contractName}.mutation.${method.name}, '${method.name}')
tx.send(${renderArgs(method.inputs)})`
      })()
    : null

  const templateExampleBlock = templateExample
    ? (() => {
        const method = pickMethod(templateExample.reads)
        const methodName = method?.name ?? 'someReadMethod'
        const args = method ? renderArgs(method.inputs) : ''
        return `// Template contract — bind the address per call
${templateExample.contractName}.call.${methodName}(${args}).at(contractAddress)`
      })()
    : null

  const sdkExample = config.isSdk
    ? (() => {
        const singleton = generated.find((c) => c.hasRead && !c.isTemplate)
        const template = generated.find((c) => c.isTemplate && c.hasRead)
        const singletonMethod = singleton ? pickMethod(singleton.reads) : undefined
        const templateMethod = template ? pickMethod(template.reads) : undefined
        const singletonLine = singleton && singletonMethod
          ? `const value = await sdk.${singleton.contractName}.${singletonMethod.name}(${renderArgs(singletonMethod.inputs)})`
          : ''
        const templateLine = template && templateMethod
          ? `const bound = sdk.${template.contractName}('0x...')   // template: pass address
const result = await bound.${templateMethod.name}(${renderArgs(templateMethod.inputs)})`
          : ''
        return `import createSdk from '${importPath}/sdk'

const sdk = createSdk(publicClient, walletClient)
${singletonLine}
${templateLine}`.trim()
      })()
    : null

  const asyncExample = readExample
    ? (() => {
        const method = pickMethod(readExample.reads)!
        return `import { query } from '@dappql/async'
import { ${readExample.contractName} } from '${importPath}'

const { data } = await query(publicClient, {
  value: ${readExample.contractName}.call.${method.name}(${renderArgs(method.inputs)}),
})`
      })()
    : null

  const setupLines = [
    `- Contracts directory: \`${importPath}\``,
    `- Module system: ${config.isModule ? 'ESM' : 'CommonJS/default'}`,
    `- SDK factory: ${config.isSdk ? `yes — \`${importPath}/sdk\` exports \`createSdk(publicClient, walletClient, addressResolver)\`` : 'no (enable with \`isSdk: true\` in `dapp.config.js`)'}`,
    config.chainId ? `- Chain ID: ${config.chainId}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const sections: string[] = []

  sections.push(`${MARKER_START}
<!-- Autogenerated by \`dappql\` from dapp.config.js — don't hand-edit between the dappql markers. Re-run \`dappql\` after config changes. -->

# DappQL — project context for AI agents

This project reads and writes on-chain state via **[DappQL](https://github.com/dappql/monorepo)**, a typed data layer on top of wagmi + viem. Use it for every contract interaction — don't reach for raw wagmi/viem primitives when a DappQL hook exists.

Full agent reference: https://github.com/dappql/monorepo/blob/main/AGENTS.md`)

  sections.push(`## Generated setup

${setupLines}`)

  sections.push(`## Contracts in this project

| Contract | Shape | Reads | Writes | Events |
| --- | --- | --- | --- | --- |
${rows}

*singleton = fixed \`deployAddress\` baked in. template = pass the address per use via \`.at(addr)\` in React or \`sdk.Contract(addr)\` in the SDK factory.*`)

  const usageParts: string[] = []
  usageParts.push(`### React — prefer \`useContextQuery\` (batches across the whole tree)

\`\`\`tsx
${reactReadExample}
\`\`\``)

  if (reactWriteExample) {
    usageParts.push(`### React — mutations

\`\`\`tsx
${reactWriteExample}
\`\`\``)
  }

  if (templateExampleBlock) {
    usageParts.push(`### Template contracts

\`\`\`ts
${templateExampleBlock}
\`\`\``)
  }

  if (sdkExample) {
    usageParts.push(`### Non-React — generated SDK factory

\`\`\`ts
${sdkExample}
\`\`\``)
  }

  if (asyncExample) {
    usageParts.push(`### Non-React — ad-hoc multicall

\`\`\`ts
${asyncExample}
\`\`\``)
  }

  sections.push(`## Use it\n\n${usageParts.join('\n\n')}`)

  sections.push(`## Non-negotiables

- **Always import from \`${importPath}\`.** Never hand-craft ABIs or hardcode addresses already in the config. Re-run \`dappql\` after editing \`dapp.config.js\`.
- **Never use \`useReadContract\` / \`useReadContracts\` / \`useWriteContract\` directly** when you can use \`useContextQuery\` / \`useQuery\` / \`useMutation\`. The batching and typing layer is the whole point.
- **Default to \`useContextQuery\`** over \`useQuery\` — it fuses calls across the component tree into one RPC.
- **\`uint256\` is \`bigint\`.** Use \`0n\`, \`1n\`, \`BigInt(n)\`. Never pass plain numbers where \`bigint\` is expected.
- **Addresses are \`\\\`0x\${string}\\\`\`.** Checksum untrusted input via viem's \`getAddress\`.
- **Mutation \`send\` takes spread args**: \`tx.send(a, b, c)\`, not \`tx.send([a, b, c])\`.
- **Template contracts require an address** per use — use \`.at(addr)\` on the call builder${config.isSdk ? ' or `sdk.Contract(addr)` in the SDK factory' : ''}.

${MARKER_END}`)

  return sections.join('\n\n')
}

function resolveAgentsPath(agentsFile: boolean | string, rootDir: string): string {
  if (typeof agentsFile === 'string') {
    return agentsFile.startsWith('/') ? agentsFile : join(rootDir, agentsFile)
  }
  return join(rootDir, 'AGENTS.md')
}

function mergeIntoExisting(existing: string, block: string): string {
  const startIdx = existing.indexOf(MARKER_START)
  const endIdx = existing.indexOf(MARKER_END)

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx).trimEnd()
    const after = existing.slice(endIdx + MARKER_END.length).trimStart()
    const parts = [before, block, after].filter(Boolean)
    return parts.join('\n\n') + '\n'
  }

  const trimmed = existing.trimEnd()
  return (trimmed ? trimmed + '\n\n' : '') + block + '\n'
}

export default function createAgentsFile(
  contracts: GeneratedContract[],
  config: {
    targetPath: string
    isModule?: boolean
    isSdk?: boolean
    chainId?: number
    agentsFile?: boolean | string
    rootDir?: string
  },
): { written: boolean; path: string; mode: 'created' | 'updated' | 'appended' } | null {
  if (config.agentsFile === false) return null

  const block = buildContent(contracts, config)
  const rootDir = config.rootDir ?? process.cwd()
  const filePath = resolveAgentsPath(config.agentsFile ?? true, rootDir)

  if (!existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, block + '\n')
    return { written: true, path: filePath, mode: 'created' }
  }

  const existing = readFileSync(filePath, 'utf8')
  const hasMarkers = existing.includes(MARKER_START) && existing.includes(MARKER_END)
  const merged = mergeIntoExisting(existing, block)
  writeFileSync(filePath, merged)
  return { written: true, path: filePath, mode: hasMarkers ? 'updated' : 'appended' }
}
