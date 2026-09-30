import { defineConfig } from '@playwright/test';
import { fromProject, toolsDir, evidencePath } from './paths.mjs';
const dev = process.env.TENSORSCOPE_DEV_TEST === '1';
export default defineConfig({
  testDir: fromProject('appendix/tests/e2e'), timeout: 60000, expect: { timeout: 15000 }, workers: 1,
  outputDir: fromProject('appendix/test-results'),
  reporter: [['list'], ['html', { open: 'never', outputFolder: fromProject('appendix/playwright-report') }], ['json', { outputFile: evidencePath(dev ? 'playwright-dev-results.json' : 'playwright-results.json') }]],
  use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  projects: dev ? [{name:'development',testMatch:'**/development.spec.js'}] : [{name:'offline',testIgnore:'**/development.spec.js'}],
  webServer: dev ? {command:'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',cwd:toolsDir,url:'http://127.0.0.1:5187',reuseExistingServer:false} : undefined,
});
