# Global transaction UX

One of DappQL's most useful conveniences: every mutation in your app emits lifecycle events to a single provider-level callback. Wire toasts, analytics, Sentry, Segment, or any other side effect **once**, and every `useMutation` in every component automatically triggers it.

No prop-drilling. No per-hook `onSuccess` / `onError` glue. One function.

## Wiring it up

```tsx
import { DappQLProvider } from '@dappql/react'
import { toast } from 'your-toast-library'

<DappQLProvider
  onMutationUpdate={({ status, contractName, functionName, transactionName, txHash, error, args, account, address }) => {
    if (status === 'submitted') toast.info(`Submitting ${transactionName || functionName}…`)
    if (status === 'signed')    toast.info(`${transactionName || functionName} signed`, { txHash })
    if (status === 'success')   toast.success(`${transactionName || functionName} confirmed`)
    if (status === 'error')     toast.error(error?.message ?? 'Transaction failed')
  }}
>
  {children}
</DappQLProvider>
```

## The `MutationInfo` shape

Every event fires with the same object:

```ts
type MutationInfo = {
  id: string                    // unique per send() — stable across the lifecycle
  status: 'submitted' | 'signed' | 'success' | 'error'
  account?: Address             // signer
  address: Address              // contract address
  contractName: string          // e.g. "Token"
  functionName: string          // e.g. "transfer"
  transactionName?: string      // whatever you passed to useMutation(config, name)
  txHash?: Address              // hash, available from 'signed' onward
  args?: readonly unknown[]     // what the user called send() with
  error?: Error                 // populated on 'error'
  receipt?: TransactionReceipt  // populated on 'success'
}
```

Use `id` to correlate events across the same transaction — the same `id` fires on `submitted`, then `signed` (with `txHash`), then either `success` (with `receipt`) or `error`.

## Lifecycle

```
┌────────────┐    sign fails   ┌────────┐
│ submitted  │────────────────▶│ error  │
└──────┬─────┘                 └────────┘
       │ signed
       ▼
┌────────────┐   mining fails   ┌────────┐
│   signed   │─────────────────▶│ error  │
└──────┬─────┘                  └────────┘
       │ mined
       ▼
┌────────────┐
│  success   │
└────────────┘
```

Every send produces either `submitted → signed → success` (happy path) or `submitted → error` / `signed → error` (failure).

## Patterns

### Toast with a "view on explorer" link

```tsx
const toastOptions = {
  action: (txHash: string) => ({
    label: 'View',
    onClick: () => window.open(`https://basescan.org/tx/${txHash}`),
  }),
}

onMutationUpdate={({ status, transactionName, txHash, error }) => {
  if (status === 'signed' && txHash) {
    toast.info(`${transactionName} sent`, { action: toastOptions.action(txHash) })
  }
  if (status === 'success' && txHash) {
    toast.success(`${transactionName} confirmed`, { action: toastOptions.action(txHash) })
  }
  if (status === 'error') toast.error(error?.message ?? 'Failed')
}}
```

### Sentry breadcrumbs + error capture

```tsx
import * as Sentry from '@sentry/browser'

onMutationUpdate={(info) => {
  Sentry.addBreadcrumb({
    category: 'mutation',
    message: `${info.contractName}.${info.functionName} → ${info.status}`,
    data: { txHash: info.txHash, args: info.args?.map(String) },
  })
  if (info.status === 'error' && info.error) {
    Sentry.captureException(info.error, {
      tags: {
        contract: info.contractName,
        function: info.functionName,
      },
    })
  }
}}
```

### Analytics

```tsx
import { track } from '@segment/analytics-next'

onMutationUpdate={({ status, contractName, functionName, transactionName, account, txHash }) => {
  if (status === 'submitted') {
    track('tx_submitted', { contract: contractName, function: functionName, transactionName, account })
  }
  if (status === 'success') {
    track('tx_confirmed', { contract: contractName, function: functionName, txHash, account })
  }
  if (status === 'error') {
    track('tx_failed', { contract: contractName, function: functionName, account })
  }
}}
```

### Persisting a "pending transactions" tray

```tsx
const [pending, setPending] = useState<MutationInfo[]>([])

<DappQLProvider
  onMutationUpdate={(info) => {
    setPending((prev) => {
      if (info.status === 'submitted' || info.status === 'signed') {
        const idx = prev.findIndex((p) => p.id === info.id)
        return idx === -1 ? [...prev, info] : prev.map((p) => (p.id === info.id ? info : p))
      }
      // success / error — remove from pending
      return prev.filter((p) => p.id !== info.id)
    })
  }}
>
```

A growing tray of in-flight transactions for the UI shell, kept in sync with every `useMutation` in the app.

## `transactionName` matters

Pass meaningful names to `useMutation` — they're what appears in the global callback and the UI:

```tsx
// Generic, boring
useMutation(Token.mutation.transfer)
// onMutationUpdate sees: functionName: 'transfer', transactionName: undefined

// Named, speakable
useMutation(Token.mutation.transfer, 'Send USDC')
// onMutationUpdate sees: transactionName: 'Send USDC'
```

`'Send USDC'` reads better in a toast than `Token.transfer`.

## Interaction with per-call options

`onMutationUpdate` fires for **every** mutation, regardless of whether individual `useMutation` hooks override `simulate`, `address`, etc. The callback is global.

If you want per-hook side effects, layer them on top of the provider callback — the per-hook state (`mutation.isSuccess`, etc.) is still available in your component.

## Server-rendered / no-window contexts

`onMutationUpdate` only fires on client-side mutations (writes require a wallet). On the server, no mutations happen, so the callback is never invoked. Safe to pass a callback that uses browser-only APIs — just handle the undefined window case if needed:

```tsx
onMutationUpdate={(info) => {
  if (typeof window === 'undefined') return
  // ... browser-only logic
}}
```

## Related

- [`useMutation`](/guide/mutations) — per-hook surface and options.
- [Provider setup](/guide/provider) — all provider options.
- [Safety model](/agents/mcp/safety) — MCP-side write gating.
