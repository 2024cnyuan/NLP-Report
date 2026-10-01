import { test, expect } from '../../../tools/testing/playwright.js';
import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const entry = pathToFileURL(fromProject('release/index.html')).href;
const boot = async (page, module) => { await page.goto(entry + '#' + module); await expect(page.locator('#result-state')).toHaveText('结果已更新'); };
const closeInspector = async page => { if (await page.locator('#close-inspector').isVisible()) await page.locator('#close-inspector').click(); };
const numberAt = async (page, id) => Number(await page.locator(`[data-trace-key="${id}"] .trace-value`).textContent());
const metrics = page => page.locator('.analysis-panel').first();
async function capture(page, options) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot(options);
}
async function audit(page) {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  return { errors, requests };
}
async function explicitAttention(page) {
  await boot(page, 'attention');
  await page.locator('#source').fill('a b'); await page.locator('#target').fill('q');
  await page.locator('#method').selectOption('dot'); await page.locator('#dim').fill('2');
  await page.getByText('显式 Q / K / V', { exact: true }).click();
  await page.locator('#explicit-q').fill('[[1,0]]');
  await page.locator('#explicit-k').fill('[[1,0],[0,1]]');
  await page.locator('#explicit-v').fill('[[2,0],[0,4]]');
  await page.locator('#attention-run').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
}

test('Attention 真实计算链：代入值、维度、掩码、过期保护与指标差值', async ({ page }) => {
  const check = await audit(page); await explicitAttention(page);
  await expect(page.locator('.trace-stage')).toHaveCount(6);
  expect(await numberAt(page, 'score')).toBe(1);
  expect(await numberAt(page, 'softmax')).toBeCloseTo(.73105857863, 6);
  expect(await numberAt(page, 'output')).toBeCloseTo(1.46211715726, 6);
  await page.locator('#trace-output-dimension').selectOption('1');
  expect(await numberAt(page, 'output')).toBeCloseTo(1.07576568548, 6);
  await page.getByRole('button', { name: '检查行归一化权重', exact: true }).click();
  await expect(page.locator('.inspect-content pre')).toContainText('denominator');
  await expect(page.locator('.formula .katex')).toBeVisible(); await closeInspector(page);
  const unchanged = await page.locator('[data-trace-key="output"] .trace-value').textContent();
  await page.locator('#explicit-v').fill('[[2,0],[0,8]]');
  await expect(page.locator('#result-state')).toHaveText('参数已修改 · 结果过期');
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.locator('[data-trace-key="output"] .trace-value')).toHaveText(unchanged);
  await page.locator('#attention-run').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#trace-output-dimension').selectOption('1');
  expect(await numberAt(page, 'output')).toBeCloseTo(2.15153137096, 6);
  await page.locator('#freeze').click(); await page.locator('#mask-edit').click();
  await page.locator('#matrix .matrix-cell').first().click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  expect(await numberAt(page, 'score')).toBe(1); expect(await numberAt(page, 'softmax')).toBe(0);
  await page.locator('#trace-output-dimension').selectOption('1'); expect(await numberAt(page, 'output')).toBe(8);
  await expect(metrics(page).locator('[data-metric="entropy"] dd')).toHaveText('0.000000');
  await expect(metrics(page).locator('[data-delta="masked"] td').last()).toHaveText('1.000000');
  await page.locator('.computation-panel').screenshot({ path: evidencePath('computation-attention-chain.png'), animations: 'disabled', style: '.topbar,#toast{visibility:hidden}' });
  await capture(page, { path: evidencePath('computation-attention-1440.png'), fullPage: true, animations: 'disabled', style: '#toast{visibility:hidden}' });
  expect(check.errors).toEqual([]); expect(check.requests).toEqual([]);
});

test('CNN 乘加→激活→真实池化位置→分类；改核后重算及A/B', async ({ page }) => {
  const check = await audit(page); await boot(page, 'cnn');
  await expect(page.locator('.trace-stage')).toHaveCount(6);
  await page.getByRole('button', { name: '检查逐项卷积乘加', exact: true }).click();
  await expect(page.locator('.inspect-content pre')).toContainText('products');
  await expect(page.locator('.inspect-content pre')).toContainText('bias'); await closeInspector(page);
  await page.locator('#freeze').click();
  const before = await page.evaluate(() => window.TensorScope.diagnostics.store.results.cnn.trace);
  await page.locator('#kernel-index').fill('0'); await page.locator('#kernel-value').fill('1.5'); await page.locator('#kernel-apply').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  const after = await page.evaluate(() => window.TensorScope.diagnostics.store.results.cnn.trace);
  expect(after.features[0].raw).not.toEqual(before.features[0].raw);
  expect(await numberAt(page, 'convolution')).toBeCloseTo(after.features[0].raw[0], 6);
  expect(await numberAt(page, 'pool')).toBeCloseTo(after.features[0].value, 6);
  expect(await numberAt(page, 'prediction')).toBeCloseTo(after.probabilities[after.prediction], 6);
  await page.locator('#cnn-probabilities .bar-row').first().click();
  expect(await numberAt(page, 'prediction')).toBeCloseTo(after.probabilities[0], 6);
  await expect(page.locator('#trace-cnn-class')).toHaveValue('0'); await closeInspector(page);
  await expect(metrics(page).locator('.analysis-comparison')).toContainText('B−A');
  await page.getByRole('button', { name: '检查最大池化与位置', exact: true }).click();
  await expect(page.locator('.inspect-content pre')).toContainText(`"winner": ${after.features[0].winner + 1}`); await closeInspector(page);
  await page.locator('#cnn-next').click();
  expect(await numberAt(page, 'convolution')).toBeCloseTo(after.features[0].raw[1], 6);
  await page.locator('.computation-panel').screenshot({ path: evidencePath('computation-cnn-chain.png'), animations: 'disabled', style: '.topbar,#toast{visibility:hidden}' });
  await capture(page, { path: evidencePath('computation-cnn-1440.png'), fullPage: true, animations: 'disabled', style: '#toast{visibility:hidden}' });
  expect(check.errors).toEqual([]); expect(check.requests).toEqual([]);
});

test('LSTM 四门仿射→c/h→最终输出梯度；维度联动与窄屏', async ({ page }) => {
  const check = await audit(page); await boot(page, 'sequence');
  await page.locator('#sequence-algorithm').selectOption('LSTM'); await page.locator('#sequence-run').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('.trace-stage')).toHaveCount(11);
  await page.locator('#sequence-next').click(); await page.locator('#trace-state-dimension').selectOption('1');
  const current = await page.evaluate(() => window.TensorScope.diagnostics.store.results.sequence);
  expect(await numberAt(page, 'gate-i')).toBeCloseTo(current.trace.states[0].gates.i[1], 6);
  expect(await numberAt(page, 'cell')).toBeCloseTo(current.trace.states[0].cell[1], 6);
  expect(await numberAt(page, 'hidden')).toBeCloseTo(current.trace.states[0].hidden[1], 6);
  await page.locator('#sequence-probs .bar-row').first().click();
  expect(await numberAt(page, 'prediction')).toBeCloseTo(current.trace.probabilities[0], 6);
  await page.getByRole('button', { name: '检查输入门 i', exact: true }).click();
  await expect(page.locator('.inspect-content pre')).toContainText('preactivation');
  await expect(page.locator('.inspect-content pre')).toContainText('recurrentProducts'); await closeInspector(page);
  await page.locator('#freeze').click(); await page.locator('#sequence-scale').fill('2');
  await expect(page.locator('#result-state')).toHaveText('参数已修改 · 结果过期');
  await page.locator('#sequence-run').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  const changed = await page.evaluate(() => window.TensorScope.diagnostics.store.results.sequence);
  expect(changed.trace.states[1].hidden).not.toEqual(current.trace.states[1].hidden);
  await page.locator('#sequence-next').click(); await page.locator('#sequence-next').click();
  expect(await numberAt(page, 'hidden')).toBeCloseTo(changed.trace.states[1].hidden[0], 6);
  await expect(metrics(page).locator('.analysis-comparison')).toContainText('口径匹配');
  await page.locator('.computation-panel').screenshot({ path: evidencePath('computation-lstm-chain.png'), animations: 'disabled', style: '.topbar,#toast{visibility:hidden}' });
  await capture(page, { path: evidencePath('computation-lstm-1440.png'), fullPage: true, animations: 'disabled', style: '#toast{visibility:hidden}' });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('[data-trace-key="gate-i"]')).toBeVisible();
    await capture(page, { path: evidencePath(`computation-lstm-${width}.png`), fullPage: true, animations: 'disabled', style: '#toast{visibility:hidden}' });
  }
  expect(check.errors).toEqual([]); expect(check.requests).toEqual([]);
});

test('分析记录与报告：保存A/B、刷新保留，导入篡改的基线数值仍重新计算', async ({ page }) => {
  const check = await audit(page); await explicitAttention(page);
  await page.locator('#freeze').click(); await page.locator('#mask-edit').click();
  await page.locator('#matrix .matrix-cell').first().click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#export').click(); const waitReport = page.waitForEvent('download'); await page.locator('#export-md').click();
  const report = await readFile(await (await waitReport).path(), 'utf8');
  expect(report).toContain('## 结果分析'); expect(report).toContain('| 屏蔽连接数 |'); expect(report).toContain('### A / B 对照');
  await page.locator('#save').click(); await page.locator('#record-name').fill('真实计算链与分析'); await page.locator('#record-notes').fill('屏蔽第一个连接，输出来自第二个Value。'); await page.locator('#modal-save').click();
  await page.goto(entry + '#notebook'); await page.reload();
  await expect(page.locator('#record-list')).toContainText('已保存的结果分析'); await expect(page.locator('#record-list')).toContainText('本记录已包含 A 基线');
  const waitJSON = page.waitForEvent('download'); await page.locator('#download-0').click();
  const saved = JSON.parse(await readFile(await (await waitJSON).path(), 'utf8'));
  expect(saved.baseline.result.result.weights[0][0]).toBeCloseTo(.73105857863, 12);
  expect(saved.analysis.comparison.metrics.find(m => m.key === 'masked').delta).toBe(1);
  saved.baseline.result.result.weights = [[999, 999]];
  saved.analysis.metrics[0].value = 999;
  await page.locator('#experiment-file').setInputFiles({ name: 'unverified.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.locator('#record-list .panel').first()).toContainText('导入的分析尚未核验');
  await page.locator('#replay-0').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  const actual = await page.evaluate(() => window.TensorScope.diagnostics.store.baselines.attention.result.result.weights);
  expect(actual[0][0]).toBeCloseTo(.73105857863, 12);
  await expect(metrics(page).locator('[data-delta="masked"] td').last()).toHaveText('1.000000');
  expect(await numberAt(page, 'softmax')).toBe(0);
  expect(check.errors).toEqual([]); expect(check.requests).toEqual([]);
});

test('CNN和LSTM完整A/B记录：原权重保留、导入后双方均重新计算', async ({ page }) => {
  const check = await audit(page);
  for (const module of ['cnn', 'sequence']) {
    await boot(page, module);
    if (module === 'sequence') {
      await page.locator('#sequence-algorithm').selectOption('LSTM'); await page.locator('#sequence-run').click();
      await expect(page.locator('#result-state')).toHaveText('结果已更新');
    }
    const a = await page.evaluate(module => window.TensorScope.diagnostics.store.results[module], module);
    await page.locator('#freeze').click();
    if (module === 'cnn') {
      await page.locator('#kernel-index').fill('0'); await page.locator('#kernel-value').fill('1.5'); await page.locator('#kernel-apply').click();
    } else { await page.locator('#sequence-scale').fill('2'); await page.locator('#sequence-run').click(); }
    await expect(page.locator('#result-state')).toHaveText('结果已更新');
    const b = await page.evaluate(module => window.TensorScope.diagnostics.store.results[module], module);
    await page.locator('#save').click(); await page.locator('#record-name').fill(module + '双结果复算'); await page.locator('#modal-save').click();
    await page.goto(entry + '#notebook');
    const wait = page.waitForEvent('download'); await page.locator('#download-0').click();
    const record = JSON.parse(await readFile(await (await wait).path(), 'utf8'));
    // JSON represents both -0 and +0 as 0; compare the serialized weights.
    expect(record.baseline.config.model.weights).toEqual(JSON.parse(JSON.stringify(a.model.weights)));
    expect(record.config.model.weights).toEqual(JSON.parse(JSON.stringify(b.model.weights)));
    record.baseline.result.trace.probabilities = [999, 999]; record.result.trace.probabilities = [999, 999];
    await page.locator('#experiment-file').setInputFiles({ name: module + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
    await expect(page.locator('#record-list > .panel').first()).toContainText('导入的分析尚未核验');
    await page.locator('#replay-0').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
    const actual = await page.evaluate(module => ({ a: window.TensorScope.diagnostics.store.baselines[module].result, b: window.TensorScope.diagnostics.store.results[module] }), module);
    expect(actual.a.trace.probabilities).toEqual(a.trace.probabilities);
    expect(actual.b.trace.probabilities).toEqual(b.trace.probabilities);
    await expect(metrics(page).locator('.analysis-comparison')).toContainText('口径匹配');
    if (module === 'sequence') expect(actual.b.model.algorithm).toBe('LSTM');
  }
  expect(check.errors).toEqual([]); expect(check.requests).toEqual([]);
});

test('基线复算期间离开笔记，不被旧重放跳回实验页', async ({ page }) => {
  const check = await audit(page); await explicitAttention(page);
  await page.locator('#freeze').click(); await page.locator('#mask-edit').click();
  await page.locator('#matrix .matrix-cell').first().click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#save').click(); await page.locator('#modal-save').click(); await page.goto(entry + '#notebook');
  const started = await page.evaluate(() => { const before = window.TensorScope.diagnostics.runtime.runId; document.querySelector('#replay-0').click(); const started = window.TensorScope.diagnostics.runtime.runId !== before; location.hash = 'home'; return started; });
  expect(started).toBe(true);
  await expect.poll(() => page.evaluate(() => window.TensorScope.diagnostics.runtime.status)).toBe('completed');
  await expect(page).toHaveURL(/#home$/);
  await expect(page.locator('#record-list')).toHaveCount(0);
  expect(check.errors).toEqual([]); expect(check.requests).toEqual([]);
});
