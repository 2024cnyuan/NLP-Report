import { panel, escapeHTML, fmt, inspect } from './ui.js';
import { summarizeResult } from '../algorithms/explanations.js';
import { renderFormula } from './math.js';

export function traceNumber(value) {
  if (!Number.isFinite(value)) return typeof value === 'string' ? value : '—';
  return (value !== 0 && Math.abs(value) < .00001) || Math.abs(value) >= 1e6 ? value.toExponential(4) : fmt(value, 6);
}
function preview(value) {
  if (Array.isArray(value)) {
    const values = value.slice(0, 4).map(v => Array.isArray(v) ? `[${v.slice(0, 3).map(traceNumber).join(', ')}${v.length > 3 ? ', …' : ''}]` : traceNumber(v));
    return `[${values.join(', ')}${value.length > 4 ? ', …' : ''}]`;
  }
  return traceNumber(value);
}
export function computationHTML(stages, subtitle, controls = '') {
  return panel('本次计算链 · 输入 → 中间变量 → 输出', subtitle,
    `${controls ? `<div class="trace-controls">${controls}</div>` : ''}<ol class="computation-chain">${stages.map((s, i) => `<li><button type="button" class="trace-stage" data-trace-stage="${i}" data-trace-key="${escapeHTML(s.id)}" aria-label="检查${escapeHTML(s.title)}"><span class="trace-order">${String(i + 1).padStart(2, '0')}</span><span class="trace-title">${escapeHTML(s.title)}</span><span class="trace-expression">${renderFormula(s.expression) ?? escapeHTML(s.expression)}</span><strong class="trace-value">${escapeHTML(preview(s.value))}</strong><span class="trace-open">查看代入值与计算来源 →</span></button></li>`).join('')}</ol><p class="trace-caption">全部来自本次已完成计算。点击步骤查看完整数值；修改参数后须重新计算，旧结果不会随输入框伪变。</p>`, '<span class="badge">真实数值链</span>', 'computation-panel');
}
export function bindComputation(root, stages, source) {
  root.querySelectorAll('[data-trace-stage]').forEach(button => button.onclick = () => {
    const s = stages[Number(button.dataset.traceStage)];
    inspect({ title: s.title, value: preview(s.value), formula: s.expression, inputs: s.inputs, shape: `计算链 / ${s.id}`, source, detail: s.detail });
  });
}
export function summaryHTML(summary, { stored = false } = {}) {
  if (!summary) return '';
  const cmp = summary.comparison;
  return panel(stored ? '已保存的结果分析' : '结果分析 · 基于实际数值', summary.observation,
    `<dl class="analysis-metrics">${summary.metrics.map(m => `<div data-metric="${escapeHTML(m.key)}"><dt>${escapeHTML(m.label)}</dt><dd>${escapeHTML(traceNumber(m.value))}</dd></div>`).join('')}</dl>${cmp ? `<div class="analysis-comparison"><h3>A / B 数值变化</h3><p>${escapeHTML(cmp.reason)}</p>${cmp.compatible ? `<div class="table-wrap"><table class="data-table analysis-table"><thead><tr><th>指标</th><th>A</th><th>B</th><th>B−A</th></tr></thead><tbody>${cmp.metrics.map(m => `<tr data-delta="${escapeHTML(m.key)}"><th>${escapeHTML(m.label)}</th><td>${traceNumber(m.before)}</td><td>${traceNumber(m.after)}</td><td>${traceNumber(m.delta)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>` : '<p class="trace-caption">固定为 A 后修改一个因素并重新计算，即可查看匹配口径下的指标变化。</p>'}<p class="analysis-limit">${escapeHTML(summary.limits)}</p>`, '', 'analysis-panel');
}
export const analysisHTML = (module, current, baseline) => summaryHTML(summarizeResult(module, current, baseline?.result));

export function summaryMarkdown(summary) {
  if (!summary) return '';
  const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const lines = ['## 结果分析', '', summary.observation, '', '| 指标 | 实测值 |', '|---|---:|', ...summary.metrics.map(m => `| ${cell(m.label)} | ${traceNumber(m.value)} |`), '', summary.limits, ''];
  if (summary.comparison) {
    const cmp = summary.comparison;
    lines.push('### A / B 对照', '', cmp.reason, '');
    if (cmp.compatible) lines.push('| 指标 | A | B | B−A |', '|---|---:|---:|---:|', ...cmp.metrics.map(m => `| ${cell(m.label)} | ${traceNumber(m.before)} | ${traceNumber(m.after)} | ${traceNumber(m.delta)} |`), '');
  }
  return lines.join('\n') + '\n';
}
