import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'DappQL',
  description: 'Smart Contract Query Layer for Web3 Apps',
  appearance: 'dark',
  themeConfig: {
    logo: '/logo-dappql.svg',
    siteTitle: false,
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/hooks' },
      { text: 'CLI', link: '/cli/configuration' },
      { text: 'GitHub', link: 'https://github.com/dappql/monorepo' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Hooks',
          items: [
            { text: 'useQuery', link: '/api/hooks/use-query' },
            { text: 'useMutation', link: '/api/hooks/use-mutation' },
            { text: 'useContextQuery', link: '/api/hooks/use-context-query' },
          ],
        },
      ],
      '/cli/': [
        {
          text: 'CLI',
          items: [
            { text: 'Configuration', link: '/cli/configuration' },
            { text: 'Commands', link: '/cli/commands' },
          ],
        },
      ],
    },
    colors: {
      primary: {
        50: '#e6f1ff',
        100: '#cce3ff',
        200: '#99c7ff',
        300: '#66aaff',
        400: '#338eff',
        500: '#057aff',
        600: '#0062cc',
        700: '#004999',
        800: '#003166',
        900: '#001833',
      },
    },
  },
})
