import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { test, expect } from '../../../tools/testing/playwright.js';
import { pathToFileURL } from 'node:url';
import {mkdtemp,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const capture=async(page,options)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({...options,animations:'disabled',style:'#toast{visibility:hidden}'});};
const entry = pathToFileURL(fromProject('release/index.html')).href;
test('真实 file://：注意力、Worker、检查器、掩码、对照与导出', async ({ page }) => {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); route.abort(); });
  await page.goto(entry);
  await expect(page.getByRole('heading', { name: '六个实验，一条理解路径' })).toBeVisible();
  await capture(page,{ path: evidencePath('home-1440.png'), fullPage: true });
  await page.locator('.module-card[href="#attention"]').click();
  await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await expect(page.locator('#matrix .matrix-cell')).toHaveCount(20);
  await page.locator('#matrix .matrix-cell').first().click();
  await expect(page.getByLabel('计算检查器')).toBeVisible();
  await expect(page.locator('.inspect-value')).toContainText(/0\.\d+/);
  await page.getByLabel('关闭检查器').click();
  await page.getByRole('button', { name: '固定为 A' }).click();
  await page.getByRole('button', { name: '编辑掩码', exact: true }).click();
  await page.locator('#matrix .matrix-cell').first().click();
  await expect(page.locator('#matrix .matrix-cell').first()).toHaveClass(/masked/);
  await expect(page.getByRole('heading', { name: 'A / B · 受控对照' })).toBeVisible();
  await capture(page,{ path: evidencePath('attention-ab-1440.png'), fullPage: true });
  await page.getByRole('button', { name: '导出', exact: true }).click();
  const waitDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '实验 JSON' }).click();
  expect((await waitDownload).suggestedFilename()).toBe('attention-experiment.json');
  await page.locator('#source').fill('我 爱 算法');
  await expect(page.locator('#result-state')).toHaveClass(/stale/);
  await page.getByRole('button', { name: '清空掩码', exact: true }).click();
  await expect(page.locator('#matrix .matrix-cell')).toHaveCount(12);
  expect(errors).toEqual([]); expect(requests).toEqual([]);
});
test('离线响应式：五种尺寸无整页溢出', async ({ page }) => {
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[768,1024],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.goto(entry+'#attention');
    await expect(page.locator('#result-state')).toHaveText('结果已更新');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await capture(page,{path:evidencePath(`attention-${width}.png`),fullPage:true});
  }
});
test('中文与空格路径复制后可双击离线运行',async({page})=>{const directory=await mkdtemp(join(tmpdir(),'TensorScope 中文 空格 '));try{for(const file of ['index.html','app.js','style.css'])await copyFile(fromProject('release',file),join(directory,file));await page.goto(pathToFileURL(join(directory,'index.html')).href+'#attention');await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#matrix .matrix-cell').first().click();await expect(page.locator('.inspect-value')).toBeVisible();}finally{await rm(directory,{recursive:true,force:true});}});
test('空态、键盘检查器锁定、演示视图与真实暂停截图',async({page})=>{
  await page.goto(entry+'#notebook');await expect(page.getByRole('heading',{name:'还没有保存的实验'})).toBeVisible();await capture(page,{path:evidencePath('notebook-empty.png'),fullPage:true});
  await page.goto(entry+'#attention');await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#matrix .matrix-cell').first().focus();await page.keyboard.press('Enter');await expect(page.getByLabel('计算检查器')).toBeVisible();
  const selected=await page.locator('.inspect-content').textContent();await page.getByRole('button',{name:'锁定此计算'}).click();await page.locator('#matrix .matrix-cell').nth(1).click();expect(await page.locator('.inspect-content').textContent()).toBe(selected.replace('锁定此计算','解除锁定'));await capture(page,{path:evidencePath('inspector-locked.png')});await page.getByLabel('关闭检查器').click();
  await page.getByRole('button',{name:'切换演示视图'}).click();await expect(page.locator('body')).toHaveClass(/presentation/);await page.locator('#matrix .matrix-cell').nth(1).click();await expect(page.locator('.inspect-content')).toBeVisible();await page.getByLabel('关闭检查器').click();await capture(page,{path:evidencePath('presentation.png'),fullPage:true});await page.getByRole('button',{name:'切换演示视图'}).click();
  await page.locator('.nav-link[href="#optimization"]').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#steps').fill('10000');await page.locator('#opt-run').click();await expect(page.locator('#task-bar')).toHaveClass(/visible/);await page.locator('#task-pause').click();await expect(page.locator('#task-message')).toContainText('已暂停');await capture(page,{path:evidencePath('task-paused.png')});await page.locator('#task-cancel').click();await expect(page.locator('#task-bar')).not.toHaveClass(/visible/);
});
