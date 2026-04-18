# Template contracts

Some contracts are deployed at many addresses — user wallets, ERC20 tokens, Uniswap V3 pools, vaults. For those, baking a single `deployAddress` into the generated module doesn't make sense. Flag them as **templates** and DappQL generates code that requires you to pass the address at each callsite.

## Declaring a template

Set `isTemplate: true` on the contract entry in `dapp.config.js`:

```js
export default {
  targetPath: './src/contracts',
  contracts: {
    // Singleton — address is baked in
    Token: {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      abi: [/* ... */],
    },

    // Template — address provided per use
    ERC20: {
      isTemplate: true,
      abi: [/* ... */],
    },

    UserWallet: {
      isTemplate: true,
      abi: [/* ... */],
    },
  },
}
```

You can omit `address` entirely on templates, or keep a canonical one for reference (useful when the ABI is loaded from an implementation contract).

## Reading from templates — `.at()`

`.at(address)` is a method on the Request object returned by `Contract.call.method(args)`. It's **required** on templates, optional on singletons.

```tsx
import { ERC20, UserWallet } from './src/contracts'
import { useContextQuery } from '@dappql/react'

const { data } = useContextQuery({
  // Template — .at() required
  usdcBalance: ERC20.call.balanceOf(account).at(USDC),
  daiBalance:  ERC20.call.balanceOf(account).at(DAI),

  // Different template, different instance
  walletOwner: UserWallet.call.owner().at(walletAddress),
})
```

See [Fluent request API](/guide/reads/fluent-api) for why `.at()` lives on the Request, not the namespace.

## Writing to templates — `address` in options

For [`useMutation`](/guide/mutations), pass the instance address in the options object:

```tsx
import { ERC20, UserWallet } from './src/contracts'
import { useMutation } from '@dappql/react'

// ERC20 approve on USDC
const approve = useMutation(ERC20.mutation.approve, {
  transactionName: 'Approve USDC',
  address: USDC,
})
approve.send(spender, amount)

// Deposit to a specific user wallet
const deposit = useMutation(UserWallet.mutation.deposit, {
  transactionName: 'Deposit',
  address: walletAddress,
})
deposit.send(assetAddress, amount)
```

Without `address`, the mutation has no idea which instance to send to — `send()` throws.

## Iterating over templates

Combine templates with [`useIteratorQuery`](/guide/reads/use-iterator-query) to read from many instances:

```tsx
const { data: balances } = useIteratorQuery(
  BigInt(walletAddresses.length),
  (i) => UserWallet.call.totalBalance().at(walletAddresses[Number(i)]),
)
```

Or use `useContextQuery` directly when you have a fixed list:

```tsx
const { data } = useContextQuery({
  usdc: ERC20.call.balanceOf(account).at(USDC),
  usdt: ERC20.call.balanceOf(account).at(USDT),
  dai:  ERC20.call.balanceOf(account).at(DAI),
  weth: ERC20.call.balanceOf(account).at(WETH),
})
```

## SDK-factory view

When you flip `isSdk: true`, template contracts on the generated `createSdk` factory are **function calls**, not chained:

```ts
import createSdk from './src/contracts/sdk'

const sdk = createSdk(publicClient, walletClient)

// ✅ SDK template — call the namespace as a function
const usdc = sdk.ERC20('0x...')
const balance = await usdc.balanceOf(account)

// ❌ Wrong — .at() is the React/async pattern, not the SDK factory pattern
sdk.ERC20.at('0x...').balanceOf(account)
```

Two separate worlds, two separate syntaxes. Use `.at()` for React hooks and `@dappql/async`; use `Contract(address)` for the SDK factory. See [SDK generation](/guide/sdk-generation) for why.

## Address resolution for templates

Templates accept `addressResolver` too — if you know which instance a given reference-name corresponds to, encode it in the resolver. But typically templates are addressed explicitly at the callsite, since their whole reason to exist is that there's no single canonical address.

## Gotchas

- **Forgetting `.at()` on a template read throws at runtime** — the request has no address to target.
- **Don't use `.at()` for writes** — use the `address` option in `useMutation` instead. They're separate surfaces.
- **Templates in SDK mode are function-calls, not chained.** Mixing up `.at()` here is the #1 agent mistake.
- **If a template contract's generated file is missing reads (`Contract.call` is undefined)**, the template ABI has no `view`/`pure` functions — add them to the ABI in your config.

## Related

- [Fluent request API](/guide/reads/fluent-api) — where `.at()` actually lives.
- [Mutations](/guide/mutations) — the `address` option for template writes.
- [SDK generation](/guide/sdk-generation) — the function-call pattern for templates in SDK mode.
- [`useIteratorQuery`](/guide/reads/use-iterator-query) — templates + iteration.
