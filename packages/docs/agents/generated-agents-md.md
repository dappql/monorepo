# Generated AGENTS.md

Every `dappql` run writes (or updates) an `AGENTS.md` at your project root. This file is the **project-specific** guide for AI coding agents, a tailored instruction set based on your actual contracts, the ergonomic equivalent of a developer onboarding README for a teammate who's been dropped into your repo cold.

## Why

`AGENTS.md` is an emerging universal convention. Claude Code, Cursor, Codex, Continue, Aider, and other tools read it on project load. A well-written one dramatically reduces how often an agent guesses at syntax or confabulates contract names.

The content dappql generates is **not** generic advice, it lists **your** contracts, **your** method signatures, **your** chain, with ABI-accurate argument placeholders. An agent opening your project sees exactly what's there and exactly how to call it.

## What's inside

A generated `AGENTS.md` has four sections:

**Generated setup**

```
- Contracts directory: `./src/contracts`
- Module system: ESM
- SDK factory: yes, `./src/contracts/sdk` exports `createSdk(publicClient, walletClient, addressResolver)`
- Chain ID: 8453
```

**Contracts in this project**, a table of every contract with shape (singleton or template) and per-method/event counts:

```
| Contract       | Shape     | Reads                 | Writes                        | Events        |
| `Token`        | singleton | `totalSupply`, `balanceOf` | `transfer`, `approve`      | `Transfer`    |
| `UserWallet`   | template  | `owner`, `isAgent`         | `deposit`, `withdraw`      | — |
```

**Use it**, code examples with your actual contract names, chosen methods, and ABI-accurate argument placeholders:

```tsx
import { Token } from './src/contracts'
import { useContextQuery } from '@dappql/react'

const { data, isLoading } = useContextQuery({
  totalSupply: Token.call.totalSupply(),
  balance: Token.call.balanceOf(/* owner */),
})
```

Covers React reads (`useContextQuery`), mutations (`useMutation`), templates (`.at()`), non-React (`@dappql/async`), and the SDK factory (if `isSdk: true`). Which sections appear depend on what's in your config.

**Non-negotiables**, the load-bearing rules agents get wrong without guidance:

- Always import from your `targetPath`, never hand-craft ABIs.
- Never use `useReadContract` / `useReadContracts` / `useWriteContract` directly.
- Default to `useContextQuery` over `useQuery`.
- `uint256` is `bigint`, no plain numbers.
- Addresses are ``\`0x${string}\`\``, checksum untrusted input with viem's `getAddress`.
- `mutation.send(a, b, c)` spreads args, never an array.
- Template contracts require an address, `.at(addr)` on the Request for reads, `address` option for mutations.

## Marker-scoped updates

The CLI writes between two comment markers:

```
<!-- dappql:start -->
...generated content...
<!-- dappql:end -->
```

On every re-run, the CLI **only rewrites content between the markers**. Everything above or below is preserved. This means you can:

- Add a project-specific preamble above the managed block.
- Pin team conventions or deployment notes below it.
- Override or extend the generated guidance inline.

```markdown
# My project's AGENTS.md

## Team conventions

- Use TanStack Router for navigation.
- All amounts in the UI are displayed with 4 decimals.

<!-- dappql:start -->
... dappql-managed content ...
<!-- dappql:end -->

## Deployment

- Staging: branch deploys on merge to `staging`.
- Production: manual approval after staging QA.
```

Re-running `dappql` updates only the middle section. Agents reading the file still see your team content around it.

## Configuration

Controlled by `agentsFile` in `dap.config.js`:

```js
export default {
  // ...
  agentsFile: true,              // default, write ./AGENTS.md at the repo root
  // agentsFile: false,          // opt out entirely
  // agentsFile: './docs/AGENTS.md', // custom path (creates parent dirs if needed)
}
```

`true` is the default. Agents benefit from this file even if you've never thought about agent tooling.

## Relationship to the library reference

Your project `AGENTS.md` and `dappql://docs/library` (via `@dappql/mcp`) are complementary:

| Source | Scope | When to read |
| --- | --- | --- |
| Project `AGENTS.md` | Your contracts, your flags, your examples | "What's in this project?" |
| `dappql://docs/library` | Generic DappQL API surface | "How does useContextQuery work?" |

The project file links to the library reference at the top. An agent reading both has full context, library + specific.

## CLI integration

The CLI emits the file after codegen on every run. Sample output:

```
Generating DappQL code for:

	- Token
	- ToDo

Updated AI-agent guide at ./AGENTS.md

Done! 🎉
```

The log line distinguishes three modes:
- **Created**, file didn't exist, new one written.
- **Updated**, file existed with markers, managed block rewritten in place.
- **Appended to**, file existed without markers, managed block appended at the bottom.

## Don't hand-edit between markers

Changes between `<!-- dappql:start -->` and `<!-- dappql:end -->` are clobbered on the next run. If you want to customize generated content, submit a PR to the dappql codegen template (`packages/codegen/src/createAgentsFile.ts`). If you want to extend for your project, write outside the markers.

## Related

- [Configuration](/guide/configuration), `agentsFile` options.
- [Why AI-first](/agents/why-ai-first), why this file exists.
- [Resources reference](/agents/mcp/resources), how `@dappql/mcp` exposes it.
