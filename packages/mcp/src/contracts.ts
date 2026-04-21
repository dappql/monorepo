import type { AbiFunction, AbiParameter, ContractConfig } from '@dappql/codegen'
import type { Address } from 'viem'

import type { Plugin } from './plugins.js'
import type { DappConfig, ProjectContext } from './types.js'

/** Identifies where a contract came from — either the local DappQL project
 *  or a plugin package discovered in node_modules. */
export type ContractSource =
  | { kind: 'project' }
  | { kind: 'plugin'; name: string }

export type MethodSummary = {
  name: string
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable'
  inputs: { name: string; type: string }[]
  outputs: { name: string; type: string }[]
}

export type EventSummary = {
  name: string
  inputs: { name: string; type: string; indexed?: boolean }[]
}

export type ContractSummary = {
  name: string
  shape: 'singleton' | 'template'
  address: Address | null
  reads: MethodSummary[]
  writes: MethodSummary[]
  events: EventSummary[]
}

function summarizeMethod(fn: AbiFunction): MethodSummary {
  return {
    name: fn.name,
    stateMutability: (fn.stateMutability ?? 'view') as MethodSummary['stateMutability'],
    inputs: (fn.inputs ?? []).map((i, idx) => ({ name: i.name || `arg${idx}`, type: i.type })),
    outputs: (fn.outputs ?? []).map((o, idx) => ({ name: o.name || `out${idx}`, type: o.type })),
  }
}

function summarizeEvent(ev: AbiFunction): EventSummary {
  return {
    name: ev.name,
    inputs: (ev.inputs ?? []).map((i: AbiParameter, idx) => ({
      name: i.name || `arg${idx}`,
      type: i.type,
      indexed: i.indexed,
    })),
  }
}

export function summarizeContract(name: string, contract: ContractConfig): ContractSummary {
  const abi = contract.abi ?? []
  const reads: MethodSummary[] = []
  const writes: MethodSummary[] = []
  const events: EventSummary[] = []
  const seen = { read: new Set<string>(), write: new Set<string>(), event: new Set<string>() }

  for (const entry of abi) {
    if (entry.type === 'function') {
      if (entry.stateMutability === 'view' || entry.stateMutability === 'pure') {
        if (!seen.read.has(entry.name)) {
          seen.read.add(entry.name)
          reads.push(summarizeMethod(entry))
        }
      } else if (entry.stateMutability === 'nonpayable' || entry.stateMutability === 'payable') {
        if (!seen.write.has(entry.name)) {
          seen.write.add(entry.name)
          writes.push(summarizeMethod(entry))
        }
      }
    } else if (entry.type === 'event') {
      if (!seen.event.has(entry.name)) {
        seen.event.add(entry.name)
        events.push(summarizeEvent(entry))
      }
    }
  }

  return {
    name,
    shape: contract.isTemplate ? 'template' : 'singleton',
    address: contract.address ?? null,
    reads,
    writes,
    events,
  }
}

export function summarizeAllContracts(config: DappConfig): ContractSummary[] {
  return Object.entries(config.contracts).map(([name, c]) => summarizeContract(name, c))
}

export type SourcedContractSummary = ContractSummary & { source: string }

/** Returns every contract known to the MCP server: the local project's, plus
 *  any plugins discovered in node_modules. Each entry carries a `source` field
 *  ('project' for local, or the plugin package name). Names are NOT prefixed —
 *  agents disambiguate via the source field when two packages share a name. */
export function summarizeAllSources(ctx: ProjectContext): SourcedContractSummary[] {
  const out: SourcedContractSummary[] = Object.entries(ctx.config.contracts).map(([name, c]) => ({
    ...summarizeContract(name, c),
    source: 'project',
  }))
  for (const plugin of ctx.plugins) {
    for (const [name, contract] of Object.entries(plugin.contracts)) {
      const cfg: ContractConfig = {
        abi: contract.abi,
        address: contract.address,
        isTemplate: contract.isTemplate,
      }
      out.push({ ...summarizeContract(name, cfg), source: plugin.name })
    }
  }
  return out
}

/** Resolve a (name, source?) pair to a ContractConfig, drawing from the project
 *  or a named plugin. If `source` is omitted, prefers the project, then falls
 *  back to plugins — throws on ambiguity. */
export function resolveContract(
  ctx: ProjectContext,
  name: string,
  source?: string,
): { source: string; contract: ContractConfig } {
  // Explicit source
  if (source === 'project') {
    const c = ctx.config.contracts[name]
    if (!c) throw new Error(`Contract not found in project: ${name}`)
    return { source: 'project', contract: c }
  }
  if (source) {
    const plugin = ctx.plugins.find((p) => p.name === source)
    if (!plugin) throw new Error(`Plugin not found: ${source}`)
    const c = plugin.contracts[name]
    if (!c) throw new Error(`Contract not found in plugin ${source}: ${name}`)
    return { source, contract: { abi: c.abi, address: c.address, isTemplate: c.isTemplate } }
  }

  // Unspecified — prefer project, then disambiguate across plugins
  const inProject = ctx.config.contracts[name]
  const matchingPlugins = ctx.plugins.filter((p) => p.contracts[name])
  const totalMatches = (inProject ? 1 : 0) + matchingPlugins.length
  if (totalMatches === 0) throw new Error(`Contract not found: ${name}`)
  if (totalMatches > 1) {
    const sources = [
      ...(inProject ? ['project'] : []),
      ...matchingPlugins.map((p) => p.name),
    ]
    throw new Error(
      `Ambiguous contract name "${name}" — exists in: ${sources.join(', ')}. Pass the \`source\` argument to disambiguate.`,
    )
  }
  if (inProject) return { source: 'project', contract: inProject }
  const plugin = matchingPlugins[0]
  const c = plugin.contracts[name]
  return { source: plugin.name, contract: { abi: c.abi, address: c.address, isTemplate: c.isTemplate } }
}

export function getContractAbi(ctx: ProjectContext, name: string, source?: string): AbiFunction[] {
  const { contract } = resolveContract(ctx, name, source)
  if (!contract.abi) throw new Error(`Contract ${name} has no ABI available`)
  return contract.abi
}

export function getContractAddress(
  ctx: ProjectContext,
  name: string,
  source?: string,
  override?: Address,
): Address {
  if (override) return override
  const { contract, source: resolvedSource } = resolveContract(ctx, name, source)
  if (contract.isTemplate) {
    throw new Error(`Contract ${name} is a template — pass an explicit \`address\` argument`)
  }
  if (!contract.address) {
    throw new Error(
      `Contract ${name} (${resolvedSource}) has no deploy address. ` +
        'Pass an explicit `address` argument, or check if the plugin uses dynamic resolution.',
    )
  }
  return contract.address
}

export function findAbiFunction(abi: AbiFunction[], methodName: string, argCount?: number): AbiFunction {
  const candidates = abi.filter((a) => a.type === 'function' && a.name === methodName)
  if (!candidates.length) throw new Error(`Method not found: ${methodName}`)
  if (candidates.length === 1) return candidates[0]
  if (argCount !== undefined) {
    const byArity = candidates.find((c) => (c.inputs?.length ?? 0) === argCount)
    if (byArity) return byArity
  }
  return candidates[0]
}

export function findAbiEvent(abi: AbiFunction[], eventName: string): AbiFunction {
  const event = abi.find((a) => a.type === 'event' && a.name === eventName)
  if (!event) throw new Error(`Event not found: ${eventName}`)
  return event
}

export function findContractByAddress(
  ctx: ProjectContext,
  address: string | null | undefined,
): { name: string; source: string; abi: AbiFunction[] } | null {
  if (!address) return null
  const lower = address.toLowerCase()
  for (const [name, contract] of Object.entries(ctx.config.contracts)) {
    if (contract.address && contract.address.toLowerCase() === lower && contract.abi) {
      return { name, source: 'project', abi: contract.abi }
    }
  }
  for (const plugin of ctx.plugins) {
    for (const [name, contract] of Object.entries(plugin.contracts)) {
      if (contract.address && contract.address.toLowerCase() === lower) {
        return { name, source: plugin.name, abi: contract.abi }
      }
    }
  }
  return null
}

/** Iterate every ABI known to the MCP: project + plugins. Used for blind log
 *  decoding when the emitter's address isn't in any contracts map. */
export function* iterateAllAbis(ctx: ProjectContext): Generator<{ name: string; source: string; abi: AbiFunction[] }> {
  for (const [name, contract] of Object.entries(ctx.config.contracts)) {
    if (contract.abi) yield { name, source: 'project', abi: contract.abi }
  }
  for (const plugin of ctx.plugins) {
    for (const [name, contract] of Object.entries(plugin.contracts)) {
      yield { name, source: plugin.name, abi: contract.abi }
    }
  }
}
