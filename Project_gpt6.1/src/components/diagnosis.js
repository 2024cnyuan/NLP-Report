import { diagnose } from '../algorithms/diagnosis.js';
import { panel, select, escapeHTML, fmt, pct, inspect, safe } from './ui.js';
import { predict } from '../algorithms/classifiers.js';
import { analyzeError } from '../algorithms/error-analysis.js';

// View-only cache: never added to exported measurements or training configuration.
const analyses = new WeakMap();
const cachedDetail = (current,name,id) => analyses.get(current)?.get(`${name}:${id}`);

export function diagnosisHTML(current, name, prefix = 'diagnosis') {
  const d = diagnose(current.rows, name, current), labels = current.classes;
  const modelNames = current.modelNames ?? Object.keys(current.models);
  return panel('模型错误诊断', '从真实错分样本找线索，再回到同一模型检查计算；不自动给错误编造原因。', `
    <div class="panel-body">
      <label class="field"><span class="field-label">诊断模型</span>${select(`${prefix}-model`, modelNames.map(n => [n, n]), name)}</label>
      <div class="diagnosis-stats"><span>已标注 <strong>${d.count}</strong></span><span>错分 <strong>${d.errors}</strong></span><span>错误率 <strong>${d.errorRate == null ? '—' : pct(d.errorRate)}</strong></span><span>OOV Token 占比 <strong>${d.oovRate == null ? '—' : pct(d.oovRate)}</strong></span></div>
      <p class="small">${d.directions.map(v => `${escapeHTML(labels[v.trueLabel])} → ${escapeHTML(labels[v.predictedLabel])}：${v.count} 条`).join('；')}</p>
      <p class="small">平均${name==='SVM'?'绝对 margin（非概率）':'预测类归一化概率（未校准）'}：正确样本 ${fmt(d.certainty.correct,4)} / 错误样本 ${fmt(d.certainty.wrong,4)}${d.certainty.highConfidenceErrors==null?'':`；p≥0.9 仍错 ${d.certainty.highConfidenceErrors} 条`}。这些数值不等同于可靠性校准。</p>
      <div class="diagnosis-findings">${d.findings.map(f=>`<article class="diagnosis-finding" data-finding="${f.id}"><p><strong>已观察：</strong>${escapeHTML(f.observed)}</p><p><strong>待验证：</strong>${escapeHTML(f.hypothesis)}</p><p><strong>下一步：</strong>${escapeHTML(f.next)}</p><p class="small">${escapeHTML(f.caution)}</p></article>`).join('')}</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>观察切片</th><th>样本数</th><th>错分数</th><th>切片错误率</th></tr></thead><tbody>${d.slices.map(s => `<tr data-slice="${s.id}"><td>${s.label}</td><td>${s.count}</td><td>${s.errors}</td><td>${s.errorRate == null ? '无样本' : pct(s.errorRate)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small">${escapeHTML(d.limits)}</p>
      <details ${d.errors ? 'open' : ''}><summary>错误案例 · 前 ${Math.min(10, d.errors)} / ${d.errors} 条（概率降序；SVM 原顺序）</summary>
      ${d.evidence.slice(0, 10).map(e => { const row = current.rows.find(r => r.id === e.id); return `<article class="diagnosis-case"><p>${escapeHTML(row.text)}</p><p class="small">${escapeHTML(e.id)} · 真实 ${escapeHTML(labels[e.label])} → 预测 ${escapeHTML(labels[e.prediction])} · ${name === 'SVM' ? `margin=${fmt(e.margin, 4)}（非概率）` : `归一化 p=${fmt(e.confidence, 4)}（未校准）`}<br>${e.clues.map(escapeHTML).join('；')}</p><div class="inline-actions"><button class="btn compact" data-analyze="${escapeHTML(e.id)}">深入分析 · 原权重复算</button><button class="btn compact" data-diagnose="${escapeHTML(e.id)}">${name === 'RNN' || name === 'CNN' ? '查看原模型计算' : '检查词项贡献'}</button></div><div data-analysis="${escapeHTML(e.id)}" aria-live="polite">${cachedDetail(current,name,e.id)?errorDetailHTML(cachedDetail(current,name,e.id),labels):''}</div></article>`; }).join('') || '<p class="small">当前没有错分样本。小样本全对不代表已解决这个任务。</p>'}
      </details>
    </div>`, '', 'diagnosis-panel');
}

function errorDetailHTML(a, labels) {
  return `<section class="diagnosis-detail"><h4>本条错误如何产生分数</h4>
    <p class="small">原模型 ${escapeHTML(a.modelId)} · 原样本 ${escapeHTML(a.sampleId)} · 同一 Token 复算；真实 ${escapeHTML(labels[a.target])}，预测 ${escapeHTML(labels[a.predicted])}。</p>
    <p>${escapeHTML(a.mechanism)}</p><p>预测类相对真实类的决策差 ${fmt(a.decisionGap,6)} = 偏置/先验差 ${fmt(a.bias,6)} + 全部特征贡献 ${fmt(a.contributionSum-a.bias,6)}；加和残差 ${a.residual.toExponential(2)}。正贡献支持当前预测，负贡献支持真实类别。SVM 使用朝预测类别方向的 margin，其余使用 logit 差。</p>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>特征（按贡献绝对值）</th><th>计数 / 激活</th><th>分数贡献</th><th>来源窗口</th></tr></thead><tbody>${a.terms.slice(0,12).map(t=>`<tr><td>${escapeHTML(t.feature)}</td><td>${fmt(t.count??t.activation,4)}</td><td>${fmt(t.value,6)}</td><td>${t.context==null?'—':`${escapeHTML(t.context)}（起点 ${t.position+1}）`}</td></tr>`).join('')}</tbody></table></div><p class="small">展示前 ${Math.min(12,a.terms.length)} / ${a.terms.length} 项；加和使用全部特征。${a.unknown.length?`OOV 共 ${a.unknown.length} 个，映射到同一个 &lt;UNK&gt;：${a.unknown.slice(0,16).map(v=>`${escapeHTML(v.token)}@${v.position+1}`).join('、')}${a.unknown.length>16?' …':''}`:'原文本无 OOV。'}</p>
    ${a.states.length?`<p class="small">真实隐藏状态范数：首步 ${fmt(a.states[0].norm,6)} / 末步 ${fmt(a.states.at(-1).norm,6)}（共 ${a.states.length} 步）。这不是梯度，不能据此诊断梯度消失；完整状态请进入原模型计算。</p>`:''}
    <h4>固定权重的输入扰动实验</h4><p class="small">${escapeHTML(a.probePolicy)}；不是逐词完整归因，也不按真实标签挑选扰动。</p>
    ${a.probes.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>删除 Token / 原位置</th><th>新预测</th><th>原方向决策差</th><th>新−原</th></tr></thead><tbody>${a.probes.map(p=>`<tr><td>${escapeHTML(p.token)} / ${p.position+1}</td><td>${escapeHTML(labels[p.prediction])}${p.prediction!==a.predicted?'（翻转）':''}</td><td>${fmt(p.gap,6)}</td><td>${fmt(p.delta,6)}</td></tr>`).join('')}</tbody></table></div>`:'<p>只有一个 Token，跳过删除，避免空序列。</p>'}
    <p class="small">${escapeHTML(a.limits)}</p><p><strong>接下来怎么查：</strong>${a.unknown.length?'先核对未知 Token 与训练词表覆盖，记录是否有关键字词被合并为 UNK。':'先核对支持错误类别的主要贡献和原文上下文，检查转折、否定范围及混合情绪。'}${a.probes.some(p=>p.prediction!==a.predicted)?'已观察到删除后的预测翻转；需要另写自然的成对句子，检查这个变化是否稳定。':'本次有限删除未翻转预测；不能据此认定其他词项或语序没有影响。'}先记录假设，再用受控案例或独立验证集验证；不要直接把测试错例改标签或加入训练。</p></section>`;
}

export function bindDiagnosis(root, current, name, change, prefix = 'diagnosis') {
  root.querySelector(`#${prefix}-model`).onchange = e => change(e.target.value);
  root.querySelectorAll('[data-analyze]').forEach(el=>el.onclick=safe(()=>{
    const row=current.rows.find(r=>r.id===el.dataset.analyze), model=current.models[name];
    const analysis=analyzeError(model,row);
    if(!analyses.has(current))analyses.set(current,new Map());
    analyses.get(current).set(`${name}:${row.id}`,analysis);
    const target=[...root.querySelectorAll('[data-analysis]')].find(node=>node.dataset.analysis===row.id);
    target.innerHTML=errorDetailHTML(analysis,model.classes);
  }));
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
