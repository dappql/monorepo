<template>
  <div class="home-container">
    <div class="hero-section">
      <img src="/logo-dappql.svg" alt="DappQL" class="hero-logo" style="display: block; margin: 40px auto" />

      <h1 class="hero-title">Smart Contract Query Layer for Web3 Apps</h1>
      <p class="hero-tagline">Type-safe and efficient contract interactions with minimal boilerplate</p>

      <div class="hero-actions">
        <a href="/guide/getting-started" class="button primary"> Get Started </a>
        <a href="https://github.com/dappql/monorepo" class="button"> View on GitHub </a>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <div class="feature-icon">🔐</div>
        <h3>Type Safety</h3>
        <p>Full TypeScript support with auto-generated types for your contracts</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">⚡️</div>
        <h3>Query Optimization</h3>
        <p>Automatic batching of multiple contract reads into efficient multicalls</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔌</div>
        <h3>Easy Integration</h3>
        <p>Built on top of wagmi with a familiar React hooks API</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🏗️</div>
        <h3>Code Generation</h3>
        <p>Eliminate boilerplate with automatic contract code generation</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 1152px;
  margin: 0 auto;
  padding: 64px 24px;
}

.hero-section {
  text-align: center;
  margin-bottom: 64px;
}

.hero-logo {
  width: 240px;
  height: auto;
  margin-bottom: 32px;
}

.hero-title {
  font-size: 48px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 24px;
}

.hero-tagline {
  font-size: 20px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin-bottom: 40px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.button {
  display: inline-block;
  border: 1px solid transparent;
  text-align: center;
  font-weight: 600;
  white-space: nowrap;
  transition:
    color 0.25s,
    border-color 0.25s,
    background-color 0.25s;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
}

.button.primary {
  color: var(--vp-button-brand-text);
  background-color: var(--vp-c-brand);
}

.button.primary:hover {
  background-color: var(--vp-c-brand-dark);
}

.button:not(.primary) {
  border-color: var(--vp-c-border);
}

.button:not(.primary):hover {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.feature-card {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 24px;
  transition:
    border-color 0.25s,
    background-color 0.25s;
}

.feature-card:hover {
  border-color: var(--vp-c-brand);
  background-color: var(--vp-c-bg-soft-up);
}

.feature-icon {
  font-size: 24px;
  margin-bottom: 16px;
}

.feature-card h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--vp-c-text-1);
}

.feature-card p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 36px;
  }

  .hero-tagline {
    font-size: 18px;
  }

  .features {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup>
// Component logic can go here if needed
</script>
