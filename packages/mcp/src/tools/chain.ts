import { queryWithStatus, singleQuery, type Request } from '@dappql/async'
import type { AbiFunction } from '@dappql/codegen'
import type { Abi, Address } from 'viem'

import { createPublic, createWallet } from '../clients.js'
import { findAbiFunction, getContractAbi, getContractAddress } from '../contracts.js'
import { coerceArgs, serializeValue } from '../serialize.js'
import type { ProjectContext } from '../types.js'

type CallSpec = {
  contract: string
  method: string
  args?: unknown[]
  address?: Address
}

function resolveCall(ctx: ProjectContext, spec: CallSpec) {
  const abi = getContractAbi(ctx.config, spec.contract)
  const address = getContractAddress(ctx.config, spec.contract, spec.address)
  const fn = findAbiFunction(abi, spec.method, spec.args?.length)
  const args = coerceArgs(spec.args ?? [], fn.inputs ?? [])
  return { abi, address, fn, args }
}

// Structural cast: codegen's AbiFunction[] is a looser shape than viem's Abi
// (type field optional vs. literal), but runtime-compatible. viem calls that
// consume this cast their arguments anyway via `as Parameters<...>[0]`.
function asViemAbi(abi: AbiFunction[]): Abi {
  return abi as unknown as Abi
}

function toRequest(spec: CallSpec, abi: AbiFunction[], address: Address, args: readonly unknown[]): Request {
  return {
    contractName: spec.contract,
    method: spec.method,
    args,
    address,
    deployAddress: address,
    getAbi: () => asViemAbi(abi),
  }
}

export const callReadTool = {
  name: 'callRead',
  description:
    'Execute a single read against a contract (view/pure). Returns the decoded result with bigints stringified for JSON. Use `block` to pin to a historical block.',
  inputSchema: {
    type: 'object',
    properties: {
      contract: { type: 'string', description: 'Contract name from dapp.config.js' },
      method: { type: 'string', description: 'Method name (view or pure)' },
      args: { type: 'array', description: 'Arguments in order, raw JSON. uint/int types accept numbers or stringified bigints.' },
      address: { type: 'string', description: 'Override deploy address (required for template contracts).' },
      block: {
        type: 'string',
        description: 'Optional block number (decimal or 0x-prefixed hex) to read state at.',
      },
    },
    required: ['contract', 'method'],
    additionalProperties: false,
  },
  handler: async (args: CallSpec & { block?: string }, ctx: ProjectContext) => {
    const { abi, address, fn, args: callArgs } = resolveCall(ctx, args)
    if (fn.stateMutability !== 'view' && fn.stateMutability !== 'pure') {
      throw new Error(
        `callRead only supports view/pure methods; ${args.contract}.${args.method} is ${fn.stateMutability}. Use simulateWrite or callWrite instead.`,
      )
    }
    const client = createPublic(ctx)
    const request = toRequest(args, abi, address, callArgs)
    const blockNumber = args.block ? BigInt(args.block) : undefined
    const result = await singleQuery(client, request, { blockNumber })
    return { contract: args.contract, method: args.method, address, result: serializeValue(result) }
  },
}

export const multicallTool = {
  name: 'multicall',
  description:
    'Batch multiple reads into a single multicall RPC. Mirrors DappQL\'s useContextQuery batching. Per-call errors are returned inline instead of throwing.',
  inputSchema: {
    type: 'object',
    properties: {
      calls: {
        type: 'array',
        minItems: 1,
        description: 'Ordered list of reads. Each entry has the same shape as callRead input (minus `block`).',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Optional label echoed back on the result entry.' },
            contract: { type: 'string' },
            method: { type: 'string' },
            args: { type: 'array' },
            address: { type: 'string' },
          },
          required: ['contract', 'method'],
          additionalProperties: false,
        },
      },
      block: { type: 'string', description: 'Pin all calls to this block number.' },
    },
    required: ['calls'],
    additionalProperties: false,
  },
  handler: async (
    args: { calls: (CallSpec & { key?: string })[]; block?: string },
    ctx: ProjectContext,
  ) => {
    const client = createPublic(ctx)
    const prepared = args.calls.map((c, i) => {
      const resolved = resolveCall(ctx, c)
      if (resolved.fn.stateMutability !== 'view' && resolved.fn.stateMutability !== 'pure') {
        throw new Error(`call #${i} (${c.contract}.${c.method}) is ${resolved.fn.stateMutability}, not a read`)
      }
      return {
        internalKey: `call${i}`,
        displayKey: c.key ?? `${c.contract}.${c.method}#${i}`,
        contract: c.contract,
        method: c.method,
        address: resolved.address,
        request: toRequest(c, resolved.abi, resolved.address, resolved.args),
      }
    })

    const blockNumber = args.block ? BigInt(args.block) : undefined
    const requests = Object.fromEntries(prepared.map((p) => [p.internalKey, p.request]))
    const results = await queryWithStatus(client, requests, { blockNumber })

    return {
      results: prepared.map((p) => {
        const r = results[p.internalKey]
        return r.ok
          ? {
              key: p.displayKey,
              contract: p.contract,
              method: p.method,
              address: p.address,
              ok: true,
              result: serializeValue(r.result),
            }
          : {
              key: p.displayKey,
              contract: p.contract,
              method: p.method,
              address: p.address,
              ok: false,
              error: r.error?.message ?? 'unknown',
            }
      }),
    }
  },
}

export const simulateWriteTool = {
  name: 'simulateWrite',
  description:
    'Dry-run a write by simulating it via eth_call, without signing or broadcasting. Safe to invoke with no signing key. Returns the decoded simulated return value and gas estimate if simulation succeeded, or the revert reason if it did not.',
  inputSchema: {
    type: 'object',
    properties: {
      contract: { type: 'string' },
      method: { type: 'string' },
      args: { type: 'array' },
      address: { type: 'string', description: 'Override deploy address (required for template contracts).' },
      from: { type: 'string', description: 'The sender address to simulate from. Defaults to the zero address.' },
      value: { type: 'string', description: 'Optional ETH value (wei, decimal or 0x) for payable functions.' },
    },
    required: ['contract', 'method'],
    additionalProperties: false,
  },
  handler: async (
    args: CallSpec & { from?: Address; value?: string },
    ctx: ProjectContext,
  ) => {
    const { abi, address, fn, args: callArgs } = resolveCall(ctx, args)
    if (fn.stateMutability === 'view' || fn.stateMutability === 'pure') {
      throw new Error(`${args.contract}.${args.method} is a read; use callRead instead.`)
    }
    const client = createPublic(ctx)
    try {
      const sim = await client.simulateContract({
        abi,
        address,
        functionName: args.method,
        args: callArgs,
        account: (args.from ?? '0x0000000000000000000000000000000000000000') as Address,
        value: args.value ? BigInt(args.value) : undefined,
      } as Parameters<typeof client.simulateContract>[0])

      let gas: string | null = null
      try {
        const estimate = await client.estimateContractGas({
          abi,
          address,
          functionName: args.method,
          args: callArgs,
          account: (args.from ?? '0x0000000000000000000000000000000000000000') as Address,
          value: args.value ? BigInt(args.value) : undefined,
        } as Parameters<typeof client.estimateContractGas>[0])
        gas = estimate.toString()
      } catch (e) {
        gas = null
      }

      return {
        ok: true,
        contract: args.contract,
        method: args.method,
        address,
        from: args.from ?? null,
        result: serializeValue(sim.result),
        gas,
      }
    } catch (e) {
      return {
        ok: false,
        contract: args.contract,
        method: args.method,
        address,
        from: args.from ?? null,
        error: (e as Error).message,
      }
    }
  },
}

export const callWriteTool = {
  name: 'callWrite',
  description:
    'Sign and broadcast a contract write. Requires double opt-in: `mcp.allowWrites: true` in dapp.config.js AND a signing key in DAPPQL_PRIVATE_KEY or MNEMONIC. Always simulates first; aborts on revert. Returns the tx hash on success — does NOT wait for confirmation (use callRead + block argument to poll).',
  inputSchema: {
    type: 'object',
    properties: {
      contract: { type: 'string' },
      method: { type: 'string' },
      args: { type: 'array' },
      address: { type: 'string' },
      value: { type: 'string', description: 'ETH value in wei (decimal or 0x).' },
      waitForReceipt: {
        type: 'boolean',
        description: 'If true, wait for the tx to be mined and return the receipt. Defaults to false.',
      },
    },
    required: ['contract', 'method'],
    additionalProperties: false,
  },
  handler: async (
    args: CallSpec & { value?: string; waitForReceipt?: boolean },
    ctx: ProjectContext,
  ) => {
    if (!ctx.writesEnabled) {
      throw new Error(`Writes are disabled: ${ctx.writesReason}`)
    }
    const { abi, address, fn, args: callArgs } = resolveCall(ctx, args)
    if (fn.stateMutability === 'view' || fn.stateMutability === 'pure') {
      throw new Error(`${args.contract}.${args.method} is a read; use callRead instead.`)
    }

    const publicClient = createPublic(ctx)
    const wallet = createWallet(ctx)

    // Simulate first — abort on revert.
    const sim = await publicClient.simulateContract({
      abi,
      address,
      functionName: args.method,
      args: callArgs,
      account: wallet.account!,
      value: args.value ? BigInt(args.value) : undefined,
    } as Parameters<typeof publicClient.simulateContract>[0])

    const hash = await wallet.writeContract(sim.request as Parameters<typeof wallet.writeContract>[0])

    if (args.waitForReceipt) {
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      return {
        ok: true,
        contract: args.contract,
        method: args.method,
        address,
        hash,
        receipt: serializeValue(receipt),
      }
    }

    return {
      ok: true,
      contract: args.contract,
      method: args.method,
      address,
      hash,
      note: 'Transaction broadcast — not waiting for confirmation. Poll with callRead or pass waitForReceipt=true to block.',
    }
  },
}
