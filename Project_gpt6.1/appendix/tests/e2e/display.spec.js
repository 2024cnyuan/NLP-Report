import { test, expect } from '../../../tools/testing/playwright.js';
import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { pathToFileURL } from 'node:url';
const entry = pathToFileURL(fromProject('release/index.html')).href;
const range = async (page, key, value) => page.locator(`#display-${key}`).evaluate((el, n) => {
  el.value = String(n); el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);
const snapshot = page => page.evaluate(() => ({
  result: JSON.stringify(TensorScope.diagnostics.store.results.attention),
  runId: TensorScope.diagnostics.runtime.runId,
  pageFont: parseFloat(getComputedStyle(document.querySelector('.panel-head h2')).fontSize),
  inspectorFont: parseFloat(getComputedStyle(document.querySelector('.inspect-content h3')).fontSize),
  formulaFont: parseFloat(getComputedStyle(document.querySelector('.formula .katex')).fontSize),
  codeFont: parseFloat(getComputedStyle(document.querySelector('.inspect-content pre')).fontSize),
  box: (() => { const b = document.querySelector('#inspector').getBoundingClientRect(); return { width: b.width, height: b.height, top: b.top, left: b.left, right: b.right, bottom: b.bottom }; })(),
}));

test('字号独立实时调节、显微镜宽高、公式/代码及刷新保持，不改变结果', async ({ page }) => {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  await page.goto(entry + '#attention'); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#matrix .matrix-cell').first().click();
  const before = await snapshot(page);
  await page.getByRole('button', { name: '字号与显微镜设置', exact: true }).click();
  await expect(page.locator('#display-pageFont')).toBeFocused();
  await range(page, 'pageFont', 130);
  const global = await snapshot(page);
  expect(global.pageFont).toBeCloseTo(before.pageFont * 1.3, 1);
  expect(global.inspectorFont).toBeCloseTo(before.inspectorFont, 1);
  await range(page, 'inspectorFont', 150); await range(page, 'inspectorWidth', 660); await range(page, 'inspectorHeight', 700);
  const changed = await snapshot(page);
  expect(changed.inspectorFont).toBeCloseTo(before.inspectorFont * 1.5, 1);
  expect(changed.formulaFont).toBeCloseTo(before.formulaFont * 1.5, 1);
  expect(changed.codeFont).toBeCloseTo(before.codeFont * 1.5, 1);
  expect(changed.box.width).toBe(660); expect(changed.box.height).toBe(700);
  expect(changed.result).toBe(before.result); expect(changed.runId).toBe(before.runId);
  await expect(page.locator('#result-state')).toHaveText('结果已更新'); await expect(page.locator('#save')).toBeEnabled();
  await page.keyboard.press('Escape'); await expect(page.locator('#display-panel')).toBeHidden();
  await expect(page.locator('#display-toggle')).toBeFocused();
  await page.locator('#lock-inspector').click();
  await page.getByRole('button', { name: '显微镜显示设置', exact: true }).click();
  await expect(page.locator('#display-inspectorFont')).toBeFocused(); await range(page, 'inspectorWidth', 700);
  await page.locator('#display-close').click(); await expect(page.locator('#inspector')).toHaveAttribute('data-locked', 'true');
  await page.locator('#close-inspector').click(); await page.reload();
  await expect(page.locator('#result-state')).toHaveText('结果已更新'); await page.locator('#matrix .matrix-cell').first().click();
  const restored = await snapshot(page);
  expect(restored.pageFont).toBeCloseTo(changed.pageFont, 1); expect(restored.inspectorFont).toBeCloseTo(changed.inspectorFont, 1);
  expect(restored.box.width).toBe(700); expect(restored.box.height).toBe(700);
  await page.screenshot({ path: evidencePath('display-inspector-desktop.png'), animations: 'disabled' });
  await page.locator('#inspector-display').click(); await page.locator('#display-reset').click();
  const reset = await snapshot(page);
  expect(reset.pageFont).toBeCloseTo(before.pageFont, 1); expect(reset.inspectorFont).toBeCloseTo(before.inspectorFont, 1);
  expect(reset.box.width).toBe(340); expect(reset.box.height).toBe(620);
  expect(errors).toEqual([]); expect(requests).toEqual([]);
});

test('显微镜拖动与键盘调尺寸；极大字号在窄屏限幅，滚动和关闭仍可用', async ({ page }) => {
  await page.goto(entry + '#attention'); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#matrix .matrix-cell').first().click();
  const b = await page.locator('#resize-inspector').boundingBox();
  await page.mouse.move(b.x + 8, b.y + 8); await page.mouse.down(); await page.mouse.move(b.x - 152, b.y - 72, { steps: 8 }); await page.mouse.up();
  const dragged = await snapshot(page); expect(dragged.box.width).toBe(500); expect(dragged.box.height).toBe(700);
  await page.locator('#resize-inspector').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
  const keyed = await snapshot(page); expect(keyed.box.width).toBe(510); expect(keyed.box.height).toBe(710);
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.locator('#inspector-display').click();
    await range(page, 'pageFont', 150); await range(page, 'inspectorFont', 180); await range(page, 'inspectorWidth', 960); await range(page, 'inspectorHeight', 1200);
    await expect(page.locator('#display-panel')).toBeVisible();
    await page.locator('#display-close').click();
    const state = await snapshot(page);
    expect(state.box.left).toBeGreaterThanOrEqual(0); expect(state.box.top).toBeGreaterThanOrEqual(0);
    expect(state.box.right).toBeLessThanOrEqual(width); expect(state.box.bottom).toBeLessThanOrEqual(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#inspector').evaluate(el => el.scrollTop = el.scrollHeight);
    await expect(page.locator('#close-inspector')).toBeVisible();
    await page.screenshot({ path: evidencePath(`display-inspector-${width}.png`), animations: 'disabled' });
    await page.locator('#close-inspector').click(); await expect(page.locator('#inspector')).toBeHidden();
    await page.locator('#matrix .matrix-cell').first().click();
  }
});

test('本机存储不可用或偏好损坏时可安全调节、重置，不影响计算', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error('storage unavailable'); }; });
  await page.goto(entry + '#attention'); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#display-toggle').click(); await range(page, 'pageFont', 125);
  await expect(page.locator('#display-storage')).toContainText('本次会话仍可调节');
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale'))).toBe('1.25');
  await page.locator('#display-reset').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
});

test('大字号覆盖六模块、真实数据和说明；顶部导航不截断，损坏偏好回退', async ({ page }) => {
  await page.goto(entry + '#attention');
  await page.evaluate(() => localStorage.setItem('tensorscope-display-v1', '{bad json'));
  await page.reload(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#display-toggle').click(); await expect(page.locator('#display-pageFont')).toHaveValue('100');
  await range(page, 'pageFont', 150); await page.locator('#display-close').click();
  await page.setViewportSize({width:390,height:900});
  for(const hash of ['home','embeddings','attention','cnn','sequence','optimization','comparison','comparison/dataset','help/workspace','data']) {
    await page.goto(entry+'#'+hash);
    await expect(page.locator('#display-toggle')).toBeVisible();
    if(['embeddings','attention','cnn','sequence','optimization','comparison'].includes(hash))await expect(page.locator('#result-state')).toHaveText('结果已更新');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const contained=await page.evaluate(()=>{const bar=document.querySelector('.topbar').getBoundingClientRect();return Array.from(document.querySelectorAll('.topbar button,.topbar a,.breadcrumb b')).every(el=>{const r=el.getBoundingClientRect();return r.width===0||r.top>=bar.top&&r.bottom<=bar.bottom;});});
    expect(contained).toBe(true);
  }
});
