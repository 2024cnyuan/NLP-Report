import { nearest, analogy, pca2d, cosine, EMBEDDING_VERSION } from '../core/embeddings.js';
import { computeEmbeddings, cancelEmbeddings } from '../runtime/embeddings-task.js';
import { downloadText, fingerprint, csvCell } from '../data/records.js';

const defaultCorpus = `国王 王后 王室 宫殿\n男人 国王 王室\n女人 王后 王室\n国王 男人 强大\n王后 女人 优雅\n猫 喜欢 鱼 宠物\n狗 喜欢 肉 宠物\n猫 狗 可爱 宠物\n鱼 肉 食物\n苹果 香蕉 水果\n苹果 水果 甜\n香蕉 水果 甜`;
const esc = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const fmt = value => Number(value).toFixed(4);
const algorithmNames = { skipgram: 'Skip-gram + 负采样', cbow: 'CBOW + 负采样', glove: 'GloVe 稀疏共现' };
const state = { corpus: defaultCorpus, algorithm: 'skipgram', dimensions: 8, windowSize: 2, negativeSamples: 3, epochs: 30, learningRate: 0.05, seed: 42, minCount: 1, model: null, runConfig: null, baseline: null, selectedWord: '', queryWord: '', analogyWords: ['', '', ''], selectedTrace: 0, status: 'idle', backend: '', message: '', runId: 0 };

function lossChart(model, baseline) {
  if (!model) return '<div class="embedding-empty"><strong>训练尚未开始</strong><span>三种算法都会生成真实损失与向量。</span></div>';
  const curves = [model, baseline?.model].filter(Boolean);
  const maxEpoch = Math.max(...curves.map(item => item.losses.length));
  const min = Math.min(...curves.flatMap(item => item.losses));
  const max = Math.max(...curves.flatMap(item => item.losses));
  const span = Math.max(max - min, 1e-9);
  const path = losses => losses.map((loss, i) => `${i ? 'L' : 'M'}${(42 + i / Math.max(1, maxEpoch - 1) * 438).toFixed(1)},${(175 - (loss - min) / span * 135).toFixed(1)}`).join(' ');
  return `<svg class="embedding-loss" viewBox="0 0 500 210" role="img" aria-label="训练损失曲线"><line x1="42" y1="40" x2="42" y2="175" stroke="#adc0c9"/><line x1="42" y1="175" x2="480" y2="175" stroke="#adc0c9"/><text x="3" y="43">${fmt(max)}</text><text x="3" y="176">${fmt(min)}</text>${baseline ? `<path d="${path(baseline.model.losses)}" fill="none" stroke="#a7864d" stroke-width="2"/>` : ''}<path d="${path(model.losses)}" fill="none" stroke="#087f8c" stroke-width="3"/><text x="42" y="198">1</text><text x="450" y="198">${maxEpoch} 轮</text></svg><div class="chart-key"><span><i class="key-current"></i>当前 B · ${esc(algorithmNames[model.algorithm])}</span>${baseline ? `<span><i class="key-base"></i>基线 A · ${esc(algorithmNames[baseline.model.algorithm])}</span>` : ''}</div>`;
}

function projectionSvg(model) {
  if (!model) return '';
  const projection = pca2d(model.vectors);
  const xs = projection.points.map(point => point[0]), ys = projection.points.map(point => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const x = value => 30 + (value - minX) / (maxX - minX || 1) * 440;
  const y = value => 250 - (value - minY) / (maxY - minY || 1) * 220;
  return `<svg class="embedding-map" viewBox="0 0 500 280" role="img" aria-label="真实词向量的 PCA 二维投影">${projection.points.map((point, i) => { const selected = model.words[i] === state.selectedWord; return `<g class="word-point ${selected ? 'selected' : ''}" data-word="${esc(model.words[i])}" tabindex="0" role="button" aria-label="选择 ${esc(model.words[i])}"><circle cx="${x(point[0])}" cy="${y(point[1])}" r="${selected ? 7 : 5}"/><text x="${x(point[0]) + 8}" y="${y(point[1]) + 4}">${esc(model.words[i])}</text></g>`; }).join('')}<line x1="25" y1="260" x2="480" y2="260" stroke="#cbd8e0"/><text x="430" y="275">PC1</text><text x="4" y="15">PC2</text></svg><p class="chart-foot">PCA 坐标由当前高维向量计算；二维距离只是原空间的线性投影。显示 ${model.words.length} / ${model.words.length} 个词。</p>`;
}

function queryPanel() {
  if (!state.model) return '<p class="subtle">训练完成后可查询原空间余弦相似度。</p>';
  const word = state.queryWord && state.model.words.includes(state.queryWord) ? state.queryWord : state.model.words[0];
  const neighbors = nearest(state.model, word, Math.min(6, state.model.words.length - 1));
  const [a, b, c] = state.analogyWords;
  let analogyResult = [];
  if ([a, b, c].every(item => state.model.words.includes(item))) analogyResult = analogy(state.model, a, b, c, Math.min(4, state.model.words.length - 3));
  return `<div class="embedding-query"><label>查询词<select id="embedding-query-word">${state.model.words.map(item => `<option ${item === word ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label><div class="neighbor-list">${neighbors.map(item => `<button data-select-word="${esc(item.word)}"><b>${esc(item.word)}</b><span>${fmt(item.similarity)}</span><i style="--similarity:${Math.max(0, item.similarity)}"></i></button>`).join('')}</div><div class="analogy-box"><strong>类比 a − b + c</strong><div>${[0, 1, 2].map((index) => `<select data-analogy="${index}"><option value="">选择词</option>${state.model.words.map(item => `<option ${item === state.analogyWords[index] ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select>`).join('<span>−</span>')}</div>${analogyResult.length ? `<p>${analogyResult.map(item => `${esc(item.word)} (${fmt(item.similarity)})`).join(' · ')}</p>` : '<p>选择三个词后按原始向量检索；小语料不保证经典语义关系。</p>'}</div></div>`;
}

function tracePanel() {
  if (!state.model) return '<p class="subtle">训练后显示前 200 个窗口或共现条目。</p>';
  const trace = state.model.traceSource;
  const entry = trace[Math.min(state.selectedTrace, trace.length - 1)];
  if (!entry) return '<p class="subtle">没有追踪条目。</p>';
  const isGlove = state.model.algorithm === 'glove';
  const label = isGlove ? `${state.model.words[entry.i]} ↔ ${state.model.words[entry.j]}` : state.model.algorithm === 'cbow' ? `[${entry.context.map(i => state.model.words[i]).join(', ')}] → ${state.model.words[entry.target]}` : `${state.model.words[entry.center]} → ${state.model.words[entry.context]}`;
  const detail = isGlove ? `共现值 Xᵢⱼ = ${fmt(entry.value)}；训练目标逼近 log(Xᵢⱼ)` : state.model.algorithm === 'cbow' ? '上下文输入向量取平均，预测中心词；负例来自词频的 0.75 次幂分布。' : `中心词输入向量预测上下文词；窗口距离 ${entry.distance}；负例来自词频的 0.75 次幂分布。`;
  return `<div class="embedding-trace"><label>训练条目 <input id="embedding-trace" type="range" min="0" max="${trace.length - 1}" value="${Math.min(state.selectedTrace, trace.length - 1)}"><span>${Math.min(state.selectedTrace, trace.length - 1) + 1} / ${trace.length}</span></label><div class="trace-card"><span>${isGlove ? 'SPARSE COOCCURRENCE' : state.model.algorithm === 'cbow' ? 'CONTEXT → CENTER' : 'CENTER → CONTEXT'}</span><strong>${esc(label)}</strong><p>${esc(detail)}</p></div></div>`;
}

export function embeddingsView() {
  const model = state.model;
  const configChanged = state.status === 'stale';
  return `<div class="page-title"><div><div class="eyebrow">MODULE 01 / REPRESENTATION LEARNING</div><h1>词向量 <span>训练与空间</span></h1><p>从语料窗口到向量更新，再回到相似度与二维投影。</p></div><button class="btn secondary" id="embedding-reset">重置案例</button></div><div class="embedding-layout"><section class="panel embedding-config"><div class="panel-heading"><span class="eyebrow">01 / CORPUS & TRAINING</span><h2>语料与参数</h2><p>空格分 Token，换行分句。训练只使用这里的实际语料。</p></div><form id="embedding-form"><label>训练语料<textarea id="embedding-corpus" rows="10">${esc(state.corpus)}</textarea></label><label class="file-label">导入 UTF-8 文本<input id="embedding-file" type="file" accept=".txt,text/plain"></label><label>算法<select id="embedding-algorithm"><option value="skipgram" ${state.algorithm === 'skipgram' ? 'selected' : ''}>Skip-gram</option><option value="cbow" ${state.algorithm === 'cbow' ? 'selected' : ''}>CBOW</option><option value="glove" ${state.algorithm === 'glove' ? 'selected' : ''}>GloVe</option></select></label><div class="form-grid"><label>窗口<input id="embedding-window" type="number" min="1" max="10" value="${state.windowSize}"></label><label>维度<input id="embedding-dimensions" type="number" min="2" max="64" value="${state.dimensions}"></label><label id="negative-label">负样本<input id="embedding-negative" type="number" min="0" max="20" value="${state.negativeSamples}" ${state.algorithm === 'glove' ? 'disabled' : ''}></label><label>轮数<input id="embedding-epochs" type="number" min="1" max="500" value="${state.epochs}"></label><label>学习率<input id="embedding-lr" type="number" min="0.001" max="1" step="0.001" value="${state.learningRate}"></label><label>随机种子<input id="embedding-seed" type="number" step="1" value="${state.seed}"></label></div><p class="form-note">Word2Vec 区分输入/输出向量并用负采样；GloVe 只存非零共现项并用 AdaGrad。页面查询使用两套向量之和。</p><button class="btn primary run-button" id="embedding-run" type="submit">开始训练 <span>→</span></button><button class="btn secondary" id="embedding-cancel" type="button" disabled>取消当前训练</button><div id="embedding-status" class="run-status ${state.status}" role="status">${esc(state.message || ({ idle: '尚未训练', running: '正在 Worker 中训练', completed: `完成 · ${state.backend === 'blob-worker' ? 'Worker' : '主线程'}`, stale: '参数已变化，请重新训练', cancelled: '已取消', failed: '训练失败' })[state.status])}</div></form></section><section class="panel embedding-main"><div class="result-top"><div><div class="eyebrow">VECTOR SPACE / PCA</div><h2>当前向量空间</h2></div>${model ? `<div class="result-tally"><strong>${model.words.length} × ${model.dimensions}</strong><span>词表 × 维度</span></div>` : ''}</div>${projectionSvg(model)}</section><aside class="panel embedding-side"><div class="inspector-head"><span class="eyebrow">02 / ORIGINAL SPACE</span><h2>邻居与类比</h2><p>分数在高维原始向量上计算。</p></div><div class="embedding-side-body">${queryPanel()}</div></aside></div><section class="embedding-lower"><div class="panel embedding-loss-panel"><div class="panel-heading"><span class="eyebrow">TRAINING LOSS</span><h2>真实目标函数</h2><p>${model ? `${esc(algorithmNames[model.algorithm])} · 初始 ${fmt(model.losses[0])} → 最终 ${fmt(model.losses.at(-1))}` : '每一点来自一次完整训练轮次。'}</p></div>${lossChart(model, state.baseline)}</div><div class="panel embedding-trace-panel"><div class="panel-heading"><span class="eyebrow">COMPUTATION MICROSCOPE</span><h2>窗口与共现检查器</h2><p>查看训练数据怎样由语料产生。</p></div>${tracePanel()}</div></section><section class="lower-grid"><div class="panel compare-panel"><div class="panel-heading"><span class="eyebrow">CONTROLLED COMPARISON</span><h2>固定向量快照 A</h2><p>固定当前模型，修改一个训练因素后生成 B；损失曲线共享坐标。</p></div><div class="compare-actions"><button class="btn secondary" id="embedding-freeze" ${!model || configChanged ? 'disabled' : ''}>固定当前为 A</button><button class="btn text-button" id="embedding-clear" ${!state.baseline ? 'disabled' : ''}>清除 A</button></div><div class="compare-details">${state.baseline ? `A: ${esc(algorithmNames[state.baseline.model.algorithm])} · 窗口 ${state.baseline.config.windowSize} · ${state.baseline.model.dimensions} 维 · 种子 ${state.baseline.config.seed}。${model?.words.join('|') === state.baseline.model.words.join('|') && model?.dimensions === state.baseline.model.dimensions ? `当前词“${esc(state.selectedWord || model.words[0])}”跨快照余弦：${fmt(cosine(state.baseline.model.vectors[state.baseline.model.words.indexOf(state.selectedWord || model.words[0])], model.vectors[model.words.indexOf(state.selectedWord || model.words[0])]))}` : '词表或维度不兼容，不计算跨快照余弦。'}` : '还没有基线。'}</div></div><div class="panel records-panel"><div class="panel-heading"><span class="eyebrow">EXPORT</span><h2>导出模型与结果</h2><p>JSON 含词表、参数和实际向量；CSV 用于分析。</p></div><div class="record-actions"><button class="btn secondary" id="embedding-json" ${!model ? 'disabled' : ''}>JSON</button><button class="btn secondary" id="embedding-csv" ${!model ? 'disabled' : ''}>CSV</button><button class="btn secondary" id="embedding-md" ${!model ? 'disabled' : ''}>Markdown</button></div></div></section>`;
}

function readForm() {
  return { corpus: document.querySelector('#embedding-corpus').value, algorithm: document.querySelector('#embedding-algorithm').value, dimensions: Number(document.querySelector('#embedding-dimensions').value), windowSize: Number(document.querySelector('#embedding-window').value), negativeSamples: Number(document.querySelector('#embedding-negative').value), epochs: Number(document.querySelector('#embedding-epochs').value), learningRate: Number(document.querySelector('#embedding-lr').value), seed: Number(document.querySelector('#embedding-seed').value), minCount: 1 };
}

function exportModel(kind) {
  const record = { schemaVersion: 1, module: 'M01', algorithmVersion: EMBEDDING_VERSION, createdAt: new Date().toISOString(), config: state.runConfig, corpusFingerprint: fingerprint(state.runConfig.corpus), model: state.model, backend: state.backend, warning: 'Vectors were trained only on the included small corpus.' };
  const csv = [['word', 'count', ...Array.from({ length: state.model.dimensions }, (_, i) => `d${i + 1}`)], ...state.model.words.map((word, i) => [word, state.model.counts[i], ...state.model.vectors[i]])].map(row => row.map(csvCell).join(',')).join('\r\n');
  const markdown = `# 词向量实验\n\n- 算法：${algorithmNames[state.model.algorithm]}\n- 版本：${EMBEDDING_VERSION}\n- 语料指纹：${record.corpusFingerprint}\n- 词表：${state.model.words.length}\n- 维度：${state.model.dimensions}\n- 窗口：${state.runConfig.windowSize}\n- 轮数：${state.runConfig.epochs}\n- 种子：${state.runConfig.seed}\n- 初始/最终损失：${state.model.losses[0]} / ${state.model.losses.at(-1)}\n- 后端：${state.backend}\n\n这些向量仅由导出记录中的小语料训练，不代表预训练语义模型。\n`;
  downloadText(`tensorscope-embeddings-${record.corpusFingerprint}.${kind}`, kind === 'json' ? JSON.stringify(record, null, 2) : kind === 'csv' ? csv : markdown, kind === 'json' ? 'application/json' : 'text/plain');
}

export function bindEmbeddings(render) {
  const markStale = () => { Object.assign(state, readForm()); if (state.model) { state.status = 'stale'; const el = document.querySelector('#embedding-status'); el.textContent = '参数已变化，请重新训练'; el.className = 'run-status stale'; document.querySelector('#embedding-freeze').disabled = true; } };
  ['#embedding-corpus', '#embedding-algorithm', '#embedding-window', '#embedding-dimensions', '#embedding-negative', '#embedding-epochs', '#embedding-lr', '#embedding-seed'].forEach(selector => document.querySelector(selector).addEventListener('input', () => { if (selector === '#embedding-algorithm') document.querySelector('#embedding-negative').disabled = document.querySelector(selector).value === 'glove'; markStale(); }));
  document.querySelector('#embedding-file').onchange = async event => { const file = event.target.files[0]; if (!file) return; if (file.size > 2_000_000) { state.message = '文件超过 2 MB'; state.status = 'failed'; render(); return; } document.querySelector('#embedding-corpus').value = await file.text(); markStale(); };
  document.querySelector('#embedding-form').onsubmit = async event => {
    event.preventDefault();
    const runId = ++state.runId;
    const config = readForm(); Object.assign(state, config); state.status = 'running'; state.message = '';
    document.querySelector('#embedding-status').textContent = '正在 Worker 中训练'; document.querySelector('#embedding-cancel').disabled = false;
    try {
      const response = await computeEmbeddings(config, runId);
      if (runId !== state.runId) return;
      state.model = response.result; state.runConfig = config; state.backend = response.backend; state.selectedWord = state.model.words[0]; state.queryWord = state.model.words[0]; state.analogyWords = ['', '', '']; state.selectedTrace = 0; state.status = 'completed'; render();
    } catch (error) { if (runId !== state.runId) return; state.status = error.message === '已取消' ? 'cancelled' : 'failed'; state.message = error.message || String(error); render(); }
  };
  document.querySelector('#embedding-cancel').onclick = () => { state.runId++; cancelEmbeddings(); state.status = 'cancelled'; state.message = '已取消当前训练'; render(); };
  document.querySelector('#embedding-reset').onclick = () => { cancelEmbeddings(); state.runId++; Object.assign(state, { corpus: defaultCorpus, algorithm: 'skipgram', dimensions: 8, windowSize: 2, negativeSamples: 3, epochs: 30, learningRate: 0.05, seed: 42, model: null, runConfig: null, baseline: null, selectedWord: '', queryWord: '', analogyWords: ['', '', ''], selectedTrace: 0, status: 'idle', message: '' }); render(); };
  document.querySelectorAll('[data-word], [data-select-word]').forEach(element => element.onclick = () => { state.selectedWord = element.dataset.word || element.dataset.selectWord; state.queryWord = state.selectedWord; render(); });
  document.querySelector('#embedding-query-word')?.addEventListener('change', event => { state.queryWord = event.target.value; state.selectedWord = event.target.value; render(); });
  document.querySelectorAll('[data-analogy]').forEach(select => select.onchange = event => { state.analogyWords[Number(event.target.dataset.analogy)] = event.target.value; render(); });
  document.querySelector('#embedding-trace')?.addEventListener('input', event => { state.selectedTrace = Number(event.target.value); render(); });
  document.querySelector('#embedding-freeze').onclick = () => { state.baseline = { model: structuredClone(state.model), config: structuredClone(state.runConfig) }; render(); };
  document.querySelector('#embedding-clear').onclick = () => { state.baseline = null; render(); };
  for (const kind of ['json', 'csv', 'md']) document.querySelector(`#embedding-${kind}`).onclick = () => exportModel(kind);
}

export function leaveEmbeddings() { cancelEmbeddings(); state.runId++; }
