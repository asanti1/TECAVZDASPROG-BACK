import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.smoke-spec.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
