import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/demo.ts', '**/run.ts'],
      reporter: ['text', 'lcov'],
    },
    projects: [
      {
        // cli package tests
        test: {
          name: 'cli',
          include: ['packages/cli/tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'auth',
          include: ['packages/auth/tests/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
})
