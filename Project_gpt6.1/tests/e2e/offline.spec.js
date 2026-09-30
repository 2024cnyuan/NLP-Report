import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {mkdtemp,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const capture=async(page,options)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({...options,style:'#toast{visibility:hidden}'});};
const entry = pathToFileURL(resolve('release/index.html')).href;
test('真实 file://：注意力、Worker、检查器、掩码、对照与导出', async ({ page }) => {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/^https?:/, route => { requests.push(route.request().url()); route.abort(); });
  await page.goto(entry);
  await expect(page.getByRole('heading', { name: '六个实验，一条理解路径' })).toBeVisible();
  await capture(page,{ path: 'docs/evidence/home-1440.png', fullPage: true });
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
  await capture(page,{ path: 'docs/evidence/attention-ab-1440.png', fullPage: true });
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
    await capture(page,{path:`docs/evidence/attention-${width}.png`,fullPage:true});
  }
});
test('中文与空格路径复制后可双击离线运行',async({page})=>{const directory=await mkdtemp(join(tmpdir(),'TensorScope 中文 空格 '));try{for(const file of ['index.html','app.js','style.css'])await copyFile(resolve('release',file),join(directory,file));await page.goto(pathToFileURL(join(directory,'index.html')).href+'#attention');await expect(page.locator('#result-state')).toHaveText('结果已更新');await page.locator('#matrix .matrix-cell').first().click();await expect(page.locator('.inspect-value')).toBeVisible();}finally{await rm(directory,{recursive:true,force:true});}});
