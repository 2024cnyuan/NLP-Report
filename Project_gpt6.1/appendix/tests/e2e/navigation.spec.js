import { test, expect } from '../../../tools/testing/playwright.js';
import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { pathToFileURL } from 'node:url';
const entry=pathToFileURL(fromProject('release/index.html')).href;

test('连续返回/前进：数据集→原模型→说明，恢复原模式、筛选、页码和结果，不重训',async({page})=>{
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.goto(entry+'#home');
  await expect(page.locator('#navigation-back')).toBeDisabled();
  await expect(page.locator('#navigation-forward')).toBeDisabled();
  await page.locator('.nav-link[data-page="help"]').click();
  await expect(page.locator('.guide-chapters > section').first()).toHaveAttribute('id','help-learning');
  await page.locator('#help-learning a[href="#comparison/dataset"]').click();
  await page.locator('#dataset-count').fill('200');
  await page.locator('#dataset-epochs').fill('1');
  await page.locator('#dataset-run').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#dataset-diagnosis-model').selectOption('CNN');
  await page.locator('#dataset-errors').check();
  // Keep an error-only filter; switch back to all rows if the fixture run had fewer than21 errors.
  const errorsCount=await page.evaluate(()=>TensorScope.diagnostics.store.results.datasetLab.rows.filter(r=>r.label!==r.predictions.CNN.prediction).length);
  if(errorsCount<21)await page.locator('#dataset-errors').uncheck();
  const onlyErrors=await page.locator('#dataset-errors').isChecked();
  await page.locator('#dataset-next').click();
  await expect(page.locator('#dataset-result .pagination')).toContainText('第 2 /');
  const before=await page.evaluate(()=>({result:TensorScope.diagnostics.store.results.datasetLab,runId:TensorScope.diagnostics.runtime.runId}));
  await page.locator('[data-dataset-explain="CNN"]').first().click();
  await expect(page.locator('#cnn-result')).toContainText(before.result.models.CNN.id);
  const explainedRunId=await page.evaluate(()=>TensorScope.diagnostics.runtime.runId);
  expect(explainedRunId).toBe(before.runId+1); // Original-weight forward computation, not retraining.
  await page.locator('.nav-link[data-page="help"]').click();
  await page.locator('#navigation-back').click();
  await expect(page.locator('#cnn-result')).toContainText(before.result.models.CNN.id);
  await page.locator('#navigation-back').click();
  await expect(page.locator('#comparison-mode')).toHaveValue('dataset');
  await expect(page.locator('#dataset-diagnosis-model')).toHaveValue('CNN');
  expect(await page.locator('#dataset-errors').isChecked()).toBe(onlyErrors);
  await expect(page.locator('#dataset-result .pagination')).toContainText('第 2 /');
  await expect(page.locator('#dataset-count')).toHaveValue('200');
  const after=await page.evaluate(()=>({result:TensorScope.diagnostics.store.results.datasetLab,runId:TensorScope.diagnostics.runtime.runId}));
  expect(after.result).toEqual(before.result);
  expect(after.runId).toBe(explainedRunId);
  // Native browser forward/back stays in sync with the in-page controls.
  await page.goForward();await expect(page.locator('#cnn-result')).toContainText(before.result.models.CNN.id);
  await page.goBack();await expect(page.locator('#comparison-mode')).toHaveValue('dataset');
  await page.locator('#navigation-back').click();await expect(page.locator('#guide-title')).toBeVisible();
  await page.locator('#navigation-back').click();await expect(page.locator('#navigation-back')).toBeDisabled();
  await page.locator('#navigation-forward').click();await expect(page.locator('#guide-title')).toBeVisible();
  await page.locator('.nav-link[data-page="data"]').click();await expect(page.locator('#navigation-forward')).toBeDisabled();
  // Sidebar returns to the last mode too, rather than silently selecting case mode.
  await page.locator('.nav-link[data-page="comparison"]').click();await expect(page.locator('#comparison-mode')).toHaveValue('dataset');
  await page.screenshot({path:evidencePath('navigation-dataset-return-1440.png'),animations:'disabled'});
  await page.reload();await expect(page.locator('#navigation-back')).toBeDisabled();
  expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('深入诊断：四模型真实贡献核对和删除复算，保留原测试结果，手机大字号可用',async({page})=>{
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.goto(entry+'#comparison/diagnosis');
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  const before=await page.evaluate(()=>TensorScope.diagnostics.store.results.comparison);
  await expect.poll(()=>page.locator('.diagnosis-panel').evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(150);
  for(const name of ['NB','SVM','RNN','CNN']){
    await page.locator('#diagnosis-model').selectOption(name);
    await expect(page.locator('[data-finding="class-bias"]')).toContainText('预测类别分布');
    await page.locator('[data-analyze]').first().click();
    await expect(page.locator('.diagnosis-detail')).toContainText(before.models[name].id);
    await expect(page.locator('.diagnosis-detail')).toContainText('加和残差');
    await expect(page.locator('.diagnosis-detail')).toContainText('固定权重的输入扰动实验');
    await expect(page.locator('.diagnosis-detail')).toContainText('不证明该词造成');
    if(name==='CNN')await expect(page.locator('.diagnosis-detail')).toContainText('真实 argmax');
    if(name==='RNN')await expect(page.locator('.diagnosis-detail')).toContainText('不是梯度');
    const after=await page.evaluate(()=>TensorScope.diagnostics.store.results.comparison);
    expect(after).toEqual(before);
  }
  await page.locator('.diagnosis-detail').scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const scroll=await page.evaluate(()=>window.scrollY), runId=await page.evaluate(()=>TensorScope.diagnostics.runtime.runId);
  await page.locator('.nav-link[data-page="help"]').click();
  await page.locator('#navigation-back').click();
  await expect(page.locator('#diagnosis-model')).toHaveValue('CNN');
  await expect(page.locator('.diagnosis-detail')).toContainText(before.models.CNN.id);

  await expect.poll(()=>page.evaluate(origin=>Math.abs(window.scrollY-origin),scroll)).toBeLessThan(3);
  expect(await page.evaluate(()=>TensorScope.diagnostics.runtime.runId)).toBe(runId);
  await page.screenshot({path:evidencePath('diagnosis-deep-1440.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#display-toggle').click();
  await page.locator('#display-pageFont').evaluate(el=>{el.value='150';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#display-toggle').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.diagnosis-detail').scrollIntoViewIfNeeded();
  await page.screenshot({path:evidencePath('diagnosis-deep-390.png'),animations:'disabled'});
  expect(errors).toEqual([]);expect(requests).toEqual([]);
});
