import { diagnose } from '../algorithms/diagnosis.js';
import { panel, select, escapeHTML, fmt, pct, inspect, safe } from './ui.js';
import { predict } from '../algorithms/classifiers.js';

export function diagnosisHTML(current, name, prefix = 'diagnosis') {
  const d = diagnose(current.rows, name), labels = current.classes;
  const modelNames = current.modelNames ?? Object.keys(current.models);
  return panel('模型错误诊断', '从真实错分样本找线索，再回到同一模型检查计算；不自动给错误编造原因。', `
    <div class="panel-body">
      <label class="field"><span class="field-label">诊断模型</span>${select(`${prefix}-model`, modelNames.map(n => [n, n]), name)}</label>
      <div class="diagnosis-stats"><span>已标注 <strong>${d.count}</strong></span><span>错分 <strong>${d.errors}</strong></span><span>错误率 <strong>${d.errorRate == null ? '—' : pct(d.errorRate)}</strong></span><span>OOV Token 占比 <strong>${d.oovRate == null ? '—' : pct(d.oovRate)}</strong></span></div>
      <p class="small">${d.directions.map(v => `${escapeHTML(labels[v.trueLabel])} → ${escapeHTML(labels[v.predictedLabel])}：${v.count} 条`).join('；')}</p>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>观察切片</th><th>样本数</th><th>错分数</th><th>切片错误率</th></tr></thead><tbody>${d.slices.map(s => `<tr data-slice="${s.id}"><td>${s.label}</td><td>${s.count}</td><td>${s.errors}</td><td>${s.errorRate == null ? '无样本' : pct(s.errorRate)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small">${escapeHTML(d.limits)}</p>
      <details ${d.errors ? 'open' : ''}><summary>错误案例 · 前 ${Math.min(10, d.errors)} / ${d.errors} 条（概率降序；SVM 原顺序）</summary>
      ${d.evidence.slice(0, 10).map(e => { const row = current.rows.find(r => r.id === e.id); return `<article class="diagnosis-case"><p>${escapeHTML(row.text)}</p><p class="small">${escapeHTML(e.id)} · 真实 ${escapeHTML(labels[e.label])} → 预测 ${escapeHTML(labels[e.prediction])} · ${name === 'SVM' ? `margin=${fmt(e.margin, 4)}（非概率）` : `归一化 p=${fmt(e.confidence, 4)}（未校准）`}<br>${e.clues.map(escapeHTML).join('；')}</p><button class="btn compact" data-diagnose="${escapeHTML(e.id)}">${name === 'RNN' || name === 'CNN' ? '查看原模型计算' : '检查词项贡献'}</button></article>`; }).join('') || '<p class="small">当前没有错分样本。小样本全对不代表已解决这个任务。</p>'}
      </details>
    </div>`, '', 'diagnosis-panel');
}

export function bindDiagnosis(root, current, name, change, prefix = 'diagnosis') {
  root.querySelector(`#${prefix}-model`).onchange = e => change(e.target.value);
  root.querySelectorAll('[data-diagnose]').forEach(el => el.onclick = safe(() => {
    const row = current.rows.find(r => r.id === el.dataset.diagnose), model = current.models[name];
    if (name === 'RNN' || name === 'CNN') return change(name, row, model);
    const r = predict(model, row.tokens, { trace: true });
    inspect({ title: `${name} 错分：${model.classes[row.label]} → ${model.classes[r.prediction]}`,
      value: name === 'SVM' ? r.score : r.probabilities[r.prediction],
      formula: name === 'SVM' ? 'score=w·count(tokens)+b；类别=sign(score)' : 'log P(c,x)=log P(c)+Σ count(w)log P(w|c)；P=softmax(logscores)',
      inputs: { tokens: row.tokens, logits: r.logits, terms: r.terms, bias: model.bias, logPrior: model.logPrior },
      source: `原模型 ${model.id} · 原样本 ${row.id}`, detail: '词项贡献说明当前模型如何打分，不证明这些词是错分的因果原因。' });
  }));
}
