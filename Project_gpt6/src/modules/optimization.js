import { DEFAULT_SAMPLES, evaluateLogistic, downsampleExtrema, OPTIMIZATION_VERSION } from '../core/optimization.js';
import { computeOptimization, cancelOptimization } from '../runtime/optimization-task.js';
import { downloadText, fingerprint, csvCell } from '../data/records.js';

const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const f = value => Number(value).toFixed(4);
const initialData = DEFAULT_SAMPLES.map(s => `${s.text},${s.x[0]},${s.x[1]},${s.y}`).join('\n');
const state = { data: initialData, learningRate: 0.5, steps: 40, initialWeights: [1.2, -1], run: null, baseline: null, runSamples: null, selected: 0, runId: 0, status: 'idle', backend: '', message: '' };

function parseSamples(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2 || lines.length > 2000) throw new Error('需输入 2–2000 行样本');
  return lines.map((line, index) => {
    const parts = line.split(',').map(part => part.trim());
    if (parts.length !== 4 || !parts[0] || parts[0].length > 80) throw new Error(`第 ${index + 1} 行格式应为 文本,好次数,差次数,标签`);
    const x = [Number(parts[1]), Number(parts[2])];
    const y = Number(parts[3]);
    if (x.some(n => !Number.isFinite(n) || n < 0 || n > 100) || ![0, 1].includes(y)) throw new Error(`第 ${index + 1} 行数值无效`);
    return { id: `s${index + 1}`, text: parts[0], x, y };
  });
}

function chartSvg() {
  const run = state.run;
  if (!run) return '<div class="opt-empty">点击“开始训练”查看真实的逐步损失。</div>';
  const comparable = state.baseline && state.baseline.dataFingerprint === fingerprint(state.runSamples) && state.baseline.steps === run.steps;
  const all = [run, comparable ? state.baseline : null].filter(Boolean);
  const minLoss = Math.min(...all.flatMap(item => item.points.map(point => point.loss)));
  const maxLoss = Math.max(...all.flatMap(item => item.points.map(point => point.loss)));
  const maxStep = Math.max(...all.map(item => item.steps));
  const span = Math.max(maxLoss - minLoss, 0.02);
  const x = step => 52 + step / maxStep * 612;
  const y = loss => 250 - (loss - minLoss) / span * 205;
  const path = points => downsampleExtrema(points, 500).map((point, index) => `${index ? 'L' : 'M'}${x(point.step).toFixed(2)},${y(point.loss).toFixed(2)}`).join(' ');
  const selected = run.points[state.selected];
  return `<svg class="loss-chart" viewBox="0 0 700 290" role="img" aria-label="训练损失曲线，当前第 ${state.selected} 步，损失 ${f(selected.loss)}"><line x1="52" y1="45" x2="52" y2="250" stroke="#aebfc9"/><line x1="52" y1="250" x2="664" y2="250" stroke="#aebfc9"/><text x="5" y="49">${f(maxLoss)}</text><text x="5" y="252">${f(minLoss)}</text><text x="50" y="276">0</text><text x="638" y="276">${maxStep} 步</text>${comparable ? `<path d="${path(state.baseline.points)}" fill="none" stroke="#a7864d" stroke-width="2"/>` : ''}<path d="${path(run.points)}" fill="none" stroke="#087f8c" stroke-width="3"/><line x1="${x(state.selected)}" x2="${x(state.selected)}" y1="45" y2="250" stroke="#244b57" stroke-dasharray="3 4"/><circle cx="${x(state.selected)}" cy="${y(selected.loss)}" r="6" fill="#087f8c" stroke="#fff" stroke-width="2"/><rect class="chart-hit" x="52" y="40" width="612" height="215" fill="transparent" tabindex="0" aria-label="点击选择训练步"/></svg><div class="chart-key"><span><i class="key-current"></i>当前 B · η=${run.learningRate}</span>${comparable ? `<span><i class="key-base"></i>基线 A · η=${state.baseline.learningRate}</span>` : ''}<span>自然对数交叉熵 · 全量数据</span></div>`;
}

function landscapeSvg() {
  if (!state.run) return '';
  const samples = state.runSamples;
  const n = 25;
  const cells = [];
  let min = Infinity, max = -Infinity;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const w = [-3 + col * 6 / (n - 1), 3 - row * 6 / (n - 1)];
    const loss = evaluateLogistic(samples, w).loss;
    cells.push({ row, col, loss });
    min = Math.min(min, loss); max = Math.max(max, loss);
  }
  const route = downsampleExtrema(state.run.points, 100).map((point, index) => `${index ? 'L' : 'M'}${((point.weights[0] + 3) / 6 * 250).toFixed(1)},${((3 - point.weights[1]) / 6 * 250).toFixed(1)}`).join(' ');
  const selected = state.run.points[state.selected];
  return `<svg class="landscape" viewBox="0 0 250 250" role="img" aria-label="两个自由权重的真实损失切面与训练路径">${cells.map(cell => `<rect x="${cell.col * 10}" y="${cell.row * 10}" width="10" height="10" fill="rgba(8,127,140,${(0.08 + (cell.loss - min) / (max - min || 1) * 0.8).toFixed(3)})"/>`).join('')}<path d="${route}" fill="none" stroke="#b42318" stroke-width="2"/><circle cx="${(selected.weights[0] + 3) / 6 * 250}" cy="${(3 - selected.weights[1]) / 6 * 250}" r="5" fill="#fff" stroke="#b42318" stroke-width="2"/></svg><div class="landscape-axis">w₁: −3 → 3 &nbsp; · &nbsp; w₂: 3 ↓ −3</div>`;
}

function inspectorHtml() {
  if (!state.run) return '<p class="subtle">选取曲线点后显示权重、梯度和样本损失。</p>';
  const point = state.run.points[state.selected];
  const details = evaluateLogistic(state.runSamples, point.weights).details;
  const next = state.run.points[state.selected + 1];
  return `<div class="opt-inspect-value"><span>第 ${point.step} / ${state.run.steps} 次评估</span><strong>${f(point.loss)}</strong><small>平均自然对数交叉熵</small></div><dl class="opt-values"><div><dt>当前 w₁ / w₂</dt><dd>${point.weights.map(f).join(' / ')}</dd></div><div><dt>∂L/∂w₁ / ∂L/∂w₂</dt><dd>${point.gradient.map(f).join(' / ')}</dd></div>${next ? `<div><dt>更新 η=${state.run.learningRate}</dt><dd>${point.weights.map((value, j) => `${f(value)} − ${state.run.learningRate}×${f(point.gradient[j])} = ${f(next.weights[j])}`).join('<br>')}</dd></div>` : ''}</dl><div class="opt-detail-table"><table><thead><tr><th>样本</th><th>p(y=1)</th><th>损失</th></tr></thead><tbody>${details.slice(0, 12).map(item => `<tr><td>${esc(item.text)} · ${item.y}</td><td>${f(item.probability)}</td><td>${f(item.loss)}</td></tr>`).join('')}</tbody></table>${details.length > 12 ? `<p>仅显示前 12 / ${details.length} 条；总损失用全部样本计算。</p>` : ''}</div>`;
}

export function optimizationView() {
  const last = state.run?.points.at(-1);
  return `<div class="page-title"><div><div class="eyebrow">MODULE 06 / LEARNING DYNAMICS</div><h1>损失与优化 <span>实验室</span></h1><p>训练只有两个自由权重的 Logistic 分类器，观察每次真实更新。</p></div><button class="btn secondary" id="opt-reset">重置案例</button></div><div class="opt-layout"><section class="panel opt-config"><div class="panel-heading"><span class="eyebrow">01 / DATA & TRAINING</span><h2>训练配置</h2><p>标签 1 为正类；x₁/x₂ 分别为“好/差”计数。</p></div><form id="opt-form"><label>样本数据 <span>文本,好次数,差次数,标签</span><textarea id="opt-data" rows="7">${esc(state.data)}</textarea></label><div class="form-grid"><label>学习率 η<input id="opt-lr" type="number" min="0.001" max="100" step="0.001" value="${state.learningRate}"></label><label>更新步数<input id="opt-steps" type="number" min="1" max="5000" step="1" value="${state.steps}"></label></div><div class="opt-presets"><span>学习率案例</span><button type="button" data-lr="0.01">慢 0.01</button><button type="button" data-lr="0.5">稳 0.5</button><button type="button" data-lr="8">震荡 8</button></div><p class="form-note">固定初值 w=[1.2, −1]，无偏置，使用全量梯度下降。默认样本故意包含相同特征的相反标签，最优损失有下界；这不是语言理解模型。</p><button class="btn primary run-button" id="opt-run" type="submit">开始训练 <span>→</span></button><button class="btn secondary" id="opt-cancel" type="button" disabled>取消当前训练</button><div id="opt-status" class="run-status ${state.status}" role="status">${esc(state.message || ({ idle: '尚未训练', running: '正在计算真实更新', completed: `完成 · ${state.backend === 'blob-worker' ? 'Worker' : '主线程'}`, stale: '配置已变化，请重新训练', failed: '运行失败' })[state.status])}</div></form></section><section class="panel opt-main"><div class="result-top"><div><div class="eyebrow">LOSS TRAJECTORY</div><h2>交叉熵随更新变化</h2></div>${last ? `<div class="result-tally"><strong>${f(last.loss)}</strong><span>最终平均损失</span></div>` : ''}</div>${chartSvg()}${state.run ? `<label class="step-label">选择实际迭代点 <input id="opt-step" type="range" min="0" max="${state.run.steps}" value="${state.selected}"><span>${state.selected} / ${state.run.steps}</span></label>` : ''}<div class="opt-landscape"><div><div class="eyebrow">TWO-WEIGHT LOSS SURFACE</div><h3>损失切面与更新路径</h3><p>模型仅有 w₁、w₂ 两个可训练参数；格子颜色由当前数据上的真实损失计算。红线为保存的权重轨迹。</p></div>${landscapeSvg()}</div></section><aside class="panel opt-inspector"><div class="inspector-head"><span class="eyebrow">02 / COMPUTATION MICROSCOPE</span><h2>更新检查器</h2><p>曲线点 → 损失 → 梯度 → 下一步权重。</p></div><div class="opt-inspector-body">${inspectorHtml()}</div></aside></div><section class="lower-grid"><div class="panel compare-panel"><div class="panel-heading"><span class="eyebrow">CONTROLLED COMPARISON</span><h2>固定初值的学习率对照</h2><p>固定 A 后修改学习率再训练 B；只有数据、步数与初值相同时叠加曲线。</p></div><div class="compare-actions"><button class="btn secondary" id="opt-freeze" ${!state.run || state.status !== 'completed' ? 'disabled' : ''}>固定当前为 A</button><button class="btn text-button" id="opt-clear" ${!state.baseline ? 'disabled' : ''}>清除 A</button></div><div class="compare-details">${state.baseline ? `A: η=${state.baseline.learningRate} · ${state.baseline.steps} 步 · 数据指纹 ${state.baseline.dataFingerprint}。${state.baseline.dataFingerprint === fingerprint(state.runSamples) && state.baseline.steps === state.run?.steps ? '数据和步数一致。' : '数据或步数不一致，叠加曲线仅供参考。'}` : '还没有基线。'}</div></div><div class="panel records-panel"><div class="panel-heading"><span class="eyebrow">EXPORT</span><h2>带走原始轨迹</h2><p>每个点都有真实权重、损失和梯度；CSV 不使用图上降采样的数据。</p></div><div class="record-actions"><button class="btn secondary" id="opt-json" ${!state.run ? 'disabled' : ''}>导出 JSON</button><button class="btn secondary" id="opt-csv" ${!state.run ? 'disabled' : ''}>导出 CSV</button><button class="btn secondary" id="opt-md" ${!state.run ? 'disabled' : ''}>导出 Markdown</button></div></div></section>`;
}

function exportRun(kind) {
  const record = { schemaVersion: 1, module: 'M06', algorithmVersion: OPTIMIZATION_VERSION, createdAt: new Date().toISOString(), samples: state.runSamples, dataFingerprint: fingerprint(state.runSamples), preprocessing: 'explicit two-count features', model: { type: 'binary logistic', bias: false, featureOrder: ['好', '差'] }, result: state.run, backend: state.backend };
  const csv = [['step', 'loss', 'w1', 'w2', 'gradient_w1', 'gradient_w2'], ...state.run.points.map(point => [point.step, point.loss, ...point.weights, ...point.gradient])].map(row => row.map(csvCell).join(',')).join('\r\n');
  const markdown = `# Logistic 优化实验\n\n- 算法：${OPTIMIZATION_VERSION}\n- 数据指纹：${record.dataFingerprint}\n- 样本数：${state.runSamples.length}\n- 初始权重：${state.run.initialWeights.join(', ')}\n- 学习率：${state.run.learningRate}\n- 更新步数：${state.run.steps}\n- 最终损失：${state.run.points.at(-1).loss}\n- 后端：${state.backend}\n\n注：模型仅有两个权重，无偏置；默认数据含冲突标签。完整逐步数值见 JSON/CSV。\n`;
  downloadText(`tensorscope-optimization-${record.dataFingerprint}.${kind}`, kind === 'json' ? JSON.stringify(record, null, 2) : kind === 'csv' ? csv : markdown, kind === 'json' ? 'application/json' : 'text/plain');
}

export function bindOptimization(render) {
  document.querySelector('#opt-form').onsubmit = async event => {
    event.preventDefault();
    const runId = ++state.runId;
    state.data = document.querySelector('#opt-data').value;
    state.learningRate = Number(document.querySelector('#opt-lr').value);
    state.steps = Number(document.querySelector('#opt-steps').value);
    try {
      const samples = parseSamples(state.data);
      state.status = 'running'; state.message = '';
      document.querySelector('#opt-status').textContent = '正在计算真实更新'; document.querySelector('#opt-cancel').disabled = false;
      const response = await computeOptimization({ samples, learningRate: state.learningRate, steps: state.steps, initialWeights: state.initialWeights }, runId);
      if (response.runId !== state.runId) return;
      state.run = response.result; state.runSamples = samples; state.selected = 0; state.backend = response.backend; state.status = 'completed';
      render();
    } catch (error) { if (runId !== state.runId) return; state.status = error.message === '已取消' ? 'cancelled' : 'failed'; state.message = error.message || String(error); document.querySelector('#opt-status').textContent = state.message; document.querySelector('#opt-status').className = `run-status ${state.status}`; document.querySelector('#opt-cancel').disabled = true; }
  };
  document.querySelector('#opt-cancel').onclick = () => { state.runId++; cancelOptimization(); state.status = 'cancelled'; state.message = '已取消当前训练'; document.querySelector('#opt-status').textContent = state.message; document.querySelector('#opt-cancel').disabled = true; };
  document.querySelector('#opt-reset').onclick = () => { cancelOptimization(); state.runId++; Object.assign(state, { data: initialData, learningRate: 0.5, steps: 40, run: null, baseline: null, runSamples: null, selected: 0, status: 'idle', message: '' }); render(); };
  ['#opt-data', '#opt-lr', '#opt-steps'].forEach(selector => document.querySelector(selector).addEventListener('input', () => { state.data = document.querySelector('#opt-data').value; state.learningRate = Number(document.querySelector('#opt-lr').value); state.steps = Number(document.querySelector('#opt-steps').value); if (state.run) { state.status = 'stale'; document.querySelector('#opt-status').textContent = '配置已变化，请重新训练'; document.querySelector('#opt-status').className = 'run-status stale'; document.querySelector('#opt-freeze').disabled = true; } }));
  document.querySelectorAll('[data-lr]').forEach(button => button.onclick = () => { document.querySelector('#opt-lr').value = button.dataset.lr; document.querySelector('#opt-lr').dispatchEvent(new Event('input')); });
  document.querySelector('#opt-step')?.addEventListener('input', event => { state.selected = Number(event.target.value); const currentData = document.querySelector('#opt-data').value; const lr = document.querySelector('#opt-lr').value; const steps = document.querySelector('#opt-steps').value; render(); document.querySelector('#opt-data').value = currentData; document.querySelector('#opt-lr').value = lr; document.querySelector('#opt-steps').value = steps; });
  document.querySelector('.chart-hit')?.addEventListener('click', event => { const rect = event.currentTarget.getBoundingClientRect(); state.selected = Math.max(0, Math.min(state.run.steps, Math.round((event.clientX - rect.left) / rect.width * state.run.steps))); render(); });
  document.querySelector('#opt-freeze').onclick = () => { state.baseline = { ...structuredClone(state.run), dataFingerprint: fingerprint(state.runSamples) }; render(); };
  document.querySelector('#opt-clear').onclick = () => { state.baseline = null; render(); };
  for (const kind of ['json', 'csv', 'md']) document.querySelector(`#opt-${kind}`).onclick = () => exportRun(kind);
}

export function leaveOptimization() { cancelOptimization(); state.runId++; }
