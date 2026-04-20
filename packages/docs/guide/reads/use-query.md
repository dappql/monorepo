# useQuery

::: info
Full page coming soon. In the meantime, see [`useContextQuery`](/guide/reads/use-context-query), they share the same input shape.
:::

`useQuery` is the component-scoped version of [`useContextQuery`](/guide/reads/use-context-query). Calls in the same hook invocation batch into one multicall, but the hook does **not** fuse with other components. Reach for it when you need per-hook options: `blockNumber`, `paused`, `refetchInterval`, or `batchSize`.

```tsx
import { useQuery } from '@dappql/react'

const { data } = useQuery(
  { supply: Token.call.totalSupply() },
  { blockNumber: 44_500_000n, paused: !shouldFetch },
)
```

For most app code, prefer [`useContextQuery`](/guide/reads/use-context-query).
