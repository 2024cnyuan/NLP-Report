import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import {test,expect} from '../../../tools/testing/playwright.js';
import {pathToFileURL} from 'node:url';
import {writeFile,readFile} from 'node:fs/promises';
const entry=pathToFileURL(fromProject('release/index.html')).href;

test('5000真实训练向量 Canvas、全词查询及10轮切页回收',async({page})=>{
  const errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>{network.push(r.request().url());r.abort();});
  await page.goto(entry);
  const trained=await page.evaluate(async()=>{
    const config={corpus:Array.from({length:5000},(_,i)=>`word${i} word${(i+1)%5000}`).join('\n'),algorithm:'skipgram',method:'space',dim:32,window:2,negatives:5,epochs:1,lr:.03,seed:42};
    const t=performance.now(),result=await TensorScope.diagnostics.run('embeddings',config);
    TensorScope.diagnostics.store.results.embeddings=result;
    TensorScope.diagnostics.store.configs.embeddings=config;
    return {vocabulary:result.vocab.length,tokens:result.tokenCount,trainingMs:performance.now()-t};
  });
  const before=Date.now();
  await page.locator('.nav-link[href="#embeddings"]').click();
  await expect(page.locator('#embedding-canvas')).toBeVisible();
  await expect(page.locator('.chart-legend').first()).toContainText('全量检索 5000');
  const renderMs=Date.now()-before;
  await page.locator('#word-search').fill('word4999');
  await page.getByRole('button',{name:'定位',exact:true}).click();
  await expect(page.locator('.inspect-content')).toContainText('word4999');
  await page.getByLabel('关闭检查器').click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await expect(page.locator('#embed-result #curve circle')).toHaveCount(1);
  await page.screenshot({path:evidencePath('embeddings-5000.png'),fullPage:true,animations:'disabled',style:'#toast{visibility:hidden}'});
  const cdp=await page.context().newCDPSession(page),resources=[];
  await cdp.send('Performance.enable');
  for(let i=0;i<=10;i++){
    if(i){await page.locator('.nav-link[href="#home"]').click();await expect(page.locator('.module-card')).toHaveCount(6);await page.locator('.nav-link[href="#embeddings"]').click();await expect(page.locator('#embedding-canvas')).toBeVisible();}
    await cdp.send('HeapProfiler.collectGarbage');
    const {metrics}=await cdp.send('Performance.getMetrics');
    const m=Object.fromEntries(metrics.map(x=>[x.name,x.value]));
    resources.push({cycle:i,heapBytes:m.JSHeapUsedSize,nodes:m.Nodes,listeners:m.JSEventListeners,visibleDOMElements:await page.locator('*').count()});
  }
  expect(resources.at(-1).heapBytes).toBeLessThan(resources[0].heapBytes+2*1024*1024);
  expect(resources.at(-1).nodes).toBeLessThan(resources[0].nodes+100);
  expect(resources.at(-1).listeners).toBeLessThan(resources[0].listeners+15);
  expect(errors).toEqual([]);expect(network).toEqual([]);
  await writeFile(evidencePath('canvas-resources.json'),JSON.stringify({environment:'WSL Chromium, file://, headless, GC forced between cycles',trained,renderMs,resources,errors,network,limitations:'Post-GC CDP counters, not peak memory or full leak proof; 10 same-page navigation cycles.'},null,2));
});

test('六模块 JSON/CSV/Markdown 真实下载，序列与四模型A/B',async({page})=>{
  for(const id of ['attention','optimization','embeddings','sequence','cnn','comparison']){
    await page.goto(entry+'#'+id);await expect(page.locator('#result-state')).toHaveText('结果已更新');
    if(id==='sequence'){
      await page.getByRole('button',{name:'固定为 A'}).click();await page.locator('#sequence-text').fill('我 不 喜欢 学习');await page.locator('#sequence-run').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');await expect(page.getByRole('heading',{name:/A \/ B/,level:2})).toBeVisible();
    }
    if(id==='comparison'){
      await page.getByRole('button',{name:'固定为 A'}).click();await page.locator('#compare-epochs').fill('2');await page.locator('#compare-train').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');await expect(page.getByRole('heading',{name:/A \/ B/})).toBeVisible();
    }
    for(const [label,suffix]of [['实验 JSON','experiment.json'],['结果 CSV','results.csv'],['报告 Markdown','report.md']]){
      await page.getByRole('button',{name:'导出',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const download=await wait;
      expect(download.suggestedFilename()).toBe(`${id}-${suffix}`);
      const content=await readFile(await download.path(),'utf8');
      if(suffix==='experiment.json'){const r=JSON.parse(content);expect(r.module).toBe(id);expect(r.result).toBeTruthy();expect(r.config).toBeTruthy();}
      else expect(content).toContain(suffix==='results.csv'?'path,value':'## 实际结果');
    }
  }
});

test('四模型训练记录导出重放保留相同权重及预测',async({page})=>{
  await page.goto(entry+'#comparison');await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#compare-epochs').fill('2');await page.locator('#compare-train').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');
  const expected=await page.evaluate(()=>Object.values(TensorScope.diagnostics.store.models).map(m=>m.id));
  const predictions=await page.locator('#single-predictions').textContent();
  await page.getByRole('button',{name:'保存实验'}).click();await page.locator('#record-name').fill('真实训练重放');await page.locator('#modal-save').click();
  await page.locator('.nav-link[href="#notebook"]').click();
  const wait=page.waitForEvent('download');await page.locator('#download-0').click();const file=await wait;
  await page.locator('#experiment-file').setInputFiles(await file.path());
  await page.locator('#replay-0').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');
  expect(await page.evaluate(()=>Object.values(TensorScope.diagnostics.store.models).map(m=>m.id))).toEqual(expected);
  expect(await page.locator('#single-predictions').textContent()).toBe(predictions);
});
