<template>
  <div class="home-container">
    <div class="hero-section">
      <img src="/logo-dappql.svg" alt="DappQL" class="hero-logo" />

      <h1 class="hero-title">The data layer for dApp frontends</h1>
      <p class="hero-tagline">
        Typed codegen on top of <a href="https://wagmi.sh" target="_blank" rel="noreferrer">wagmi</a> +
        <a href="https://viem.sh" target="_blank" rel="noreferrer">viem</a>.<br />Built for humans and AI agents.
      </p>

      <div class="hero-actions">
        <a href="/guide/getting-started" class="button primary">Get started</a>
        <a href="/agents/why-ai-first" class="button">For AI agents</a>
        <a href="https://github.com/dappql/core" class="button ghost">GitHub</a>
      </div>
    </div>

    <div class="features">
      <a href="/guide/configuration" class="feature-card">
        <div class="feature-icon">🔐</div>
        <h3>Typed codegen from ABIs</h3>
        <p>Point DappQL at your contracts, get a fully typed SDK. When an ABI changes, TypeScript tells you exactly what broke.</p>
      </a>
      <a href="/agents/why-ai-first" class="feature-card feature-card--accent">
        <div class="feature-icon">🤖</div>
        <h3>AI-agent ready</h3>
        <p>Every project ships with a generated <code>AGENTS.md</code>. Plug in <code>@dappql/mcp</code> and Claude Code, Cursor, or any MCP client gets live, typed contract access — reads, simulated writes, events, gated execution.</p>
      </a>
      <a href="/guide/sdk-generation" class="feature-card">
        <div class="feature-icon">📦</div>
        <h3>Publishable typed SDK</h3>
        <p>Flip <code>isSdk: true</code> and the CLI emits a <code>createSdk</code> factory — full typed protocol SDK, events included. Ship it to npm for your whole team or ecosystem.</p>
      </a>
      <a href="/guide/reads/use-context-query" class="feature-card">
        <div class="feature-icon">⚡</div>
        <h3>Auto multicall batching</h3>
        <p>Reads from across your entire component tree fuse into one RPC. <code>useContextQuery</code> handles the batching; you write ergonomic code.</p>
      </a>
      <a href="/guide/per-block-reactivity" class="feature-card">
        <div class="feature-icon">🔁</div>
        <h3>Per-block reactivity</h3>
        <p>Opt in with <code>watchBlocks</code> and every query stays in sync with chain state. No hand-rolled subscriptions.</p>
      </a>
      <a href="/guide/reads/use-iterator-query" class="feature-card">
        <div class="feature-icon">🧭</div>
        <h3>Iterator queries</h3>
        <p>Paginate on-chain arrays with a single hook. Deterministic batching, bigint-safe indexing.</p>
      </a>
    </div>

    <div class="quick-example">
      <h2>Four reads. One RPC. Fully typed.</h2>
      <pre class="hl"><code><span class="k">import</span> { <span class="id">Token</span> } <span class="k">from</span> <span class="s">'./src/contracts'</span>
<span class="k">import</span> { <span class="id">useContextQuery</span> } <span class="k">from</span> <span class="s">'@dappql/react'</span>
<span class="k">import</span> { <span class="id">formatUnits</span> } <span class="k">from</span> <span class="s">'viem'</span>

<span class="k">export function</span> <span class="fn">TokenStats</span>({ account }) {
  <span class="k">const</span> { data, isLoading } = <span class="fn">useContextQuery</span>({
    balance:  <span class="id">Token</span>.<span class="p">call</span>.<span class="fn">balanceOf</span>(account),
    symbol:   <span class="id">Token</span>.<span class="p">call</span>.<span class="fn">symbol</span>(),
    decimals: <span class="id">Token</span>.<span class="p">call</span>.<span class="fn">decimals</span>(),
    supply:   <span class="id">Token</span>.<span class="p">call</span>.<span class="fn">totalSupply</span>(),
  })

  <span class="k">if</span> (isLoading) <span class="k">return</span> <span class="t">&lt;Spinner /&gt;</span>
  <span class="k">return</span> (
    <span class="t">&lt;p&gt;</span>
      {<span class="fn">formatUnits</span>(data.balance, data.decimals)} / <span class="s">{' '}</span>
      {<span class="fn">formatUnits</span>(data.supply, data.decimals)} {data.symbol}
    <span class="t">&lt;/p&gt;</span>
  )
}</code></pre>
    </div>

    <div class="used-by">
      <p class="used-by-label">In production at</p>
      <div class="used-by-links">
        <a href="https://ripe.finance" target="_blank" rel="noreferrer">Ripe Finance</a>
        <span>·</span>
        <a href="https://underscore.finance" target="_blank" rel="noreferrer">Underscore</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 64px 24px 96px;
}

.hero-section {
  text-align: center;
  margin-bottom: 72px;
}

.hero-logo {
  width: 220px;
  height: auto;
  margin: 16px auto 28px;
  display: block;
}

.hero-title {
  font-size: 52px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 20px;
  background: linear-gradient(120deg, var(--vp-c-text-1) 30%, var(--vp-c-brand) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-tagline {
  font-size: 20px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  max-width: 640px;
  margin: 0 auto 40px;
}

.hero-tagline a {
  color: var(--vp-c-brand);
  font-weight: 500;
}

.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.button {
  display: inline-block;
  border: 1px solid var(--vp-c-border);
  font-weight: 600;
  padding: 12px 22px;
  border-radius: 9999px;
  font-size: 15px;
  transition: all 0.2s;
  text-decoration: none;
}
.button.primary {
  color: var(--vp-button-brand-text);
  background-color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
}
.button.primary:hover {
  background-color: var(--vp-c-brand-dark);
  border-color: var(--vp-c-brand-dark);
}
.button:not(.primary):hover {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
}
.button.ghost {
  background: transparent;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 20px;
  margin-bottom: 72px;
}

.feature-card {
  display: block;
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 14px;
  padding: 28px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -12px rgba(5, 122, 255, 0.25);
}
.feature-card:hover h3 {
  color: var(--vp-c-brand);
}
.feature-card--accent {
  background: linear-gradient(135deg, var(--vp-c-bg-soft) 0%, rgba(5, 122, 255, 0.08) 100%);
  border-color: rgba(5, 122, 255, 0.35);
}
.feature-icon {
  font-size: 28px;
  margin-bottom: 14px;
}
.feature-card h3 {
  font-size: 19px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--vp-c-text-1);
  letter-spacing: -0.01em;
  transition: color 0.2s;
}
.feature-card p {
  color: var(--vp-c-text-2);
  line-height: 1.55;
  font-size: 15px;
}
.feature-card code {
  font-size: 13px;
  background-color: var(--vp-c-bg-alt);
  padding: 2px 6px;
  border-radius: 4px;
}

.quick-example {
  margin-bottom: 72px;
}
.quick-example h2 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 20px;
  text-align: center;
}
.quick-example pre {
  background-color: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 24px 28px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.55;
}
.quick-example code {
  font-family: var(--vp-font-family-mono);
  white-space: pre;
  color: var(--vp-c-text-1);
}

/* Minimal syntax highlighting — hand-styled because this is a Vue template,
   not a markdown code block (VitePress/Shiki doesn't reach here). Palette
   approximates one-dark-pro for the dark theme we're locked to. */
.hl .k   { color: #c678dd; }           /* keywords: import, const, function, if, return, from */
.hl .s   { color: #98c379; }           /* strings */
.hl .fn  { color: #61afef; }           /* function calls */
.hl .id  { color: #e5c07b; }           /* identifiers (Token, useContextQuery, formatUnits) */
.hl .p   { color: #e06c75; }           /* properties (.call) */
.hl .t   { color: #56b6c2; }           /* JSX tags (<Spinner />, <p>) */

.used-by {
  text-align: center;
}
.used-by-label {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--vp-c-text-3);
  margin-bottom: 12px;
}
.used-by-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 17px;
  font-weight: 500;
}
.used-by-links a {
  color: var(--vp-c-text-1);
  text-decoration: none;
  border-bottom: 1px solid var(--vp-c-border);
  padding-bottom: 2px;
}
.used-by-links a:hover {
  color: var(--vp-c-brand);
  border-bottom-color: var(--vp-c-brand);
}
.used-by-links span {
  color: var(--vp-c-text-3);
}

@media (max-width: 768px) {
  .hero-title { font-size: 38px; }
  .hero-tagline { font-size: 17px; }
  .quick-example pre { font-size: 12px; padding: 18px; }
}
</style>
