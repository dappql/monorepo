import createSdk from './contracts/sdk.js'
import type { SDK } from './contracts/sdk.js'
import type { PublicClient, WalletClient } from 'viem'

/**
 * A thin wrapper around the DappQL-generated `createSdk` factory that
 * demonstrates how a protocol team can enrich the raw SDK before publishing.
 */
export class ToDoSDK {
  readonly inner: SDK

  constructor(publicClient: PublicClient, walletClient?: WalletClient) {
    this.inner = createSdk(publicClient, walletClient)
  }

  /** Convenience wrapper around `ToDo.numItems` — no manual BigInt handling. */
  async itemCount(account: `0x${string}`): Promise<number> {
    const n = await this.inner.ToDo.numItems(account)
    return Number(n)
  }

  /** Fetch every item for an account as a typed array. */
  async allItems(account: `0x${string}`) {
    const count = await this.itemCount(account)
    return Promise.all(
      Array.from({ length: count }, (_, i) => this.inner.ToDo.item(account, BigInt(i))),
    )
  }
}

// Re-export the raw factory for advanced use
export { createSdk }
export type { SDK }
