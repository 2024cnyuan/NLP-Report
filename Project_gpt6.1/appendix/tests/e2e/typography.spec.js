import { test, expect } from '../../../tools/testing/playwright.js';
import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const entry = pathToFileURL(fromProject('release/index.html')).href;
async function watch(page) {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  return { errors, requests };
}
async function fontsUsed(page, selector) {
  await page.evaluate(() => document.fonts.ready);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    return (await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  } finally { await session.detach(); }
}
function expectCustomFont(fonts, family) {
  expect(fonts.some(font => font.isCustomFont && font.familyName.includes(family) && font.glyphCount > 0), JSON.stringify(fonts)).toBe(true);
}

test('离线字体：中文SC、英文数字Inter、代码Mono实际使用且WOFF2全部内嵌', async ({ page }) => {
  const audit = await watch(page);
  await page.goto(entry + '#help/data');
  await expect(page.locator('#help-data')).toBeFocused();
  const body = await fontsUsed(page, '#help-data .guide-lead');
  expectCustomFont(body, 'Noto Sans SC');
  expectCustomFont(body, 'Inter');
  const code = await fontsUsed(page, '#help-data .guide-code');
  expectCustomFont(code, 'JetBrains Mono');
  expectCustomFont(code, 'Noto Sans SC');
  expectCustomFont(await fontsUsed(page, '.nav-number'), 'Inter');
  const css = await readFile(fromProject('release/style.css'), 'utf8');
  expect((css.match(/@font-face/g) ?? []).length).toBe(29);
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(match => match[1].replaceAll('"', '').replaceAll("'", ''));
  expect(urls.length).toBe(29);
  expect(urls.every(url => url.startsWith('data:font/woff2;base64,'))).toBe(true);
  expect(css).not.toMatch(/format\(["']?(?:woff|truetype)["']?\)/);
  await page.screenshot({ path: evidencePath('typography-code-1440.png'), animations: 'disabled', style: '#toast{visibility:hidden}' });
  expect(audit.errors).toEqual([]);
  expect(audit.requests).toEqual([]);
});

test('六模块公式：实际KaTeX原配字体、MathML与纯文本原文，数值未被排版替换', async ({ page }) => {
  const audit = await watch(page);
  const cases = [
    ['embeddings', '#inspect-update'],
    ['sequence', '#state-map .matrix-cell'],
    ['cnn', '[data-pool]'],
    ['attention', '#matrix .matrix-cell'],
    ['comparison', '[data-single="NB"]'],
    ['optimization', '#opt-inspect'],
  ];
  for (const [module, selector] of cases) {
    // The inspector intentionally stays open across hash navigation; close it
    // before opening another module's trace so it cannot cover that button.
    if (await page.locator('#close-inspector').isVisible()) await page.locator('#close-inspector').click();
    await page.goto(entry + '#' + module);
    await expect(page.locator('#result-state')).toHaveText('结果已更新');
    await page.locator(selector).first().click();
    await expect(page.locator('.formula .katex').first()).toBeVisible();
    await expect(page.locator('.formula math').first()).toBeAttached();
    await expect(page.locator('.formula .katex-error')).toHaveCount(0);
    // Probe a glyph-bearing span: the KaTeX HTML container has no text of its own.
    expectCustomFont(await fontsUsed(page, '.formula .katex-html .mathnormal'), 'KaTeX');
    await page.locator('.formula-original summary').click();
    await expect(page.locator('.formula-original code')).toBeVisible();
    const fonts = await fontsUsed(page, '.formula-original code');
    expectCustomFont(fonts, 'JetBrains Mono');
    await page.locator('.formula-original summary').click();
    expect(await page.locator('.inspect-value').textContent()).not.toContain('katex');
  }
  await page.screenshot({ path: evidencePath('typography-formula-1440.png'), animations: 'disabled', style: '#toast{visibility:hidden}' });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('.formula .katex').first()).toBeVisible();
    await page.screenshot({ path: evidencePath(`typography-formula-${width}.png`), animations: 'disabled', style: '#toast{visibility:hidden}' });
  }
  expect(audit.errors).toEqual([]);
  expect(audit.requests).toEqual([]);
});
