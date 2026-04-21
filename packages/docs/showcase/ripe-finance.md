# Ripe Finance: 5 engineers, 200 contracts, and the library that fell out

> The origin story of DappQL, as told through the project that forced it into existence.

[Ripe](https://ripe.finance) is the reason DappQL exists. For about three years it was the only project using DappQL. It started as a folder inside Ripe's monorepo with a CLI that got rerun every time the contracts team shipped something. In 2025, before Ripe's mainnet launch, it got extracted into its own npm package and pinned in Ripe's production build. But we never pointed anyone at it: no website, no docs, no announcement.

This is the story of how a tool built for a five-person team ended up surviving 200+ testnet contracts, a full governance system, a Base mainnet launch, a viral day that ran the RIPE token from 13 cents to 80 dollars, and roughly three years of weekly ABI churn, all before DappQL had a website, docs, or a single user outside Ripe.

## What Ripe is

Ripe's pitch is *one loan, every asset, maximum power*. Your entire portfolio, ETH, stablecoins, NFTs, tokenized stocks, yield positions, everything, backs a single loan position. No juggling a dozen debt positions across protocols. No idle collateral sitting outside the risk engine. One account, everything productive.

The product scope required a surprising amount of surface area on-chain: every collateral type, every oracle, every rate model, every governance path. At peak we were running 200-ish contracts on testnet, a full governance system with role separation, and a frontend that had to read, write, and stay in sync with all of it.

After a lot of back and forth work, Ripe is live on Base mainnet since July 2025, with 50+ contracts in production today. The frontend tooling came along for the ride.

## Before

Early 2023, the frontend was five engineers on [useDapp](https://usedapp.readthedocs.io), with every contract ABI listed in a `contracts.ts` file and every hook hand-rolled against that list.

It worked fine at 10 contracts. It was painful at 50. At 200 it was untenable.

The concrete failure modes:

- **ABI drift was silent.** The contracts team would refactor a method signature, ship the deploy, and the frontend would continue to compile, because `useContractCall` was string-typed. You'd find out at runtime, usually in a browser tab, usually late.
- **Generated types drifted from declared ones.** We had a second `types.ts` file that hand-copied the ABI shapes into TypeScript. Every ABI change meant editing two files and hoping you got them in sync.
- **Iterator queries over on-chain arrays** (lists of proposals, collateral positions, open loans) were their own special cliff. Fetch the count, loop `getProposalAt(i)`, assemble the multicall, write the results back into React state without causing re-render storms. Every page that showed a list was a 200-line custom hook.

Nobody on the team wanted to touch the contracts module. Features that should have taken a day took a week because half the time was spent in a runtime debugger trying to figure out which hook was silently broken.

## The first version of DappQL

From day one we'd been running an internal codegen. Not a library, not even a CLI, just a local script inside the Ripe repo that read a config file listing every contract + ABI and emitted one typed module per contract, strictly typed from the ABI. On top of that typed surface, the frontend called into two hooks we'd added: `useQuery` for reads and `useMutation` for writes, both wired up to useDapp underneath.

That was v1. A script and two hooks. We built it that way from the start because I could already see what 200 contracts without it was going to look like. On ABI change, TypeScript immediately lit up every call site that was now wrong. Fix them, deploy, done.

## The audit that should have broken everything

The first audit was when v1 earned its keep.

The review came back recommending changes to about a third of the contracts. Storage layout shifts, method renames, access-control tightening, signature changes to emit cleaner events. All reasonable, all necessary. A week of focused refactoring for the contracts team. For any frontend without typed contract context, that same week would have been spent chasing runtime errors across the app until we found them all.

That Monday the audit refactor landed. One codegen run, 23 TypeScript errors, 40 minutes of fixes. No runtime debugging. No silent breakage in prod. The feedback loop was the whole thing.

## Moving to wagmi, without touching our code

At some point we moved off useDapp onto wagmi. The ecosystem momentum was clearly going that way, and wagmi's typing story was better natively. One thing we lost in the move was useDapp's baked-in multicall batching. Every page started loading with 20-30 sequential RPC calls, and Alchemy bills scaled with every feature.

So we rebuilt DappQL on top of wagmi. The public API stayed put: `useQuery` and `useMutation`, same names, same signatures, same call sites across the app. We swapped the engine underneath without touching a single page of Ripe's frontend. That was the moment it clicked that DappQL was a real abstraction, not just a convenience layer.

This second time around, multicall batching became a first-class feature instead of a per-page chore. The codegen grew a proper CLI and picked up `call` and `mutation` namespaces on every generated module. Once the contracts module was typed end-to-end, the rest of the library could be typed too.

## What ended up in the folder

Over the next few months we added:

- **`useContextQuery`**: calls anywhere in the component tree fuse into a single multicall per block. Three components reading from Ripe Hq, the oracle, and a collateral vault? One RPC. No lifting state, no prop-drilling, no "single source of truth" refactors.
- **`useIteratorQuery`**: give it a count and a per-index builder, get back a typed array. Proposals, collateral positions, open loans, all one-liners. The 200-line custom hooks disappeared.
- **`useMutation`**: typed args from the ABI, spread-not-array on send, simulate-before-sign, confirmation tracking, a single `onMutationUpdate` callback at the provider for all transaction UX.
- **`watchBlocks`**: one flag on the provider, every read refetches per block. The governance voting UI updated live without us having to think about it again.

None of this was designed as a library. It was a set of utilities that accreted in response to specific problems, got rewritten a few times as we learned what wanted to be the abstraction, and eventually settled into the shapes we have today.

## Taking it to the backend

At some point we needed some of the same contracts on our backend API. Same ABIs, same types, same typed calls, but no React, no hooks, just async functions. Rather than maintain two contract modules, we added an SDK mode to the codegen: flip `isSdk: true` in the config, and the CLI emits a `createSdk(publicClient, walletClient)` factory with typed async methods for every contract, events included.

One config file, one source of truth for ABIs, two runtime targets: the frontend's hook layer and the backend's direct-call SDK. When the contracts team renamed a method, both sides lit up the next time we ran the codegen.

## The viral day

Ripe lived on testnet for about two and a half years. Not because we wanted it to. The governance system was genuinely hard, and we were building in public with a community of around 150 active testnet users making real transactions every day. Lots of feedback, lots of edge cases, lots of RPC load. By the time we shipped to Base mainnet in July 2025, DappQL had already been through years of production-like traffic.

August 5, 2025 is the day it got tested for real. The RIPE token ran from 13 cents to 80 dollars, Crypto Twitter found the app, and the protocol took in a flood of traders and depositors in a few hours.

Other dApps would have melted their RPC. We had a real moment of anxiety about the Alchemy bill.

Nothing happened. The app stayed smooth. The RPC bill at the end of the month was basically flat. Every page in Ripe was doing one multicall per block, and adding a thousand extra users meant maybe a few more concurrent batches, not a thousand times the RPC calls. The batching layer that had started as a dev ergonomics trick turned out to be a production survival feature.

That was the moment I knew this tooling wasn't just for Ripe. Any dApp with more than a handful of contracts and any hope of going viral needed this.

## Why it took until 2026 to launch

The package existed. It was on npm by 2025, pinned in Ripe's production build, carrying the viral day. What it didn't have was a website, docs, a GitHub org, or anyone outside our team knowing it existed. That's the kind of work that's always worth doing in theory and never quite urgent enough in practice. We were shipping Ripe features. Nobody outside the team was asking for it.

What changed was AI coding agents.

In late 2025 I started using Claude Code and Cursor against the Ripe codebase, and the same typed contract surface that made our feedback loop tight for humans turned out to be exactly what agents needed to produce correct code on the first try. Agents that didn't have the typed context guessed at method names, confused `uint256` for `number`, put `.at()` in the wrong place. Agents that did had a ceiling I hadn't seen before: live DeFi analyst reasoning, historical-block APY derivations, multi-contract safety catches.

The insight generalized. Types that are load-bearing for a team of humans are also load-bearing for an AI agent trying to reason about a protocol. It was time to put a real website behind the package, split the primitives into clean npm packages, and add an MCP server so Claude Code and Cursor could plug straight in.

That's DappQL in 2026.

## What to take from this

DappQL is worth a try at any size. wagmi is technically typed, but you have to do the work: maintain every ABI as `const`, hand-wire every hook, build the multicall layer yourself. DappQL generates all of that from a config file. And with [`@dappql/mcp`](/agents/mcp/setup) plugged into Claude Code or Cursor, the agent can write the queries and mutations for you too. Even on a small dApp, the typed codegen saves you from runtime errors the first time an ABI changes, and the multicall layer saves you RPC calls on any page that reads more than one thing.

Where it really starts to matter is call volume. Pages that do 20+ reads on mount, dozens of contracts in the same tree, anything that could go viral. The thing I'd tell my 2023 self is: **the typed layer pays for itself the first time an ABI changes, and the multicall layer pays for itself the first time you go viral.** You don't need to build it. It exists.

DappQL is MIT-licensed and lives at [dappql.com](https://dappql.com). The live ToDo demo is at [todo.dappql.com](https://todo.dappql.com). The [Underscore Finance case study](/agents/case-studies/underscore) shows what the AI-agent surface actually does against a 75-contract protocol.

And [Ripe](https://ripe.finance) is still shipping. One loan, every asset, maximum power.

*Rocko ([@RockoORama](https://github.com/Rocko-O-Rama)), founding engineer and author of DappQL.*
