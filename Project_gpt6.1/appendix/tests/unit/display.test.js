import { it, expect } from '../../../tools/testing/vitest.js';
import { normalizeDisplay, displayDefaults, DISPLAY_KEY, sidebarWidthForViewport } from '../../../src/components/display.js';

it('显示偏好独立、只接受有限数值、限幅且忽略未知字段', () => {
  expect(DISPLAY_KEY).toBe('tensorscope-display-v1');
  for (const invalid of [null, {}, 'bad', []]) expect(normalizeDisplay(invalid)).toEqual(displayDefaults);
  expect(normalizeDisplay({ pageFont: 1, inspectorFont: 1000, inspectorWidth: -5, inspectorHeight: 5000, extra: 'ignored' }))
    .toEqual({ ...displayDefaults, pageFont: 90, inspectorFont: 180, inspectorWidth: 280, inspectorHeight: 1200 });
  expect(normalizeDisplay({ pageFont: '150', inspectorFont: Infinity, inspectorWidth: NaN, inspectorHeight: null })).toEqual(displayDefaults);
  const values = { pageFont: 118, inspectorWidth: 527.4 };
  expect(normalizeDisplay(values)).toEqual({ ...displayDefaults, pageFont: 120, inspectorWidth: 527 });
  expect(values).toEqual({ pageFont: 118, inspectorWidth: 527.4 });
});

it('旧显示记录自动补侧栏默认值，独立字体/宽度限幅', () => {
  expect(normalizeDisplay({pageFont:130,inspectorFont:120})).toEqual({...displayDefaults,pageFont:130,inspectorFont:120});
  expect(normalizeDisplay({sidebarFont:800,sidebarWidth:-1})).toEqual({...displayDefaults,sidebarFont:150,sidebarWidth:200});
  expect(normalizeDisplay({sidebarFont:103,sidebarWidth:321.6})).toEqual({...displayDefaults,sidebarFont:105,sidebarWidth:322});
  expect(normalizeDisplay({sidebarFont:'150',sidebarWidth:NaN})).toEqual(displayDefaults);
});

it('侧栏随视口限幅，桌面留600px正文，小屏留32px关闭区且不改请求宽度',()=>{
  for(const [viewport,expected] of [[1920,420],[1024,420],[900,300],[801,201],[800,420],[390,358],[320,288],[180,148]]){
    expect(sidebarWidthForViewport(420,viewport)).toBe(expected);
  }
  expect(sidebarWidthForViewport(230,1440)).toBe(230);
});
