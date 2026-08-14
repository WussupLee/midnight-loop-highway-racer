import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs allow the same production bundle to run locally and
  // from a GitHub Pages repository subpath.
  base: './',
  server: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4176,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
