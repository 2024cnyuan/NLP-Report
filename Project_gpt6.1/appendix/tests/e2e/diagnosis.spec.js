import { test, expect } from '../../../tools/testing/playwright.js';
import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
const entry = pathToFileURL(fromProject('release/index.html')).href;
const boot = async (page, hash) => { await page.goto(entry + '#' + hash); };
const capture = async (page, name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: evidencePath(name), fullPage: true, animations: 'disabled', style: '#toast{visibility:hidden}' });
};

test('两份真实数据可运行，未运行不显示成绩，模式跳转和学习路线可用', async ({ page }) => {
  const requests = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  await boot(page, 'comparison/dataset');
  await expect(page.locator('#comparison-mode')).toHaveValue('dataset');
  await expect(page.locator('#result-state')).toHaveText('尚未运行');
  for (const id of ['chnsenticorp', 'weibo']) {
    await page.locator('#dataset-choice').selectOption(id);
    await expect(page.locator('#dataset-run')).toBeEnabled();
    await expect(page.locator('#dataset-origin')).toContainText(id === 'weibo' ? '5000' : '2944');
    await expect(page.locator('#dataset-metrics')).toHaveCount(0);
  }
  await capture(page, 'dataset-ready-1440.png');
  await page.locator('#comparison-mode').selectOption('case');
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('.diagnosis-panel')).toBeVisible();
  // A running task must prevent starting a second task after navigation.
  await page.locator('.nav-link[href="#optimization"]').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#steps').fill('10000'); await page.locator('#opt-run').click();
  await expect(page.locator('#task-bar')).toHaveClass(/visible/);
  await page.locator('#task-pause').click(); await expect(page.locator('#task-message')).toContainText('已暂停');
  await page.evaluate(() => { location.hash = 'comparison/dataset'; });
  await expect(page.locator('#dataset-run')).toBeDisabled();
  await page.locator('#task-cancel').click(); await expect(page.locator('#task-bar')).not.toHaveClass(/visible/);
  await expect(page.locator('#dataset-run')).toBeEnabled();
  await page.goto(entry + '#help/learning');
  await expect(page.locator('#help-learning')).toBeFocused();
  await expect(page.locator('.learning-roadmap li')).toHaveCount(6);
  await page.locator('#help-learning a[href="#comparison/dataset"]').click();
  await expect(page.locator('#dataset-run')).toBeEnabled();
  await page.goBack(); await expect(page.locator('#help-learning')).toBeFocused();
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('错误诊断的分母来自真实预测，NB/SVM词项与RNN原权重溯源', async ({ page }) => {
  await boot(page, 'comparison/diagnosis');
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  const snapshot = await page.evaluate(() => TensorScope.diagnostics.store.results.comparison);
  for (const n of ['RNN', 'NB', 'SVM', 'CNN']) {
    await page.locator('#diagnosis-model').selectOption(n);
    const errors = snapshot.rows.filter(r => r.label !== r.predictions[n].prediction).length;
    await expect(page.locator('.diagnosis-stats')).toContainText(`错分 ${errors}`);
    await expect(page.locator('.diagnosis-stats')).toContainText('已标注 16');
  }
  await page.locator('#diagnosis-model').selectOption('NB');
  await page.locator('[data-diagnose]').first().click();
  await expect(page.locator('.inspect-content')).toContainText('词项贡献');
  await expect(page.locator('.inspect-content')).toContainText(snapshot.models.NB.id);
  await page.getByLabel('关闭检查器').click();
  await page.locator('#diagnosis-model').selectOption('SVM');
  await expect(page.locator('.diagnosis-case').first()).toContainText('非概率');
  await page.locator('[data-diagnose]').first().click();
  await expect(page.locator('.inspect-content')).toContainText(snapshot.models.SVM.id);
  await page.getByLabel('关闭检查器').click();
  await page.locator('#diagnosis-model').selectOption('RNN');
  await capture(page, 'diagnosis-1440.png');
  await page.locator('[data-diagnose]').first().click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('#sequence-source')).toHaveValue('linked');
  await expect(page.locator('#sequence-result')).toContainText(snapshot.models.RNN.id);
});

test('用户数据通路：模型选择、真实评测、报告与重放忽略篡改成绩', async ({ page }) => {
  // Synthetic CSV is ONLY test input, never a bundled real dataset.
  const rows = ['text,label,split'];
  for (const split of ['train', 'test']) for (const label of ['neg', 'pos']) for (let i = 0; i < (split === 'train' ? 80 : 20); i++) rows.push(`${split} ${label === 'pos' ? 'good' : 'bad'} example${i},${label},${split}`);
  await boot(page, 'data');
  await page.locator('#dataset-file').setInputFiles({ name: '测试夹具.csv', mimeType: 'text/csv', buffer: Buffer.from(rows.join('\n')) });
  await expect(page.locator('#confirm-data')).toBeVisible(); await page.locator('#confirm-data').click();
  await page.goto(entry + '#comparison/dataset');
  await page.locator('#dataset-choice').selectOption('imported');
  for (const n of ['SVM', 'RNN', 'CNN']) await page.locator(`[name="dataset-model"][value="${n}"]`).uncheck();
  await page.locator('#dataset-run').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('#dataset-metrics tbody tr')).toHaveCount(1);
  await expect(page.locator('#dataset-result')).toContainText('训练 70 / 验证 10 / 测试 20');
  await expect(page.locator('.diagnosis-stats')).toContainText('已标注 20');
  const actual = await page.evaluate(() => TensorScope.diagnostics.store.results.datasetLab);
  await page.locator('#export').click();
  const markdownWait = page.waitForEvent('download'); await page.locator('#export-md').click();
  const md = await readFile(await (await markdownWait).path(), 'utf8');
  expect(md).toContain('### 错误诊断 · NB'); expect(md).toContain('训练 70 / 验证 10 / 测试 20');
  await page.locator('#export').click();
  const jsonWait = page.waitForEvent('download'); await page.locator('#export-json').click();
  const record = JSON.parse(await readFile(await (await jsonWait).path(), 'utf8'));
  record.result.metrics.NB.accuracy = 999; record.result.rows[0].predictions.NB.prediction = 999;
  await page.reload(); await page.goto(entry + '#notebook');
  await page.locator('#experiment-file').setInputFiles({ name: '重放.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
  await page.locator('#replay-0').click(); await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page).toHaveURL(entry + '#comparison/dataset');
  const replay = await page.evaluate(() => TensorScope.diagnostics.store.results.datasetLab);
  expect(replay.metrics).toEqual(actual.metrics); expect(replay.rows).toEqual(actual.rows);
  expect(replay.models).toEqual(actual.models);
  await page.locator('#dataset-count').fill('21'); await page.locator('#dataset-run').click();
  await expect(page.locator('#toast')).toContainText('有效范围');
  await expect(page.locator('#save')).toBeDisabled();
});

test('新增诊断、真实数据模式与学习路线在窄屏无整页溢出', async ({ page }) => {
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const hash of ['comparison/diagnosis', 'comparison/dataset', 'help/learning']) {
      await boot(page, hash);
      await expect(page.locator(hash.startsWith('help') ? '#help-learning' : '#comparison-mode')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(page, `${hash.replace('/', '-')}-${width}.png`);
    }
  }
});

test('两个内置语料全量NB：真实分母、紧凑报告、刷新后重放一致且无网络', async ({ page }) => {
  const requests = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
  await boot(page, 'comparison/dataset');
  for (const n of ['SVM', 'RNN', 'CNN']) await page.locator(`[name="dataset-model"][value="${n}"]`).uncheck();
  for (const [id, count, testCount] of [['chnsenticorp', 2944, 590], ['weibo', 5000, 1000]]) {
    await page.locator('#dataset-choice').selectOption(id);
    await page.locator('#dataset-full').click();
    await expect(page.locator('#dataset-count')).toHaveValue(String(count));
    await page.locator('#dataset-run').click();
    await expect(page.locator('#result-state')).toHaveText('结果已更新', { timeout: 30000 });
    const actual = await page.evaluate(() => TensorScope.diagnostics.store.results.datasetLab);
    expect(actual.dataset.samples).toHaveLength(count); expect(actual.rows).toHaveLength(testCount);
    expect(actual.metrics.NB.count).toBe(testCount);
    expect(actual.metrics.NB.accuracy).toBe(actual.rows.filter(r => r.label === r.predictions.NB.prediction).length / testCount);
    await expect(page.locator('.diagnosis-stats')).toContainText(`已标注 ${testCount}`);
    await capture(page, `dataset-${id}-full-nb-1440.png`);
    await page.locator('#export').click();
    const jsonWait = page.waitForEvent('download'); await page.locator('#export-json').click();
    const bytes = await readFile(await (await jsonWait).path());
    expect(bytes.length).toBeLessThan(10 * 1024 * 1024);
    const record = JSON.parse(bytes.toString('utf8'));
    expect(record.result.dataset.provenance.curatedSHA256).toMatch(/^[a-f0-9]{64}$/);
    if (id === 'weibo') {
      record.result.metrics.NB.accuracy = 999;
      await page.reload(); await page.goto(entry + '#notebook');
      await page.locator('#experiment-file').setInputFiles({ name: '微博全量重放.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(record)) });
      await expect(page.locator('#replay-0')).toBeVisible(); await page.locator('#replay-0').click();
      await expect(page.locator('#result-state')).toHaveText('结果已更新', { timeout: 30000 });
      const replay = await page.evaluate(() => TensorScope.diagnostics.store.results.datasetLab);
      expect(replay.rows).toEqual(actual.rows); expect(replay.models).toEqual(actual.models);
      expect(replay.metrics).toEqual(actual.metrics);
      await page.goto(entry + '#notebook');
      const referenceWait = page.waitForEvent('download'); await page.locator('#reference-0').click();
      const referenceBytes = await readFile(await (await referenceWait).path());
      const reference = JSON.parse(referenceBytes.toString('utf8'));
      expect(referenceBytes.length).toBeLessThan(50000);
      expect(reference.config.dataset).toBeUndefined();
      expect(reference.dataReference.builtinId).toBe('weibo');
      expect(reference.dataReference.curatedSHA256).toBe(actual.dataset.provenance.curatedSHA256);
      await page.reload(); await page.goto(entry + '#notebook');
      await page.locator('#experiment-file').setInputFiles({ name: '内置数据引用.json', mimeType: 'application/json', buffer: referenceBytes });
      await expect(page.locator('#replay-0')).toBeVisible(); await page.locator('#replay-0').click();
      await expect(page.locator('#result-state')).toHaveText('结果已更新', { timeout: 30000 });
      const referenced = await page.evaluate(() => TensorScope.diagnostics.store.results.datasetLab);
      expect(referenced.models).toEqual(actual.models); expect(referenced.metrics).toEqual(actual.metrics);
      reference.dataReference.curatedSHA256 = '0'.repeat(64);
      await page.goto(entry + '#notebook');
      await page.locator('#experiment-file').setInputFiles({ name: '版本错误引用.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(reference)) });
      await page.locator('#replay-0').click();
      await expect(page.locator('#toast')).toContainText('内置数据版本或指纹不匹配');
      await expect(page).toHaveURL(entry + '#notebook');
    }
  }
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('真实酒店100条四模型训练与原权重解释，改变轮数重新计算', async ({ page }) => {
  await boot(page, 'comparison/dataset');
  await page.locator('#dataset-epochs').fill('1');
  await page.locator('#dataset-run').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新', { timeout: 30000 });
  const a = await page.evaluate(() => TensorScope.diagnostics.store.results.datasetLab);
  expect(Object.keys(a.models)).toEqual(['NB', 'SVM', 'RNN', 'CNN']);
  for (const n of ['NB', 'SVM', 'RNN', 'CNN']) expect(a.metrics[n].count).toBe(20);
  await page.locator('#dataset-epochs').fill('2'); await page.locator('#dataset-run').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新', { timeout: 30000 });
  const b = await page.evaluate(() => TensorScope.diagnostics.store.results.datasetLab);
  expect(b.dataFingerprint).toBe(a.dataFingerprint);
  expect(b.models.RNN.weights).not.toEqual(a.models.RNN.weights);
  expect(b.models.CNN.weights).not.toEqual(a.models.CNN.weights);
  expect(b.models.NB).toEqual(a.models.NB);
  await page.locator('[data-dataset-explain="CNN"]').first().click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('#cnn-result')).toContainText(b.models.CNN.id);
  await page.goto(entry + '#comparison/dataset');
  await page.locator('[data-dataset-explain="RNN"]').first().click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('#sequence-result')).toContainText(b.models.RNN.id);
});
