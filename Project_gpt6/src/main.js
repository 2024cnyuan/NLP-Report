import './styles.css';
import { tokenize, makeVectors, inspectCell, runAttention } from './core/attention.js';
import { computeAttention, cancelAttention } from './runtime/attention-task.js';
import { makeRecord, saveRecord, loadRecords, validateRecord, recordCsv, recordMarkdown, downloadText } from './data/records.js';
import { optimizationView, bindOptimization, leaveOptimization } from './modules/optimization.js';
import { embeddingsView, bindEmbeddings, leaveEmbeddings } from './modules/embeddings.js';

const app = document.querySelector('#app');
const fmt = value => Number(value).toFixed(4);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const defaultInput = { source: '猫 喜欢 鱼 今天', target: '猫 吃 鱼', method: 'scaled', dimensions: 4, masked: [], mode: 'principle', name: '猫与鱼 · 注意力实验', note: '' };
const state = { input: structuredClone(defaultInput), runInput: null, config: null, result: null, baseline: null, selected: [0, 0], runId: 0, status: 'idle', backend: '', page: 'home', message: '' };

function buildConfig(input) {
  const sourceTokens = tokenize(input.source);
  const targetTokens = tokenize(input.target);
  if (input.mode === 'principle' && (sourceTokens.length > 12 || targetTokens.length > 12)) throw new Error('原理模式每侧最多 12 个 Token；请切换实验模式');
  const dimensions = Number(input.dimensions);
  const queries = makeVectors(targetTokens, dimensions);
  const keys = makeVectors(sourceTokens, dimensions);
  return { input: { ...input, sourceTokens, targetTokens }, config: { queries, keys, values: keys.map(row => [...row]), method: input.method, masked: input.masked.filter(index => index < sourceTokens.length) } };
}

function navigate(page) {
  cancelAttention();
  leaveOptimization();
  leaveEmbeddings();
  state.runId++;
  state.page = page;
  location.hash = page;
  render();
}

function shell(content) {
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#home"><span class="brand-mark">T<span>·</span></span><span><strong>TensorScope</strong><small>NLP 原理实验室</small></span></a><div class="nav-caption">工作空间</div><nav aria-label="主导航"><a href="#home" class="nav-link ${state.page === 'home' ? 'active' : ''}"><span class="nav-num">⌂</span>实验首页</a><a href="#embeddings" class="nav-link ${state.page === 'embeddings' ? 'active' : ''}"><span class="nav-num">01</span>词向量</a><a href="#attention" class="nav-link ${state.page === 'attention' ? 'active' : ''}"><span class="nav-num">04</span>注意力机制</a><a href="#optimization" class="nav-link ${state.page === 'optimization' ? 'active' : ''}"><span class="nav-num">06</span>损失与优化</a></nav><div class="nav-caption muted-nav">开发路线</div><div class="roadmap">02 序列模型<br>03 Text-CNN<br>05 多模型对照</div><div class="sidebar-foot">本地计算 · 无需登录<br>当前可用：M01、M04、M06</div></aside><div class="main-shell"><header class="topbar"><div class="crumb">实验工作台 <span>/</span> ${state.page === 'embeddings' ? 'M01 词向量' : state.page === 'attention' ? 'M04 注意力机制' : state.page === 'optimization' ? 'M06 损失与优化' : '总览'}</div><div class="top-meta"><span class="live-dot"></span> 离线优先 · 算法版本 1.0</div></header><main>${content}</main></div></div>`;
}

function renderHome() {
  shell(`<section class="home-head"><div class="eyebrow">INTERACTIVE NLP LAB · 03 / 06 READY</div><h1>把计算过程，<br><em>放到眼前。</em></h1><p>训练词向量、拆解注意力、观察真实梯度。当前三个模块都在浏览器本地运行，数字来自实际算法。</p><div class="home-actions"><button class="btn primary home-cta" id="open-embeddings">训练词向量 <span aria-hidden="true">↗</span></button><button class="btn secondary home-cta" id="open-attention">查看注意力</button></div></section><section class="home-lower"><div class="home-statement"><div class="eyebrow">实验链起点</div><h2>词向量<br>训练与空间</h2><p>用自己的小语料运行 CBOW、Skip-gram 或 GloVe，再检查邻居、类比和 PCA 投影。</p><div class="mini-flow"><span>语料窗口</span><b>→</b><span>真实更新</span><b>→</b><span>高维向量</span><b>→</b><span>查询 / PCA</span></div></div><div class="home-principles"><div><span>01</span><strong>逐项核算</strong><p>窗口、共现、权重和梯度均可回到真实输入。</p></div><div><span>02</span><strong>固定基线</strong><p>冻结一次运行，再修改单一变量观察差值。</p></div><div><span>03</span><strong>带走实验</strong><p>实际模型和轨迹可导出 JSON、CSV、Markdown。</p></div></div></section>`);
  document.querySelector('#open-embeddings').onclick = () => navigate('embeddings');
  document.querySelector('#open-attention').onclick = () => navigate('attention');
}

function matrixHtml(result, input, baseline = null) {
  const maxRows = input.mode === 'principle' ? 12 : 16;
  const maxCols = input.mode === 'principle' ? 12 : 16;
  const rows = result.weights.slice(0, maxRows);
  const compatibleBaseline = baseline && baseline.input.sourceTokens.join('|') === input.sourceTokens.join('|') && baseline.input.targetTokens.join('|') === input.targetTokens.join('|') && baseline.input.dimensions === Number(input.dimensions) ? baseline : null;
  const maximum = Math.max(...result.weights.flat(), ...(compatibleBaseline?.result.weights.flat() || []));
  const head = input.sourceTokens.slice(0, maxCols).map((token, j) => `<th scope="col"><span class="axis-index">${j + 1}</span>${escapeHtml(token)}</th>`).join('');
  const body = rows.map((row, i) => `<tr><th scope="row"><span class="axis-index">${i + 1}</span>${escapeHtml(input.targetTokens[i])}</th>${row.slice(0, maxCols).map((weight, j) => {
    const delta = compatibleBaseline?.result.weights[i]?.[j] === undefined ? null : weight - compatibleBaseline.result.weights[i][j];
    const selected = state.selected[0] === i && state.selected[1] === j;
    return `<td><button class="heat-cell ${selected ? 'selected' : ''}" data-cell="${i},${j}" style="--heat:${(weight / (maximum || 1) * 0.7).toFixed(3)}" aria-label="目标 ${escapeHtml(input.targetTokens[i])}，来源 ${escapeHtml(input.sourceTokens[j])}，权重 ${fmt(weight)}${delta === null ? '' : `，差值 ${fmt(delta)}`}" title="权重 ${fmt(weight)}"><span>${fmt(weight)}</span>${delta === null ? '' : `<small class="delta ${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '+' : ''}${fmt(delta)}</small>`}</button></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="matrix-scroll"><table class="heat-table"><thead><tr><th scope="col">目标 ↓ / 来源 →</th>${head}</tr></thead><tbody>${body}</tbody></table></div><p class="chart-foot">行 = 目标 Token · 列 = 来源 Token · 色深 = 权重（0 → ${fmt(maximum)}） · 已计算 ${input.targetTokens.length * input.sourceTokens.length} 格，显示 ${rows.length * Math.min(maxCols, input.sourceTokens.length)} 格。${input.mode === 'experiment' ? '实验模式仅绘制前 16×16；全量结果保留在导出文件。' : ''}${baseline && !compatibleBaseline ? ' 基线 Token 或维度不一致，差值已停用。' : ''}</p>`;
}

function inspectorHtml() {
  if (!state.result || !state.config) return `<div class="inspector-empty">运行实验并选择热力图单元，查看数字从哪里来。</div>`;
  const [i, j] = state.selected;
  if (i >= state.config.queries.length || j >= state.config.keys.length) return '<div class="inspector-empty">请选择有效单元。</div>';
  const cell = inspectCell(state.config, state.result, i, j);
  const name = `${state.runInput.targetTokens[i]} → ${state.runInput.sourceTokens[j]}`;
  const formula = state.config.method === 'additive' ? 'Σ tanh(qₜ + kₜ) / √d' : state.config.method === 'scaled' ? 'Σ qₜ kₜ / √d' : 'Σ qₜ kₜ';
  return `<div class="inspector-content"><div class="inspect-overline">TARGET ${i + 1} / SOURCE ${j + 1}</div><h3>${escapeHtml(name)}</h3><div class="inspect-value"><span>注意力权重</span><strong>${fmt(cell.weight)}</strong>${cell.masked ? '<small>该列被掩码屏蔽</small>' : ''}</div><div class="trace-item"><span class="trace-no">01</span><div><b>输入向量 <small>Q[${i}] · K[${j}]</small></b><code>q = [${cell.q.map(fmt).join(', ')}]<br>k = [${cell.k.map(fmt).join(', ')}]</code></div></div><div class="trace-item"><span class="trace-no">02</span><div><b>打分 <small>${formula}</small></b><code>${cell.terms.map(fmt).join(' + ')}<br>= ${fmt(cell.score)}</code></div></div><div class="trace-item"><span class="trace-no">03</span><div><b>按行归一化 <small>softmax(mask(score))</small></b><code>exp(${fmt(cell.score)} − ${fmt(cell.max)}) / ${fmt(cell.denominator)}<br>= ${fmt(cell.numerator)} / ${fmt(cell.denominator)}</code></div></div><div class="trace-item"><span class="trace-no">04</span><div><b>加权输出贡献 <small>A[${i},${j}] × V[${j}]</small></b><code>[${cell.contribution.map(fmt).join(', ')}]</code></div></div><div class="inspect-output">完整输出 O[${i}]<code>[${cell.output.map(fmt).join(', ')}]</code></div></div>`;
}

function attentionContent() {
  const current = state.input;
  const resultInput = state.runInput || current;
  const resultPane = state.result ? `<div class="result-top"><div><div class="eyebrow">ATTENTION MAP</div><h2>权重矩阵 <span class="unit">A = softmax(S)</span></h2></div><div class="result-tally"><strong>${state.result.weights.length} × ${state.result.weights[0].length}</strong><span>目标 × 来源</span></div></div>${matrixHtml(state.result, resultInput, state.baseline)}<div class="result-bottom"><div><span class="eyebrow">SELECTED ROW</span><h3>第 ${state.selected[0] + 1} 个目标的输出</h3><code>[${state.result.outputs[state.selected[0]]?.map(fmt).join(', ') || ''}]</code></div><div><span class="eyebrow">CHECK</span><h3>该行权重和</h3><strong>${fmt(state.result.weights[state.selected[0]]?.reduce((a, b) => a + b, 0) || 0)}</strong></div></div>` : `<div class="empty-result"><div class="empty-glyph">Σ</div><h2>等待一次真实计算</h2><p>修改左侧输入，然后点击“运行实验”。热力图会显示真实注意力权重。</p></div>`;
  return `<div class="page-title"><div><div class="eyebrow">MODULE 04 / NEURAL MECHANISMS</div><h1>注意力机制 <span>实验面板</span></h1><p>从 Token 向量到每个权重，沿着计算路径逐格检查。</p></div><div class="title-actions"><button class="btn secondary" id="reset-input">重置案例</button><button class="btn secondary" id="demo-toggle">${document.body.classList.contains('demo') ? '退出演示' : '演示视图'}</button></div></div><div class="workbench"><section class="controls panel"><div class="panel-heading"><span class="eyebrow">01 / CONFIGURATION</span><h2>实验设置</h2><p>Token 用空格分隔；向量由字符确定性映射生成。</p></div><form id="attention-form"><label>来源序列 <span>Key / Value</span><textarea id="source" rows="2" required>${escapeHtml(current.source)}</textarea></label><label>目标序列 <span>Query</span><textarea id="target" rows="2" required>${escapeHtml(current.target)}</textarea></label><div class="form-grid"><label>打分方式<select id="method"><option value="dot" ${current.method === 'dot' ? 'selected' : ''}>点积</option><option value="scaled" ${current.method === 'scaled' ? 'selected' : ''}>缩放点积</option><option value="additive" ${current.method === 'additive' ? 'selected' : ''}>加性</option></select></label><label>向量维度<input id="dimensions" type="number" min="2" max="32" value="${current.dimensions}" required></label></div><fieldset class="mode-group"><legend>工作模式</legend><label><input type="radio" name="mode" value="principle" ${current.mode === 'principle' ? 'checked' : ''}> 原理 · ≤12 Token</label><label><input type="radio" name="mode" value="experiment" ${current.mode === 'experiment' ? 'checked' : ''}> 实验 · ≤128 Token</label></fieldset><div class="mask-field"><div class="field-caption">来源掩码 <span>屏蔽选中列</span></div><div id="mask-options" class="mask-options"></div></div><div class="form-note">加性参数固定为 Wq = Wk = I、b = 0、vₐ[t] = 1/√d；教学向量未经训练，不代表语义对齐。</div><button class="btn primary run-button" type="submit" id="run-button">运行实验 <span aria-hidden="true">→</span></button><button class="btn secondary" type="button" id="cancel-attention" disabled>取消当前计算</button><div id="run-status" class="run-status ${state.status}" role="status">${escapeHtml(state.message || statusText())}</div></form></section><section class="result panel" aria-label="注意力结果">${resultPane}</section><aside class="inspector panel" aria-label="计算检查器"><div class="inspector-head"><span class="eyebrow">02 / COMPUTATION MICROSCOPE</span><h2>计算检查器</h2><p>选中任一权重，追踪其真实中间值。</p></div>${inspectorHtml()}</aside></div><section class="lower-grid"><div class="panel compare-panel"><div class="panel-heading"><span class="eyebrow">CONTROLLED COMPARISON</span><h2>受控对照</h2><p>固定当前实验为 A，修改一种输入或参数并运行 B。共用色域，格内显示 B − A。</p></div><div class="compare-actions"><button class="btn secondary" id="freeze-baseline" ${!state.result || state.status === 'stale' ? 'disabled' : ''}>固定当前为 A</button><button class="btn text-button" id="clear-baseline" ${!state.baseline ? 'disabled' : ''}>清除基线</button></div><div class="compare-details">${state.baseline ? `<strong>基线 A 已固定</strong><span>算法 ${escapeHtml(state.baseline.config.method)} · ${state.baseline.input.dimensions} 维 · ${state.baseline.input.sourceTokens.length} 来源 × ${state.baseline.input.targetTokens.length} 目标</span><p>${state.result && (state.baseline.input.sourceTokens.join('|') !== resultInput.sourceTokens.join('|') || state.baseline.input.targetTokens.join('|') !== resultInput.targetTokens.join('|') || state.baseline.input.dimensions !== Number(resultInput.dimensions)) ? 'Token 或维度不同；差值已停用，请使用相同 Token 和维度。' : '相同位置格子显示当前实验 B 减基线 A。'} 向量映射和算法版本一致。</p>` : '还没有基线。'}</div></div><div class="panel records-panel"><div class="panel-heading"><span class="eyebrow">LAB NOTEBOOK</span><h2>实验笔记</h2><p>保存实际运行结果，导出用于复现或报告。</p></div><label>实验名称<input id="record-name" value="${escapeHtml(current.name)}"></label><label>备注<textarea id="record-note" rows="2">${escapeHtml(current.note)}</textarea></label><div class="record-actions"><button class="btn secondary" id="save-record" ${!state.result || state.status === 'stale' ? 'disabled' : ''}>保存记录</button><button class="btn text-button" id="export-json" ${!state.result || state.status === 'stale' ? 'disabled' : ''}>JSON</button><button class="btn text-button" id="export-csv" ${!state.result || state.status === 'stale' ? 'disabled' : ''}>CSV</button><button class="btn text-button" id="export-md" ${!state.result || state.status === 'stale' ? 'disabled' : ''}>Markdown</button></div><div class="record-list" id="record-list"></div><label class="import-label">导入实验 JSON <input id="import-record" type="file" accept=".json,application/json"></label></div></section>`;
}

function statusText() { return ({ idle: '尚未运行', validating: '正在检查输入', running: '正在计算', completed: `计算完成 · ${state.backend === 'blob-worker' ? 'Worker' : '主线程'}`, stale: '输入已变化；结果已过期，请重新运行', cancelled: '已取消', failed: '运行失败' })[state.status] || state.status; }

function render() {
  if (state.page === 'home') return renderHome();
  if (state.page === 'embeddings') { shell(embeddingsView()); bindEmbeddings(render); return; }
  if (state.page === 'optimization') { shell(optimizationView()); bindOptimization(render); return; }
  shell(attentionContent());
  bindAttention();
}

function refreshMaskOptions() {
  const container = document.querySelector('#mask-options');
  try {
    const tokens = tokenize(document.querySelector('#source').value).slice(0, 128);
    container.innerHTML = tokens.map((token, index) => `<label><input type="checkbox" value="${index}" ${state.input.masked.includes(index) ? 'checked' : ''}><span>${index + 1}. ${escapeHtml(token)}</span></label>`).join('');
    container.querySelectorAll('input').forEach(input => input.onchange = markStale);
  } catch { container.textContent = '输入来源 Token 后显示掩码'; }
}

function readForm() {
  return { ...state.input, source: document.querySelector('#source').value, target: document.querySelector('#target').value, method: document.querySelector('#method').value, dimensions: Number(document.querySelector('#dimensions').value), masked: [...document.querySelectorAll('#mask-options input:checked')].map(item => Number(item.value)), mode: document.querySelector('input[name="mode"]:checked').value, name: document.querySelector('#record-name').value, note: document.querySelector('#record-note').value };
}

function markStale() {
  state.input = readForm();
  if (state.result) { state.status = 'stale'; state.message = ''; document.querySelector('#run-status').textContent = statusText(); document.querySelector('#run-status').className = 'run-status stale'; }
}

function currentRecord() {
  const input = state.runInput;
  return makeRecord(document.querySelector('#record-name')?.value || state.input.name, input, state.config, state.result, state.backend, document.querySelector('#record-note')?.value || '');
}

function renderRecordList() {
  const list = document.querySelector('#record-list');
  const records = loadRecords();
  list.innerHTML = records.length ? records.slice(0, 5).map((record, index) => `<button class="record-row" data-record="${index}"><b>${escapeHtml(record.name)}</b><small>${escapeHtml(record.createdAt.slice(0, 16).replace('T', ' '))} · ${escapeHtml(record.config.method)}</small></button>`).join('') : '<p class="subtle">暂无保存记录</p>';
  list.querySelectorAll('[data-record]').forEach(button => button.onclick = () => replayRecord(records[Number(button.dataset.record)]));
}

async function replayRecord(record) {
  try {
    validateRecord(record);
    state.input = { ...defaultInput, ...record.input };
    const built = buildConfig(state.input);
    state.runInput = built.input;
    state.config = built.config;
    state.result = runAttention(state.config);
    state.backend = 'replayed';
    state.status = 'completed';
    state.message = '已用当前算法重新计算导入配置；请核对版本与向量映射';
    state.selected = [0, 0];
    render();
  } catch (error) { showError(error); }
}

function showError(error) {
  state.status = 'failed';
  state.message = error.message || String(error);
  const target = document.querySelector('#run-status');
  if (target) { target.textContent = state.message; target.className = 'run-status failed'; }
}

function bindAttention() {
  refreshMaskOptions();
  document.querySelector('#source').addEventListener('input', () => { state.input.masked = []; refreshMaskOptions(); markStale(); });
  ['#target', '#method', '#dimensions', ...[]].forEach(selector => document.querySelector(selector).addEventListener('input', markStale));
  document.querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener('change', markStale));
  document.querySelector('#attention-form').onsubmit = async event => {
    event.preventDefault();
    const runId = ++state.runId;
    state.status = 'validating';
    state.message = '';
    document.querySelector('#run-status').textContent = statusText();
    try {
      state.input = readForm();
      const built = buildConfig(state.input);
      state.config = built.config;
      state.status = 'running';
      document.querySelector('#run-status').textContent = statusText();
      document.querySelector('#cancel-attention').disabled = false;
      const response = await computeAttention(state.config, runId);
      if (response.runId !== state.runId || state.page !== 'attention') return;
      state.result = response.result;
      state.runInput = built.input;
      state.backend = response.backend;
      state.status = 'completed';
      state.selected = [0, 0];
      render();
    } catch (error) { if (runId === state.runId) showError(error); }
  };
  document.querySelector('#cancel-attention').onclick = () => { state.runId++; cancelAttention(); state.status = 'cancelled'; state.message = '已取消当前计算'; document.querySelector('#run-status').textContent = state.message; document.querySelector('#cancel-attention').disabled = true; };
  document.querySelector('#reset-input').onclick = () => { state.input = structuredClone(defaultInput); state.runInput = null; state.result = null; state.config = null; state.baseline = null; state.status = 'idle'; state.message = ''; render(); };
  document.querySelector('#demo-toggle').onclick = () => { document.body.classList.toggle('demo'); render(); };
  document.querySelectorAll('[data-cell]').forEach(button => button.onclick = () => { state.selected = button.dataset.cell.split(',').map(Number); render(); });
  document.querySelector('#freeze-baseline').onclick = () => { state.baseline = { input: structuredClone(state.runInput), config: structuredClone(state.config), result: structuredClone(state.result) }; render(); };
  document.querySelector('#clear-baseline').onclick = () => { state.baseline = null; render(); };
  document.querySelector('#save-record').onclick = () => { const record = currentRecord(); const storage = saveRecord(record); state.message = storage === 'memory' ? '已保存到本次会话；浏览器不允许本地持久存储，请导出 JSON' : '实验已保存'; document.querySelector('#run-status').textContent = state.message; renderRecordList(); };
  for (const format of ['json', 'csv', 'md']) document.querySelector(`#export-${format}`).onclick = () => { const record = currentRecord(); const content = format === 'json' ? JSON.stringify(record, null, 2) : format === 'csv' ? recordCsv(record) : recordMarkdown(record); downloadText(`tensorscope-${record.dataFingerprint}.${format}`, content, format === 'json' ? 'application/json' : 'text/plain'); };
  document.querySelector('#import-record').onchange = async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 2_000_000) throw new Error('文件超过 2 MB'); await replayRecord(validateRecord(JSON.parse(await file.text()))); } catch (error) { showError(error); } };
  renderRecordList();
}

window.addEventListener('hashchange', () => { const page = location.hash.slice(1); if (page !== state.page) { cancelAttention(); leaveOptimization(); leaveEmbeddings(); } state.page = ['embeddings', 'attention', 'optimization'].includes(page) ? page : 'home'; render(); });
state.page = ['embeddings', 'attention', 'optimization'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
render();
