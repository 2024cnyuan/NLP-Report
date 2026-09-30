import { defineConfig } from '@playwright/test';
const dev = process.env.TENSORSCOPE_DEV_TEST === '1';
export default defineConfig({
  testDir: './tests/e2e', timeout: 60000, expect: { timeout: 15000 }, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: dev ? 'docs/evidence/playwright-dev-results.json' : 'docs/evidence/playwright-results.json' }]],
  use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  projects: dev ? [{name:'development',testMatch:'**/development.spec.js'}] : [{name:'offline',testIgnore:'**/development.spec.js'}],
  webServer: dev ? {command:'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',url:'http://127.0.0.1:5187',reuseExistingServer:false} : undefined,
});
