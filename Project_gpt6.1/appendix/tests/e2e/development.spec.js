import {test,expect} from '../../../tools/testing/playwright.js';
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
