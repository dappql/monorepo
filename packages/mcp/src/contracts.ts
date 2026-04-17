import type { AbiFunction, AbiParameter, ContractConfig } from '@dappql/codegen'
import type { Address } from 'viem'

import type { DappConfig } from './types.js'

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

export function getContractAbi(config: DappConfig, name: string): AbiFunction[] {
  const contract = config.contracts[name]
  if (!contract) throw new Error(`Contract not found: ${name}`)
  if (!contract.abi) throw new Error(`Contract ${name} has no ABI available`)
  return contract.abi
}

export function getContractAddress(config: DappConfig, name: string, override?: Address): Address {
  const contract = config.contracts[name]
  if (!contract) throw new Error(`Contract not found: ${name}`)
  if (override) return override
  if (contract.isTemplate) {
    throw new Error(`Contract ${name} is a template — pass an explicit \`address\` argument`)
  }
  if (!contract.address) {
    throw new Error(`Contract ${name} has no deploy address in dapp.config.js`)
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
  config: DappConfig,
  address: string | null | undefined,
): { name: string; abi: AbiFunction[] } | null {
  if (!address) return null
  const lower = address.toLowerCase()
  for (const [name, contract] of Object.entries(config.contracts)) {
    if (contract.address && contract.address.toLowerCase() === lower && contract.abi) {
      return { name, abi: contract.abi }
    }
  }
  return null
}
