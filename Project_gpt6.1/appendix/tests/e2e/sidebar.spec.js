import { test, expect } from '../../../tools/testing/playwright.js';
import { fromProject, evidencePath } from '../../../tools/paths.mjs';
import { pathToFileURL } from 'node:url';
const entry=pathToFileURL(fromProject('release/index.html')).href;
const range=(page,key,value)=>page.locator(`#display-${key}`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));
const state=page=>page.evaluate(()=>{
  const sidebar=document.querySelector('.sidebar'),title=sidebar.querySelector('.brand strong'),main=document.querySelector('.main');
  return {width:sidebar.getBoundingClientRect().width,mainLeft:main.getBoundingClientRect().left,
    titleWidth:title.clientWidth,titleScroll:title.scrollWidth,titleHeight:title.getBoundingClientRect().height,titleLineHeight:parseFloat(getComputedStyle(title).lineHeight),
    navFont:parseFloat(getComputedStyle(sidebar.querySelector('.nav-link')).fontSize),brandFont:parseFloat(getComputedStyle(title).fontSize),
    pageFont:document.documentElement.style.getPropertyValue('--text-scale'),runId:TensorScope.diagnostics.runtime.runId,
    result:JSON.stringify(TensorScope.diagnostics.store.results.attention),overflow:document.documentElement.scrollWidth>innerWidth};
});

test('侧栏拖宽、键盘、独立字号、标题单行、恢复/存储，不改变计算',async({page})=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await page.goto(entry+'#attention');await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.evaluate(()=>document.fonts.ready);
  const before=await state(page),handle=page.locator('#resize-sidebar'),box=await handle.boundingBox();
  await page.mouse.move(box.x+5,300);await page.mouse.down();await page.mouse.move(box.x+125,300,{steps:10});await page.mouse.up();
  let s=await state(page);expect(s.width).toBe(350);expect(s.mainLeft).toBe(350);
  await handle.focus();await page.keyboard.press('ArrowLeft');expect((await state(page)).width).toBe(340);
  await page.keyboard.press('Shift+ArrowRight');expect((await state(page)).width).toBe(390);
  await page.keyboard.press('Home');expect((await state(page)).width).toBe(200);
  await page.locator('#display-toggle').click();await range(page,'sidebarFont',150);
  s=await state(page);expect(s.navFont).toBeCloseTo(before.navFont*1.5,1);
  expect(s.pageFont).toBe(before.pageFont);expect(s.titleScroll).toBeLessThanOrEqual(s.titleWidth);expect(s.titleHeight).toBeLessThanOrEqual(s.titleLineHeight+1);
  await range(page,'sidebarWidth',420);const wide=await state(page);expect(wide.brandFont).toBeGreaterThan(s.brandFont);
  expect(wide.result).toBe(before.result);expect(wide.runId).toBe(before.runId);expect(wide.overflow).toBe(false);
  await expect(page.locator('#result-state')).toHaveText('结果已更新');await expect(page.locator('#save')).toBeEnabled();
  await page.locator('#display-close').click();await page.reload();await expect(page.locator('#result-state')).toHaveText('结果已更新');
  expect((await state(page)).width).toBe(420);await page.locator('#display-toggle').click();await expect(page.locator('#display-sidebarFont')).toHaveValue('150');
  await page.locator('#display-reset').click();expect((await state(page)).width).toBe(230);await expect(page.locator('#display-sidebarFont')).toHaveValue('100');
  await page.locator('#display-close').click();await handle.focus();await page.keyboard.press('End');await handle.dblclick({position:{x:5,y:300}});expect((await state(page)).width).toBe(230);
  await page.screenshot({path:evidencePath('sidebar-resize-1440.png'),animations:'disabled'});
  expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('侧栏最大字号与宽度：桌面内容自适应，移动抽屉限幅/菜单可操作',async({page})=>{
  await page.goto(entry+'#attention');await expect(page.locator('#result-state')).toHaveText('结果已更新');
  await page.locator('#display-toggle').click();await range(page,'sidebarWidth',420);await range(page,'sidebarFont',150);await range(page,'pageFont',150);await page.locator('#display-close').click();
  for(const width of [1440,1024,900,801,768,390]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(width<=800)await page.locator('#mobile-menu').click();
    let s=await state(page);expect(s.overflow).toBe(false);expect(s.titleScroll).toBeLessThanOrEqual(s.titleWidth);expect(s.titleHeight).toBeLessThanOrEqual(s.titleLineHeight+1);
    if(width>800){expect(width-s.width).toBeGreaterThanOrEqual(600);expect(s.mainLeft).toBe(s.width);}
    else {expect(s.width).toBeLessThanOrEqual(width-32);expect(s.mainLeft).toBe(0);await expect(page.locator('#resize-sidebar')).toBeVisible();}
    // Links remain reachable even if enlarged menu content needs vertical scrolling.
    await page.locator('.sidebar [data-page="help"]').click();await expect(page.locator('#guide-title')).toBeVisible();
    expect((await state(page)).overflow).toBe(false);
    if(width<=800){await expect(page.locator('#resize-sidebar')).toBeHidden();await page.locator('#mobile-menu').click();}
    await page.locator('.sidebar [data-page="attention"]').click();await expect(page.locator('#result-state')).toHaveText('结果已更新');
    if(width<=800)await page.locator('#mobile-menu').click();
    await page.screenshot({path:evidencePath(`sidebar-resize-${width}-large.png`),animations:'disabled'});
    if(width<=800)await page.locator('#sidebar-close').click();
  }
  await page.setViewportSize({width:1440,height:900});expect((await state(page)).width).toBe(420);
});
