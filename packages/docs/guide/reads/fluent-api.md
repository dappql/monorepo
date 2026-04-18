# Fluent request API

Every `Contract.call.methodName(args)` call returns a typed Request object. Three chainable methods customize behavior per call — and they all live on the Request, not on the contract namespace.

```ts
Token.call.balanceOf(account)    // ← Request<'balanceOf'>
  .at('0x...')                   // override deploy address
  .defaultTo(0n)                 // value shown before the query resolves
  .with({ contractAddress, defaultValue })  // both at once
```

## The rule to remember

`.at()`, `.defaultTo()`, `.with()` **are methods on Request**, not on the namespace.

```ts
// ✅ Correct — method first, then fluent-chain
Token.call.balanceOf(account).at('0x...')

// ❌ Wrong — Token.at() does not exist
Token.at('0x...').call.balanceOf(account)

// ❌ Wrong — there's no .write sub-namespace anywhere
Token.at('0x...').write.transfer(...)
```

If your TypeScript is happy, you've got it right. If you get "property `at` does not exist on `Token`," you're trying to chain on the namespace — move the parens.

## `.at(address)` — override deploy address

Point this single call at a specific contract instance. For **singletons** (fixed address in `dapp.config.js`), this is just an override. For **[template contracts](/guide/templates)**, `.at()` is **required** — template generated code has no `deployAddress` baked in.

```ts
// Singleton — override for this one call only
Token.call.balanceOf(account).at(legacyTokenAddress)

// Template — address mandatory, one per instance
ERC20.call.balanceOf(holder).at(tokenAddress)
UserWallet.call.owner().at(walletAddress)
```

## `.defaultTo(value)` — value before resolution

DappQL's queries always return populated `data` — never `undefined`. Before the first successful fetch, each key holds the ABI's zero-value (`0n`, `''`, `false`, `'0x0000...0'`) *unless* you override with `.defaultTo()`:

```ts
const { data } = useContextQuery({
  balance: Token.call.balanceOf(account).defaultTo(0n),
  owner:   Token.call.owner().defaultTo(ZERO_ADDRESS),
})

// data.balance is 0n while loading; real value after
// data.owner  is ZERO_ADDRESS while loading; real value after
```

Useful when:
- The UI renders immediately and you want a sensible placeholder.
- You want the same fallback pattern whether the query's loaded or not.

## `.with({ contractAddress, defaultValue })` — both at once

```ts
Token.call.balanceOf(account).with({
  contractAddress: tokenAddress,
  defaultValue: 0n,
})
```

Equivalent to chaining `.at(tokenAddress).defaultTo(0n)`. Single call when you need both overrides.

## Composing in a query

All three fluent methods compose freely inside `useContextQuery` / `useQuery` / `useIteratorQuery`:

```tsx
const { data } = useContextQuery({
  // Plain singleton
  supply: Token.call.totalSupply(),

  // Override + default
  legacyBalance: Token.call.balanceOf(account).at(LEGACY_TOKEN).defaultTo(0n),

  // Template — address required
  walletOwner: UserWallet.call.owner().at(walletAddress),
})
```

## What it looks like in generated code

Each read method on a contract's generated module returns a Request with the fluent chain attached. Curious readers can inspect `packages/codegen/src/createContractsCollection.ts` to see the emitted shape — it's a plain object with `with`, `defaultTo`, and `at` mutating itself and returning `this`.

## Related

- [Template contracts](/guide/templates) — when `.at()` is required vs optional.
- [`useContextQuery`](/guide/reads/use-context-query) — the default read hook.
- [Configuration](/guide/configuration) — `isTemplate` in `dapp.config.js`.
