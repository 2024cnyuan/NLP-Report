import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import {test,expect} from '../../../tools/testing/playwright.js';
import {pathToFileURL} from 'node:url';
const entry=pathToFileURL(fromProject('release/index.html')).href;
test('Blob Worker 引擎明确验证，无网络；不可用时CPU回退一致',async({page})=>{
  const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>{network.push(r.request().url());r.abort();});await page.goto(entry+'#attention');await expect(page.locator('#result-state')).toHaveText('结果已更新');expect(await page.evaluate(()=>TensorScope.diagnostics.runtime.engine)).toBe('Worker');
  const expected=await page.locator('#matrix .matrix-cell').first().textContent();await page.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('forced unavailable capability');}};});await page.reload();await expect(page.locator('#result-state')).toHaveText('结果已更新');expect(await page.evaluate(()=>TensorScope.diagnostics.runtime.engine)).toBe('分块 CPU 回退');expect(await page.locator('#matrix .matrix-cell').first().textContent()).toBe(expected);expect(errors).toEqual([]);expect(network).toEqual([]);
});
test('大矩阵分块、整行mask拒绝、显式输入、结果失效',async({page})=>{
  await page.goto(entry+'#attention');await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#source').fill(Array.from({length:32},(_,i)=>'k'+i).join(' '));await page.locator('#target').fill(Array.from({length:32},(_,i)=>'q'+i).join(' '));await page.locator('#attention-run').click();await expect(page.locator('#matrix .matrix-cell')).toHaveCount(256);await page.locator('#matrix-next').click();await expect(page.locator('#matrix thead')).toContainText('k16');
  await page.locator('#source').fill('a b');await page.locator('#target').fill('x');await page.locator('#attention-run').click();await expect(page.locator('#matrix .matrix-cell')).toHaveCount(2);await page.locator('#mask-edit').click();await page.locator('#matrix .matrix-cell').first().click();await expect(page.locator('#matrix .matrix-cell').first()).toHaveClass(/masked/);await page.locator('#matrix .matrix-cell').last().click();await expect(page.locator('#toast')).toContainText('整行');await expect(page.locator('#source')).toHaveValue('a b');await page.locator('#mask-clear').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');
});
test('新页面不会被旧任务的完成消息覆盖',async({page})=>{
  await page.goto(entry+'#optimization');await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#steps').fill('10000');await page.locator('#opt-run').click();await expect(page.locator('#task-bar')).toHaveClass(/visible/);await page.locator('.nav-link[href="#home"]').click();await expect(page.getByRole('heading',{name:'六个实验，一条理解路径'})).toBeVisible();await page.locator('#task-cancel').click();await expect(page.locator('#task-bar')).not.toHaveClass(/visible/);await expect(page.getByRole('heading',{name:'六个实验，一条理解路径'})).toBeVisible();
});
test('运行中修改参数，旧配置结果必须保持过期',async({page})=>{await page.goto(entry+'#optimization');await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#steps').fill('1000');await page.locator('#opt-run').click();await expect(page.locator('#task-bar')).toHaveClass(/visible/);await page.locator('#lr').fill('0.2');await expect(page.locator('#task-bar')).not.toHaveClass(/visible/);await expect(page.locator('#result-state')).toHaveClass(/stale/);await expect(page.locator('#save')).toBeDisabled();});
test('文件读取乱序与切页：旧导入不能覆盖新预览或首页',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const original=File.prototype.text;window.pendingFiles={};File.prototype.text=function(){const file=this;return new Promise(resolve=>{window.pendingFiles[file.name]=()=>original.call(file).then(resolve);});};});
  await page.goto(entry+'#data');
  for(const name of ['old.csv','new.csv'])await page.locator('#dataset-file').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(`text,label\n${name} 好,正\n${name} 坏,负`)});
  await page.evaluate(()=>window.pendingFiles['new.csv']());await expect(page.locator('#data-preview')).toContainText('new.csv');
  await page.evaluate(()=>window.pendingFiles['old.csv']());await expect(page.locator('#data-preview')).not.toContainText('old.csv');
  await page.locator('#dataset-file').setInputFiles({name:'leaving.csv',mimeType:'text/csv',buffer:Buffer.from('text,label\n好,正\n坏,负')});
  await page.locator('.nav-link[href="#home"]').click();await page.evaluate(()=>window.pendingFiles['leaving.csv']());
  await expect(page.getByRole('heading',{name:'六个实验，一条理解路径'})).toBeVisible();await expect(page.locator('#data-preview')).toHaveCount(0);expect(errors).toEqual([]);
});
