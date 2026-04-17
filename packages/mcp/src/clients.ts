import { createPublicClient, createWalletClient, http, type Chain, type PublicClient, type WalletClient } from 'viem'
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts'
import * as chains from 'viem/chains'

import type { ProjectContext } from './types.js'

function findChain(chainId?: number): Chain | undefined {
  if (!chainId) return undefined
  for (const c of Object.values(chains) as Chain[]) {
    if (c && typeof c === 'object' && 'id' in c && c.id === chainId) return c
  }
  return undefined
}

export function createPublic(ctx: ProjectContext): PublicClient {
  return createPublicClient({
    chain: findChain(ctx.chainId),
    transport: http(ctx.rpcUrl),
  }) as PublicClient
}

export function createWallet(ctx: ProjectContext): WalletClient {
  if (!ctx.writesEnabled) {
    throw new Error(`Cannot create wallet client: ${ctx.writesReason}`)
  }
  const pk = process.env.DAPPQL_PRIVATE_KEY?.trim()
  const mnemonic = process.env.MNEMONIC?.trim()

  const account = pk
    ? privateKeyToAccount(pk as `0x${string}`)
    : mnemonic
      ? mnemonicToAccount(mnemonic)
      : (() => {
          throw new Error('No signing material available')
        })()

  return createWalletClient({
    account,
    chain: findChain(ctx.chainId),
    transport: http(ctx.rpcUrl),
  })
}
