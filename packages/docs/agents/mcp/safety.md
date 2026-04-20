# Safety model

Giving an AI agent direct access to a live RPC and a signing key is a meaningful blast zone. `@dappql/mcp` takes that seriously. This page is the full gating logic for writes and codegen, plus the design reasoning behind it.

## Core principle: double opt-in

Every mutation surface in `@dappql/mcp`, signing a transaction, rewriting files in your repo, requires **two independent signals** aligned in the same direction. Either alone is not enough.

| Surface | Gate 1, config | Gate 2, env |
| --- | --- | --- |
| `callWrite` (sign + broadcast) | `mcp.allowWrites: true` in `dap.config.js` | `DAPPQL_PRIVATE_KEY` or `MNEMONIC` in env |
| `regenerate` (write codegen files) | `mcp.allowCodegen: true` in `dap.config.js` | (no env gate; config alone) |

The logic is deliberately verbose in error messages, if a write is blocked, the server tells the agent **exactly which gate** failed and what to do about it:

```
writes disabled: not opted in and no signing key available
writes disabled: `mcp.allowWrites: true` missing from dapp.config.js
writes disabled: neither DAPPQL_PRIVATE_KEY nor MNEMONIC is set
```

## Why double-gate writes

A single flag is too easy to misclick. Someone copy-pasting an RPC + key block into a client config shouldn't also unlock write capability, config-side opt-in makes the team's intent explicit in version-controlled source.

A single env var is too easy to leak. A config-side flag without an env key means the team opted in, but no key is present → writes safely disabled on that machine.

Together, the two gates force: **the team intends writes to work** AND **this machine has signing capability**. That combination is rarely accidental.

## `callWrite`: three layers

Even when both gates are open, `callWrite` runs three checks:

1. **Gate check**, `writesEnabled` must be true.
2. **Simulation**, every write runs `simulateContract` before signing. On revert, aborts and returns the revert reason. You cannot broadcast a definitely-failing transaction from the MCP.
3. **Chain match**, the wallet client is scoped to the `chainId` declared in `dap.config.js`. No accidental "oh, I was on the wrong chain."

Response on successful broadcast:

```json
{
  "ok": true,
  "contract": "Token",
  "method": "transfer",
  "address": "0x...",
  "hash": "0x...",
  "note": "Transaction broadcast, not waiting for confirmation."
}
```

With `waitForReceipt: true`, the call blocks until the tx is mined and adds the full receipt to the response.

## `simulateWrite`: the safe version

`simulateWrite` is the dry-run surface. It uses `eth_call` with a caller address (defaults to the zero address if none is given) and never signs anything. **No signing key required.** Safe on any RPC, including production.

This is what agents should reach for by default when asked "what would happen if I called X?", it tells them yes/no, decoded return value, and gas estimate without ever touching a key.

Response on success: `{ ok: true, result, gas, ... }`. Response on revert: `{ ok: false, error, ... }` with the revert reason.

## Codegen gating

`regenerate` writes files in your repo, typed contract modules plus the project `AGENTS.md`. That's a smaller blast zone than chain writes, but still not something you want an agent doing silently.

A single config flag gates it:

```js
// dap.config.js
export default {
  // ...
  mcp: { allowCodegen: true },
}
```

No env gate, codegen needs no secrets. When disabled, the `regenerate` tool throws with the exact reason, same pattern as writes.

A separate `dryRun: true` option lets agents preview what `regenerate` *would* emit without touching the filesystem. Great for "if I add this contract to the config, what changes?" workflows.

## What this does NOT protect against

Be honest about the boundaries:

- **Intentional transfers to the wrong address.** A user who says "yes, send it" to an agent still has the final word. Simulate-first catches reverts, not mistakes. Address recognition is on the agent's reasoning layer (see the WalletBackpack catch in the [Underscore case study](/agents/case-studies/underscore)), not enforced by the library.
- **Compromised keys.** If `DAPPQL_PRIVATE_KEY` leaks, the gates don't help, the attacker can write directly. Keep the key scoped (burner wallet on testnet, or an account with minimal balance).
- **Prompt injection.** An agent that reads attacker-controlled content (logs, events, page titles) could be convinced to call `callWrite` with attacker-chosen args. The double-gate prevents casual misuse; it does not prevent determined adversarial prompts. For production use, run the MCP server in a sandbox with budget limits on the signer wallet.
- **Supply-chain attacks on `@dappql/mcp` itself.** Pinned versions in your MCP config are your defense. `npx @dappql/mcp@0.1.4` is safer than `npx -y @dappql/mcp`.

## Recommended production posture

| Environment | `allowWrites` | Signing key | `allowCodegen` |
| --- | --- | --- | --- |
| Local dev, reading mainnet | `false` | absent | `false` |
| Local dev, testnet burner | `true` | testnet PK | `true` |
| Dev machine, mainnet writes | `true` | hot wallet, funded small | `false` |
| CI / automated | `false` (read-only) | absent | `false` |
| Server deploy | usually `false`; writes go through your own app's signer, not the MCP | — | — |

**Default position**: start read-only. Flip `allowWrites: true` only when you actively want the agent to sign things, with a wallet whose blast radius you're comfortable with.

## Auditing

On boot, the server logs its full state to stderr:

```
[@dappql/mcp] Writes: ENABLED, writes enabled (opted in + signing key present)
[@dappql/mcp] Codegen: ENABLED, codegen enabled (mcp.allowCodegen: true)
```

Or, when gated:

```
[@dappql/mcp] Writes: disabled, writes disabled: not opted in and no signing key available
[@dappql/mcp] Codegen: disabled, codegen disabled: `mcp.allowCodegen: true` missing from dapp.config.js
```

This is your first-look audit: if you spawn a `dappql` MCP process and the logs say writes are enabled when you didn't intend them to be, something is misconfigured.

## Related

- [MCP setup](/agents/mcp/setup), how to toggle the gates.
- [Tools reference](/agents/mcp/tools), `simulateWrite` vs `callWrite` usage.
- [Underscore case study](/agents/case-studies/underscore), the write-safety arc working end-to-end.
