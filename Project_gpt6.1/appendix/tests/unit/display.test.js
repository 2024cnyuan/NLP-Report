import { it, expect } from '../../../tools/testing/vitest.js';
import { normalizeDisplay, displayDefaults, DISPLAY_KEY } from '../../../src/components/display.js';

it('显示偏好独立、只接受有限数值、限幅且忽略未知字段', () => {
  expect(DISPLAY_KEY).toBe('tensorscope-display-v1');
  for (const invalid of [null, {}, 'bad', []]) expect(normalizeDisplay(invalid)).toEqual(displayDefaults);
  expect(normalizeDisplay({ pageFont: 1, inspectorFont: 1000, inspectorWidth: -5, inspectorHeight: 5000, extra: 'ignored' }))
    .toEqual({ pageFont: 90, inspectorFont: 180, inspectorWidth: 280, inspectorHeight: 1200 });
  expect(normalizeDisplay({ pageFont: '150', inspectorFont: Infinity, inspectorWidth: NaN, inspectorHeight: null })).toEqual(displayDefaults);
  const values = { pageFont: 118, inspectorWidth: 527.4 };
  expect(normalizeDisplay(values)).toEqual({ ...displayDefaults, pageFont: 120, inspectorWidth: 527 });
  expect(values).toEqual({ pageFont: 118, inspectorWidth: 527.4 });
});
