import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual', timeout: 180000, workers: 1,
  outputDir: 'test-results', reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4182', deviceScaleFactor: 1, actionTimeout: 15000,
    launchOptions: { args: process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --port 4182',
    url: 'http://127.0.0.1:4182', reuseExistingServer: false, timeout: 30000 },
});
