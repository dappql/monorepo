# Underscore Finance

One of the first production validations of `@dappql/mcp` was against [Underscore Finance's typescript-sdk](https://github.com/underscore-finance/typescript-sdk), a published DappQL-generated SDK covering 75 contracts on Base (AI agents, lego integrations, Undy yield tokens, vaults, user wallets).

Across four agent sessions in Claude Code, the MCP surface was stressed against real DeFi questions. This page walks through each one to show what working with a dappql-aware agent actually looks like.

---

## Session 1: Protocol overview

**Prompt:** *"what contracts are in this project?"*

The agent called `listContracts` once and grouped 75 contracts semantically:

> **Core protocol** (singletons), UndyHq, Ledger, MissionControl, Kernel, Switchboard (+ Alpha/Bravo/Charlie), Hatchery, Sentinel, Paymaster, Billing, ChequeBook, Migrator, HighCommand, LootDistributor, Appraiser, WalletBackpack, VaultRegistry, DefaultsBase, Helpers, SignatureHelper.
>
> **Lego integrations** (DeFi adapters), Lending: AaveV3, CompoundV3, Euler, Fluid, Moonwell, Morpho, ExtraFi, FortyAcres. DEX: AeroClassic, AeroSlipstream, Curve, UniswapV2, UniswapV3. Other: RipeLego, SkyPsm, Wasabi, Avantis, UnderscoreLego, UndyRewardsLego, LegoBook, LegoTools.
>
> **Undy yield tokens**, UndyUsd, UndyEth, UndyBtc, UndyAero, UndyEurc, UndyUsds, UndyCbeth, UndyGho, UndyVirtual.
>
> **Vaults & agents**, EarnVaultAgent (+SigHelper), LevgVaultAgent (+SigHelper), LevgVaultTools, ConvertVaultToken, AgentSenderGeneric, AgentSenderSpecial (+SigHelper).
>
> **Templates (user-scoped)**, UserWallet, UserWalletConfig, UserWalletSignatureHelper, AgentWrapper, EarnVault, LevgVault, LevgVaultHelper, ERC20, plus V1/V2 legacy variants.

**Why this matters:** without MCP, the agent would have had to read files, infer structure from naming, and probably miss the singleton/template distinction. With MCP, one tool call yields a fully-grouped protocol overview, ready for any follow-up question.

---

## Session 2: DeFi math

**Prompt:** *"how much USDC do I get if I withdraw one UndyUsd?"*

Three MCP calls:
1. `searchMethods({ query: "preview" })`, found `previewRedeem` on UndyUsd.
2. `getContract({ name: "UndyUsd" })`, verified it's an ERC4626 share-to-asset method, 6 decimals.
3. `callRead({ contract: "UndyUsd", method: "previewRedeem", args: ["1000000"] })`, `1 × 10⁶` base units → `1,021,804`.

**Response:**
> Redeeming 1 UndyUsd ≈ 1.021804 USDC (current ratio from `UndyUsd.previewRedeem(1e6)` → 1,021,804 USDC base units; both tokens have 6 decimals; underlying asset is USDC `0x8335...2913`).

**Why this matters:** the agent reasoned through ERC4626 semantics (share-to-asset conversion), handled decimals correctly (bigint math, not floating-point), and cross-referenced the asset address against the USDC canonical. This is the "what's my position worth right now" UX that dApps have wanted natural-language access to for years.

---

## Session 3: Safety catch + graceful fallback

**Prompt:** *"transfer 100 UndyUsd to 0x10099b1386b434Ea4da1967d952931b645Df6250"*

The destination address had been surfaced earlier in the conversation via a `listContracts` response, it's the `WalletBackpack` protocol singleton, not a user wallet. The agent remembered this context.

**Agent:**
> Hold on, before I send anything, two flags:
>
> 1. This is an irreversible on-chain transfer of 100 UndyUsd (≈102.18 USDC worth). I'd like explicit confirmation before broadcasting.
> 2. The destination `0x10099b1386b434Ea4da1967d952931b645Df6250` is the WalletBackpack protocol singleton, not a user wallet. Sending tokens there is very likely to result in permanent loss, protocol contracts typically don't hold or return user ERC20 balances.

**Prompt:** *"yes"*

The agent called `callWrite`, and correctly hit the gate:

> Can't execute, writes are disabled on this MCP server (no signing key, no `mcp.allowWrites` opt-in in `dap.config.js`).
>
> To enable, you'd need both:
> 1. Set `DAPPQL_PRIVATE_KEY` (or `MNEMONIC`) in the MCP env.
> 2. Set `mcp.allowWrites: true` in `dap.config.js`.
>
> Alternatively, send the transfer from your own wallet:
> - Contract: UndyUsd `0xb33852cfd0c22647AAC501a6Af59Bc4210a686Bf`
> - Method: `transfer(address,uint256)`
> - Args: `0x10099b1386b434Ea4da1967d952931b645Df6250`, `100000000` (100 × 10⁶)

**Why this matters:** three things are happening. First, the agent caught a likely foot-gun contextually, protocol addresses aren't human wallets, and ERC20 transfers to them are usually unrecoverable. Nothing in DappQL's code enforced this; the agent inferred it from the `listContracts` response earlier in the conversation. Second, the [double-gate](/agents/mcp/safety) did its job, even with explicit user consent, `callWrite` refused cleanly and explained both gates. Third, the graceful fallback: instead of dead-ending, the agent computed the correct calldata (`100 × 10⁶`), formatted it for wallet-side execution, and offered to help enable the opt-in.

This is the write-safety arc working end-to-end, library guarantees + agent reasoning compounding.

---

## Session 4: APY from historical blocks

**Prompt:** *"what is the current APY of UndyUsd?"*

The agent recognized there was no on-chain APY getter (Undy tokens are ERC4626 vaults, APY is derived from price-per-share growth) and proposed deriving it from a historical block.

It needed the current block number. `@dappql/mcp` didn't have a `chainState` tool yet, so the agent fell back to raw `curl`:

```
curl -s -X POST https://mainnet.base.org -d '{"jsonrpc":"2.0","method":"eth_blockNumber"...}'
```

Then called `callRead` three times, once at the current block, once at ~7 days ago (current − 302,400 blocks, ~2s Base blocks), once at ~30 days ago, with the `block` parameter on each.

**Response:**

| Window | PPS then → now | Growth | Annualized APY |
| --- | --- | --- | --- |
| 7 days | 1.021074 → 1.021805 | +0.0716% | ~3.80% |
| 30 days | 1.018589 → 1.021805 | +0.3157% | ~3.91% |

Formula: `(nowPPS/thenPPS)^(365/days) − 1`. Compounded.

**Why this matters:** non-obvious reasoning that only works because every `previewRedeem` call is typed end-to-end and the `block` parameter on `callRead` works for historical reads. The agent built a multi-window APY estimator in three tool calls + one math step.

**It also surfaced a gap.** The `curl` fallback was the signal to add a `chainState` tool, which shipped in the next MCP release. This is the validation-loop-driven roadmap in action.

---

## Takeaways

These four sessions produced three concrete improvements to `@dappql/mcp`:

1. **`chainState` tool** (v0.1.2), surfaced by the APY session's curl fallback.
2. **`getEvents` + `getTransaction` tools** (v0.1.3), when a gas-usage question triggered 12 bash calls, manual topic hashing, and raw `eth_getLogs` calls.
3. **`getDappqlReference` tool + richer `listContracts` hint** (v0.1.4), when an agent on a fresh session skipped reading the library reference and guessed at `.at()` syntax.

Each gap was caught in the act, fixed within hours, and validated on the next session. That's the feedback loop that designed DappQL's AI-first toolchain, not a priori thinking, but real sessions against real contracts.

## Related

- [Tools reference](/agents/mcp/tools), the full tool surface these sessions used.
- [Safety model](/agents/mcp/safety), how the transfer-safety arc composes.
- [Why AI-first](/agents/why-ai-first), the problem these sessions prove.
