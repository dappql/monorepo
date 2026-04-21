import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'DappQL',
  description:
    'Make smart contracts fluent for humans and agents. An agent-native data layer on wagmi + viem.',
  appearance: 'dark',
  cleanUrls: true,
  // TODO: drop once all sidebar pages are filled in. Content is being written
  // progressively; this unblocks CI while pages land.
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    ['meta', { name: 'theme-color', content: '#057aff' }],
    ['meta', { property: 'og:title', content: 'DappQL: make smart contracts fluent for humans and agents' }],
    ['meta', {
      property: 'og:description',
      content: 'An agent-native data layer on wagmi + viem. Typed codegen, React hooks, publishable SDKs, live MCP server.',
    }],
    ['meta', { property: 'og:image', content: 'https://dappql.com/icon.png' }],
    ['meta', { property: 'og:url', content: 'https://dappql.com' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'DappQL: make smart contracts fluent for humans and agents' }],
    ['meta', {
      name: 'twitter:description',
      content: 'An agent-native data layer on wagmi + viem.',
    }],
  ],
  themeConfig: {
    logo: '/logo-dappql.svg',
    siteTitle: false,
    search: { provider: 'local' },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'AI Agents', link: '/agents/why-ai-first' },
      { text: 'Showcase', link: '/showcase/' },
      {
        text: 'Packages',
        items: [
          { text: '@dappql/react', link: 'https://www.npmjs.com/package/@dappql/react' },
          { text: '@dappql/async', link: 'https://www.npmjs.com/package/@dappql/async' },
          { text: '@dappql/mcp', link: 'https://www.npmjs.com/package/@dappql/mcp' },
          { text: '@dappql/codegen', link: 'https://www.npmjs.com/package/@dappql/codegen' },
          { text: 'dappql (CLI)', link: 'https://www.npmjs.com/package/dappql' },
        ],
      },
      { text: 'GitHub', link: 'https://github.com/dappql/core' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Provider setup', link: '/guide/provider' },
          ],
        },
        {
          text: 'Reads',
          items: [
            { text: 'useContextQuery', link: '/guide/reads/use-context-query' },
            { text: 'useQuery', link: '/guide/reads/use-query' },
            { text: 'useIteratorQuery', link: '/guide/reads/use-iterator-query' },
            { text: 'Fluent request API', link: '/guide/reads/fluent-api' },
          ],
        },
        {
          text: 'Writes',
          items: [
            { text: 'useMutation', link: '/guide/mutations' },
            { text: 'Global tx UX', link: '/guide/mutations-global' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Template contracts', link: '/guide/templates' },
            { text: 'Address resolution', link: '/guide/address-resolver' },
            { text: 'Events', link: '/guide/events' },
            { text: 'Per-block reactivity', link: '/guide/per-block-reactivity' },
          ],
        },
        {
          text: 'Beyond React',
          items: [
            { text: 'Outside React (@dappql/async)', link: '/guide/outside-react' },
            { text: 'SDK generation', link: '/guide/sdk-generation' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Migrating from wagmi', link: '/guide/migrating-from-wagmi' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
      ],
      '/agents/': [
        {
          text: 'AI agents',
          items: [
            { text: 'Why AI-first', link: '/agents/why-ai-first' },
            { text: 'Generated AGENTS.md', link: '/agents/generated-agents-md' },
          ],
        },
        {
          text: '@dappql/mcp server',
          items: [
            { text: 'Setup', link: '/agents/mcp/setup' },
            { text: 'Tools', link: '/agents/mcp/tools' },
            { text: 'Resources', link: '/agents/mcp/resources' },
            { text: 'Safety model', link: '/agents/mcp/safety' },
          ],
        },
        {
          text: 'Case studies',
          items: [{ text: 'Underscore Finance', link: '/agents/case-studies/underscore' }],
        },
      ],
      '/showcase/': [
        {
          text: 'Showcase',
          items: [
            { text: 'Overview', link: '/showcase/' },
            { text: 'Ripe Finance', link: '/showcase/ripe-finance' },
            { text: 'Underscore Finance', link: '/agents/case-studies/underscore' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dappql/core' },
      { icon: 'x', link: 'https://x.com/DappQl' },
    ],
    editLink: {
      pattern: 'https://github.com/dappql/core/edit/main/packages/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message:
        'Released under the MIT license · <a href="mailto:contact@dappql.com">contact@dappql.com</a> · <a href="https://x.com/DappQl" target="_blank" rel="noreferrer">@DappQl</a>',
      copyright: 'Copyright © DappQL Team',
    },
  },
})
