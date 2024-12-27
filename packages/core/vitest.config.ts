import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    silent: false,
    logHeapUsage: true,
  },
})
