import { test, expect } from '../../../tools/testing/playwright.js';
import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const entry = pathToFileURL(fromProject('release/index.html')).href;
const chapters = ['quickstart', 'workspace', 'modes', 'modules', 'data', 'notebook', 'workflow', 'faq', 'datasets', 'diagnosis', 'learning'];

async function watchOffline(page) {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  return { errors, requests };
}

test('使用说明：目录、深链接、刷新、前进后退和键盘定位', async ({ page }) => {
  const audit = await watchOffline(page);
  await page.goto(entry + '#help');
  await expect(page.locator('.guide-toc > a')).toHaveCount(11);
  await expect(page.locator('.guide-figure svg[role="img"]')).toHaveCount(3);
  for (const id of chapters) {
    const link = page.locator(`.guide-toc > a[href="#help/${id}"]`);
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(entry + '#help/' + id);
    await expect(page.locator('#help-' + id)).toBeFocused();
    await expect(page.locator(`.guide-toc > a[href="#help/${id}"]`)).toHaveAttribute('aria-current', 'location');
    const top = await page.locator('#help-' + id).evaluate(el => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(70);
    expect(top).toBeLessThan(id === 'learning' ? 780 : 150);
    await expect(page.locator('.nav-link[data-page="help"]')).toHaveClass(/active/);
  }
  // FAQ is no longer the last chapter; set the history origin explicitly.
  await page.goto(entry + '#help/faq');
  await expect(page.locator('#help-faq')).toBeFocused();
  await page.locator('#help-faq .guide-link').click();
  await expect(page.locator('#guide-title')).toBeInViewport();
  await page.goBack();
  await expect(page.locator('#help-faq')).toBeFocused();
  await page.goForward();
  await expect(page.locator('#guide-title')).toBeInViewport();
  await page.goto(entry + '#help/data');
  await page.reload();
  await expect(page.locator('#help-data')).toBeFocused();
  await page.goto(entry + '#help/%22%5D');
  await expect(page.locator('#guide-title')).toBeInViewport();
  expect(audit.errors).toEqual([]);
  expect(audit.requests).toEqual([]);
});

test('使用说明例子：跳入注意力，检查、掩码 A/B 与保存', async ({ page }) => {
  const audit = await watchOffline(page);
  await page.goto(entry + '#help/quickstart');
  await page.locator('#help-quickstart a.btn').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('#matrix .matrix-cell')).toHaveCount(20);
  const cell = page.locator('#matrix .matrix-cell[data-row="0"][data-col="3"]');
  await cell.click();
  await expect(page.locator('.inspect-content')).toContainText('理解 → 语言');
  await page.getByLabel('关闭检查器').click();
  await page.locator('#freeze').click();
  await page.locator('#mask-edit').click();
  await cell.click();
  await expect(cell).toHaveClass(/masked/);
  await expect(page.getByRole('heading', { name: 'A / B · 受控对照' })).toBeVisible();
  const values = await page.evaluate(() => TensorScope.diagnostics.store.results.attention.result.weights[0]);
  expect(values[3]).toBe(0);
  expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
  await page.locator('#mask-edit').click();
  await cell.click();
  await expect(page.locator('.inspect-value')).toHaveText('0.000000');
  await page.getByLabel('关闭检查器').click();
  await page.locator('#save').click();
  await page.locator('#record-name').fill('注意力掩码对照');
  await page.locator('#record-notes').fill('屏蔽理解→语言，剩余权重和为1。');
  await page.locator('#modal-save').click();
  await page.goto(entry + '#notebook');
  await expect(page.locator('#record-list')).toContainText('注意力掩码对照');
  expect(audit.errors).toEqual([]);
  expect(audit.requests).toEqual([]);
});

test('使用说明示例 CSV：本地下载、预览、确认并重新训练', async ({ page }) => {
  const audit = await watchOffline(page);
  await page.goto(entry + '#help/data');
  const waiting = page.waitForEvent('download');
  await page.locator('#help-download-csv').click();
  const file = await waiting;
  expect(file.suggestedFilename()).toBe('TensorScope-导入示例.csv');
  const buffer = await readFile(await file.path());
  expect(buffer.toString('utf8').trim().split('\n')).toHaveLength(9);
  await page.locator('#help-data a[href="#data"]').click();
  await page.locator('#dataset-file').setInputFiles({ name: file.suggestedFilename(), mimeType: 'text/csv', buffer });
  await expect(page.locator('#data-preview')).toContainText('完整解析 8 条');
  await page.locator('#confirm-data').click();
  await expect(page.locator('#active-dataset')).toContainText('TensorScope-导入示例.csv');
  await page.locator('#active-dataset a[href="#comparison"]').click();
  await expect(page.locator('#compare-train')).toBeVisible();
  await page.locator('#compare-epochs').fill('2');
  await page.locator('#compare-train').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('#compare-result')).toContainText('2 条完整计算');
  expect(audit.errors).toEqual([]);
  expect(audit.requests).toEqual([]);
});

test('使用说明：模块入口与桌面、平板、手机图文布局', async ({ page }) => {
  const audit = await watchOffline(page);
  for (const id of ['embeddings', 'sequence', 'cnn', 'attention', 'comparison', 'optimization']) {
    await page.goto(entry + '#help/modules');
    await page.locator(`.guide-module a[href="#${id}"]`).click();
    await expect(page.locator('#result-state')).toHaveText('结果已更新');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(entry + '#help');
    await expect(page.locator('#guide-title')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: evidencePath(`help-${width}.png`), animations: 'disabled', style: '#toast{visibility:hidden}' });
    await page.goto(entry + '#help/quickstart');
    await expect(page.locator('#help-quickstart')).toBeFocused();
    await page.screenshot({ path: evidencePath(`help-example-${width}.png`), animations: 'disabled', style: '#toast{visibility:hidden}' });
    const figure = page.locator('#help-quickstart .guide-figure');
    if (width === 390) {
      expect(await figure.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
      await figure.evaluate(el => { el.scrollLeft = el.scrollWidth; });
      expect(await figure.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
  }
  expect(audit.errors).toEqual([]);
  expect(audit.requests).toEqual([]);
});
