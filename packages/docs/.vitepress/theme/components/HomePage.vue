<template>
  <div class="home-container">
    <div class="hero-section">
      <img src="/logo-dappql.svg" alt="DappQL" class="hero-logo" />

      <h1 class="hero-title">
        Make smart contracts fluent<br />for <span class="accent">humans</span> and <span class="accent">agents</span>.
      </h1>
      <p class="hero-tagline">
        An agent-native data layer on <a href="https://wagmi.sh" target="_blank" rel="noreferrer">wagmi</a> +
        <a href="https://viem.sh" target="_blank" rel="noreferrer">viem</a>.
      </p>

      <div class="hero-actions">
        <a href="/guide/getting-started" class="button primary">Get started</a>
        <a href="https://todo.dappql.com" target="_blank" rel="noreferrer" class="button">Live demo</a>
        <a href="/agents/why-ai-first" class="button">For AI agents</a>
        <a href="https://github.com/dappql/core" class="button ghost">GitHub</a>
      </div>
    </div>

    <section class="familiar-section">
      <div class="familiar-inner">
        <div class="problem-solution">
          <h2>Sound Familiar?</h2>
          <div class="ps-grid">
            <div class="ps-list">
              <div class="ps-header" aria-hidden="true">
                <div class="ps-header-problem">Without DappQL</div>
                <div class="ps-header-arrow">→</div>
                <div class="ps-header-solution">With DappQL</div>
              </div>
              <a class="ps-row" href="/guide/configuration">
                <div class="ps-problem"><span>"ABIs change and my frontend silently breaks."</span></div>
                <div class="ps-arrow">→</div>
                <div class="ps-solution"><span>TypeScript lights up every broken call site the moment you regenerate.</span></div>
              </a>
              <a class="ps-row" href="/guide/reads/use-context-query">
                <div class="ps-problem"><span>"Every page fires 20+ RPC calls on mount."</span></div>
                <div class="ps-arrow">→</div>
                <div class="ps-solution"><span>All reads across your tree fuse into one multicall per block.</span></div>
              </a>
              <a class="ps-row" href="/agents/mcp/setup">
                <div class="ps-problem"><span>"Agents hallucinate method names on my contracts."</span></div>
                <div class="ps-arrow">→</div>
                <div class="ps-solution"><span>Generated <code>AGENTS.md</code> + <code>@dappql/mcp</code> give them live, typed access.</span></div>
              </a>
              <a class="ps-row" href="/guide/sdk-generation">
                <div class="ps-problem"><span>"I need the same contracts on my backend too."</span></div>
                <div class="ps-arrow">→</div>
                <div class="ps-solution"><span>One flag, full <code>createSdk</code> factory with events included.</span></div>
              </a>
              <a class="ps-row" href="/agents/mcp/plugins">
                <div class="ps-problem"><span>"I want typed context for protocols I build on."</span></div>
                <div class="ps-arrow">→</div>
                <div class="ps-solution"><span>Install any DappQL-packaged protocol; <code>@dappql/mcp</code> auto-discovers its contracts.</span></div>
              </a>
            </div>
            <a href="/showcase/ripe-finance" class="origin-callout">
              <div class="origin-copy">
                <h3>Built in production, then extracted.</h3>
                <p>DappQL lived inside Ripe Finance for three years. 200+ contracts on testnet, a Base mainnet launch, and a viral day that didn't melt the RPC bill. Read how it got there.</p>
              </div>
              <span class="origin-cta">Read the Ripe story →</span>
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="features-section">
      <h2>Main Features</h2>
      <div class="features">
        <a href="/guide/configuration" class="feature-card">
        <div class="feature-icon">🔐</div>
        <h3>Typed codegen from ABIs</h3>
        <p>Point DappQL at your contracts, get a fully typed SDK. When an ABI changes, TypeScript tells you exactly what broke.</p>
      </a>
      <a href="/agents/why-ai-first" class="feature-card feature-card--accent">
        <div class="feature-icon">🤖</div>
        <h3>AI-agent ready</h3>
        <p>Every project ships with a generated <code>AGENTS.md</code>. Plug in <code>@dappql/mcp</code> and Claude Code, Cursor, or any MCP client gets live, typed contract access: reads, simulated writes, events, gated execution.</p>
      </a>
      <a href="/guide/publishing" class="feature-card">
        <div class="feature-icon">📦</div>
        <h3>Publishable typed SDK</h3>
        <p>Flip <code>isSdk: true</code>, run <code>dappql pack</code>, publish to npm. Your package ships typed contracts + ABIs + a manifest that <code>@dappql/mcp</code> auto-discovers. Consumers, humans and AI agents, import and get full context.</p>
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
    </section>

    <section class="live-example-section">
      <h2>See It Live.</h2>
      <a
        href="https://github.com/underscore-finance/undy-buddy"
        target="_blank"
        rel="noreferrer"
        class="live-card"
      >
        <div class="live-card-copy">
          <div class="live-card-eyebrow">underscore-finance / undy-buddy</div>
          <h3>Any MCP-aware agent, talking fluently to a live DeFi protocol.</h3>
          <p>
            One <code>npm install</code>. Claude Code, Codex, or Cursor instantly gains typed access to
            Underscore Finance's 76 contracts on Base — live reads, event queries, simulated writes.
            No codegen, no custom wiring. Just the plugin-discovery flow DappQL unlocks, wrapped in a
            curated agent persona.
          </p>
        </div>
        <span class="live-card-cta">View on GitHub →</span>
      </a>
    </section>

    <div class="quick-example">
      <h2>Four Reads. One RPC. Fully Typed.</h2>
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

    <div class="contact">
      <p>
        Questions, feedback, or want to ship something with DappQL?
        <a href="mailto:contact@dappql.com">contact@dappql.com</a>
        ·
        <a href="https://x.com/DappQL" target="_blank" rel="noreferrer">@DappQL</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 64px 24px 96px;

  /* Theme-aware tints. Defaults target dark mode (the original palette);
     the :root:not(.dark) block below overrides for light mode. Using CSS
     vars keeps every tint in one place and avoids duplicating selectors. */
  --ps-problem-bg: rgba(255, 255, 255, 0.02);
  --ps-arrow-bg: rgba(5, 122, 255, 0.06);
  --ps-solution-bg: rgba(255, 255, 255, 0.04);

  --origin-gradient: linear-gradient(135deg, rgba(5, 122, 255, 0.04) 0%, rgba(5, 122, 255, 0.12) 100%);
  --origin-gradient-hover: linear-gradient(135deg, rgba(5, 122, 255, 0.07) 0%, rgba(5, 122, 255, 0.18) 100%);

  --feature-accent-gradient: linear-gradient(135deg, var(--vp-c-bg-soft) 0%, rgba(5, 122, 255, 0.08) 100%);
  --feature-accent-border: rgba(5, 122, 255, 0.35);
  --feature-hover-shadow: 0 8px 24px -12px rgba(5, 122, 255, 0.25);

  /* one-dark-pro palette (dark mode default) */
  --hl-keyword: #c678dd;
  --hl-string: #98c379;
  --hl-fn: #61afef;
  --hl-id: #e5c07b;
  --hl-prop: #e06c75;
  --hl-tag: #56b6c2;
}

:root:not(.dark) .home-container {
  /* Light-mode column tints: subtle dark overlays so the three problem /
     arrow / solution columns remain distinguishable on a light background.
     White overlays (the dark defaults) are invisible on light. */
  --ps-problem-bg: rgba(0, 0, 0, 0.025);
  --ps-arrow-bg: rgba(5, 122, 255, 0.08);
  --ps-solution-bg: rgba(0, 0, 0, 0.045);

  /* Brand-blue tints need higher opacity on light to read with the same
     visual weight as on dark. */
  --origin-gradient: linear-gradient(135deg, rgba(5, 122, 255, 0.06) 0%, rgba(5, 122, 255, 0.18) 100%);
  --origin-gradient-hover: linear-gradient(135deg, rgba(5, 122, 255, 0.1) 0%, rgba(5, 122, 255, 0.24) 100%);

  --feature-accent-gradient: linear-gradient(135deg, var(--vp-c-bg-soft) 0%, rgba(5, 122, 255, 0.12) 100%);
  --feature-accent-border: rgba(5, 122, 255, 0.45);
  --feature-hover-shadow: 0 8px 24px -12px rgba(5, 122, 255, 0.35);

  /* one-light palette for the hand-rolled code block */
  --hl-keyword: #a626a4;
  --hl-string: #50a14f;
  --hl-fn: #4078f2;
  --hl-id: #c18401;
  --hl-prop: #e45649;
  --hl-tag: #0184bc;
}

.hero-section {
  text-align: center;
  margin-bottom: 72px;
}

.hero-logo {
  width: 300px;
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
  color: var(--vp-c-text-1);
}
.hero-title .accent {
  color: var(--vp-c-brand);
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

.familiar-section {
  background-color: var(--vp-c-bg-alt);
  padding: 72px 0;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  margin-bottom: 72px;
}
.familiar-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
}

.problem-solution {
  margin-bottom: 0;
}
.problem-solution h2 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 40px;
  text-align: left;
}
.ps-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 12px;
  overflow: hidden;
  background-color: var(--vp-c-bg-soft);
}
.ps-list {
  display: flex;
  flex-direction: column;
}
.ps-row {
  display: grid;
  grid-template-columns: minmax(0, 3fr) auto minmax(0, 4fr);
  gap: 0;
  padding: 0;
  background-color: transparent;
  text-decoration: none;
  color: inherit;
  transition: background-color 0.2s;
}
.ps-row:hover .ps-solution {
  color: var(--vp-c-brand);
}
.ps-row:focus-visible,
.origin-callout:focus-visible {
  outline: 2px solid var(--vp-c-brand);
  outline-offset: -2px;
}
.ps-header {
  display: grid;
  grid-template-columns: minmax(0, 3fr) auto minmax(0, 4fr);
  gap: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
}
.ps-header-problem,
.ps-header-arrow,
.ps-header-solution {
  padding: 14px 22px 10px;
}
.ps-header-arrow {
  padding-left: 20px;
  padding-right: 20px;
  background-color: var(--ps-arrow-bg);
  font-size: 20px;
  line-height: 1;
  text-align: center;
  color: transparent;
}
.ps-header-problem {
  background-color: var(--ps-problem-bg);
  color: var(--vp-c-text-3);
}
.ps-header-solution {
  background-color: var(--ps-solution-bg);
  color: var(--vp-c-brand);
}
.ps-row:last-child .ps-problem,
.ps-row:last-child .ps-solution {
  padding-bottom: 30px;
}
.ps-row:last-child .ps-arrow {
  padding-top: 18px;
  padding-bottom: 30px;
}
.ps-problem {
  font-size: 15px;
  color: var(--vp-c-text-2);
  font-style: italic;
  line-height: 1.5;
  background-color: var(--ps-problem-bg);
  padding: 18px 22px;
  display: flex;
  align-items: center;
}
.ps-arrow {
  color: var(--vp-c-brand);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  background-color: var(--ps-arrow-bg);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ps-solution {
  font-size: 15px;
  color: var(--vp-c-text-1);
  line-height: 1.5;
  font-weight: 500;
  background-color: var(--ps-solution-bg);
  padding: 18px 22px;
  display: flex;
  align-items: center;
}
.ps-solution code {
  font-size: 13px;
  background-color: var(--vp-c-bg-alt);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 400;
}

.origin-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
  padding: 28px 32px 40px;
  background: var(--origin-gradient);
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}
.origin-callout:hover {
  background: var(--origin-gradient-hover);
}
.origin-copy {
  flex: 1;
}
.origin-callout h3 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 8px;
  color: var(--vp-c-text-1);
}
.origin-callout p {
  color: var(--vp-c-text-2);
  line-height: 1.55;
  font-size: 15px;
  max-width: 680px;
  margin: 0;
}
.origin-cta {
  color: var(--vp-c-brand);
  font-weight: 600;
  font-size: 15px;
  flex-shrink: 0;
  white-space: nowrap;
}

.features-section {
  margin-bottom: 72px;
}
.features-section h2 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 40px;
  text-align: left;
}

.live-example-section {
  margin-bottom: 72px;
}
.live-example-section h2 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 40px;
  text-align: left;
}
.live-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  padding: 36px 40px;
  border-radius: 14px;
  background: var(--origin-gradient);
  border: 1px solid var(--feature-accent-border);
  text-decoration: none;
  color: inherit;
  transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.live-card:hover {
  background: var(--origin-gradient-hover);
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
  box-shadow: var(--feature-hover-shadow);
}
.live-card-copy {
  flex: 1;
  min-width: 0;
}
.live-card-eyebrow {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-brand);
  margin-bottom: 10px;
  letter-spacing: -0.01em;
}
.live-card h3 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
  color: var(--vp-c-text-1);
}
.live-card p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
  font-size: 15px;
  max-width: 680px;
  margin: 0;
}
.live-card p code {
  font-size: 13px;
  background-color: var(--vp-c-bg-alt);
  padding: 2px 6px;
  border-radius: 4px;
}
.live-card-cta {
  color: var(--vp-c-brand);
  font-weight: 600;
  font-size: 15px;
  flex-shrink: 0;
  white-space: nowrap;
}
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 20px;
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
  box-shadow: var(--feature-hover-shadow);
}
.feature-card:hover h3 {
  color: var(--vp-c-brand);
}
.feature-card--accent {
  background: var(--feature-accent-gradient);
  border-color: var(--feature-accent-border);
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
  margin-bottom: 40px;
  text-align: left;
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

/* Minimal syntax highlighting, hand-styled because this is a Vue template,
   not a markdown code block (VitePress/Shiki doesn't reach here). Tokens
   pull from CSS vars declared on .home-container: one-dark-pro in dark mode,
   one-light in light mode. */
.hl .k   { color: var(--hl-keyword); }  /* keywords: import, const, function, if, return, from */
.hl .s   { color: var(--hl-string); }   /* strings */
.hl .fn  { color: var(--hl-fn); }       /* function calls */
.hl .id  { color: var(--hl-id); }       /* identifiers (Token, useContextQuery, formatUnits) */
.hl .p   { color: var(--hl-prop); }     /* properties (.call) */
.hl .t   { color: var(--hl-tag); }      /* JSX tags (<Spinner />, <p>) */

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

.contact {
  margin-top: 56px;
  text-align: center;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.contact a {
  color: var(--vp-c-brand);
  font-weight: 500;
  text-decoration: none;
}
.contact a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .hero-title { font-size: 38px; }
  .hero-tagline { font-size: 17px; }
  .quick-example pre { font-size: 12px; padding: 18px; }
}

@media (max-width: 720px) {
  .ps-header {
    display: none;
  }
  .ps-row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 16px 18px;
  }
  .ps-list {
    padding: 20px 0;
  }
  .ps-row:first-child .ps-problem,
  .ps-row:first-child .ps-solution {
    padding-top: 0;
  }
  .ps-row:last-child .ps-problem,
  .ps-row:last-child .ps-solution {
    padding-bottom: 0;
  }
  .ps-arrow {
    display: none;
  }
  .ps-problem {
    display: block;
    background: transparent;
    padding: 0;
  }
  .ps-solution {
    display: block;
    background: transparent;
    padding: 0 0 0 12px;
    border-left: 2px solid var(--vp-c-brand);
  }
  .origin-callout {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 24px;
  }
  .live-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 24px;
  }
  .live-card h3 {
    font-size: 19px;
  }
}
</style>
