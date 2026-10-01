import {test,expect} from '../../../tools/testing/playwright.js';
test('Vite 两份清洗CSV解析与真实数据Worker训练',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5187/#comparison/dataset');
  await expect(page.locator('#dataset-origin')).toContainText('2944');
  await page.locator('#dataset-choice').selectOption('weibo');
  await expect(page.locator('#dataset-origin')).toContainText('5000');
  for(const n of ['SVM','RNN','CNN'])await page.locator(`[name="dataset-model"][value="${n}"]`).uncheck();
  await page.locator('#dataset-run').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  const result=await page.evaluate(async()=>(await import('/src/app/main.js')).diagnostics.store.results.datasetLab);
  expect(result.metrics.NB.count).toBe(20);
  expect(result.dataset.samples).toHaveLength(100);
  expect(result.models.NB.vocab.length).toBeGreaterThan(1);
  expect(result.metrics.NB.accuracy).toBe(result.rows.filter(r=>r.label===r.predictions.NB.prediction).length/20);
  expect(errors).toEqual([]);
});
test('Vite 字体与公式：本地字形加载，KaTeX排版及代码字体',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5187/#attention');
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#matrix .matrix-cell').first().click();
  await expect(page.locator('.formula .katex').first()).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  const result=await page.evaluate(()=>({
    loaded:[...document.fonts].filter(font=>font.status==='loaded').map(font=>font.family.replaceAll('"','')),
    math:getComputedStyle(document.querySelector('.formula .katex')).fontFamily,
    code:getComputedStyle(document.querySelector('.inspect-content pre')).fontFamily,
  }));
  expect(result.loaded).toEqual(expect.arrayContaining(['Inter','Noto Sans SC','JetBrains Mono']));
  expect(result.loaded.some(family=>family.startsWith('KaTeX'))).toBe(true);
  expect(result.math).toContain('KaTeX_Main');
  expect(result.code).toContain('JetBrains Mono');
  expect(errors).toEqual([]);
});
test('Vite 使用说明：章节深链接、内嵌图和模块入口',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5187/#help/notebook');
  await expect(page.locator('#help-notebook')).toBeFocused();
  await expect(page.locator('.guide-figure svg[role="img"]')).toHaveCount(3);
  await page.locator('#help-notebook .guide-top-link').click();
  await expect(page.locator('#guide-title')).toBeInViewport();
  await page.locator('.guide-toc > a[href="#help/modules"]').click();
  await expect(page.locator('#help-modules')).toBeFocused();
  await page.locator('.guide-module a[href="#cnn"]').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  expect(errors).toEqual([]);
});
test('Vite ESM 开发入口与开发 Worker',async({page})=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5187');await page.locator('.module-card[href="#attention"]').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#matrix .matrix-cell').first().click();await expect(page.locator('.inspect-value')).toBeVisible();await page.locator('.nav-link[href="#cnn"]').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');await expect(page.locator('#cnn-probabilities .bar-row')).toHaveCount(2);expect(errors).toEqual([]);});
