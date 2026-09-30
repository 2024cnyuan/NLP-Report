import { it, expect } from '../../../tools/testing/vitest.js';
import { formulaTypesetting, renderFormula } from '../../../src/components/math.js';
import { localFontPostCSS } from '../../../tools/font/plugin.mjs';

it('六模块20种原有公式均可排版，包含MathML且无KaTeX错误', () => {
  expect(formulaTypesetting.size).toBe(20);
  for (const [source, equations] of formulaTypesetting) {
    const html = renderFormula(source);
    expect(html, source).not.toBeNull();
    expect(html, source).toContain('class="katex"');
    expect(html, source).toContain('<math');
    expect(html, source).not.toContain('katex-error');
    expect((html.match(/class="math-equation"/g) ?? []).length, source).toBe(equations.length);
  }
});

it('未识别公式不猜测或执行用户LaTeX，由检查器保留转义原文', () => {
  for (const source of [undefined, '', '<img src=x onerror=alert(1)>', '\\href{javascript:alert(1)}{x}', '未来的新公式']) {
    expect(renderFormula(source)).toBeNull();
  }
});

it('字体构建只移除同一font-face的旧格式，不修改字体内容或其他CSS', () => {
  const declaration = { parent: { type: 'atrule', name: 'font-face' }, value: 'url(fonts/A.woff2) format("woff2"), url(fonts/A.woff) format("woff"), url(fonts/A.ttf) format("truetype")' };
  localFontPostCSS.Declaration.src(declaration);
  expect(declaration.value).toBe('url(fonts/A.woff2) format("woff2")');
  const other = { parent: { type: 'rule' }, value: 'url(A.woff2) format("woff2"), url(A.ttf)' };
  localFontPostCSS.Declaration.src(other);
  expect(other.value).toBe('url(A.woff2) format("woff2"), url(A.ttf)');
});
