import { teachingVectors } from '../algorithms/attention.js';
import { fingerprint, sum } from '../core/math.js';
import { store, record } from '../data/store.js';
import { run } from '../runtime/client.js';
import { panel, field, select, number, button, note, fmt, escapeHTML, inspect, safe, notify, getNumber } from '../components/ui.js';
import { matrixHTML, legend, barsHTML } from '../viz/charts.js';

const initial = { source: '我 喜欢 自然 语言 处理', target: '理解 语言 的 关系', method: 'scaled', dim: 4, seed: 42, mask: [] };
export async function mountAttention(root, context) {
  const config = store.configs.attention ?? structuredClone(initial);
  let current = store.results.attention, selected = [0, 0], editMask = false, page = [0, 0];
  const tokens = text => text.trim().split(/\s+/).filter(Boolean);
  root.innerHTML = `<div class="lab-layout"><section class="controls panel"><div class="control-heading"><span class="eyebrow">EXPERIMENT SETUP</span><h2>定义这一次关注</h2></div>${field('源序列 · Key / Value', `<textarea id="source" rows="3">${escapeHTML(config.source)}</textarea>`, '空格预分词，单字或完整词均可；最多 1024 Token。')}${field('目标序列 · Query', `<textarea id="target" rows="2">${escapeHTML(config.target)}</textarea>`)}${field('打分方式', select('method', [['scaled', '缩放点积 · q·k / √d'], ['dot', '普通点积 · q·k'], ['additive', '加性 · vᵀ tanh(Wq·q + Wk·k)']], config.method))}${field('教学向量维度', number('dim', config.dim, 2, 64), '按 Token 哈希生成固定向量；同一词始终映射到同一向量。')}${button('计算注意力', 'attention-run', 'primary full', 'play')}<div class="divider"></div><h3>受控干预</h3>${button('编辑掩码', 'mask-edit', 'full', 'attention')}<p class="small">打开后点击热力格子，屏蔽或恢复对应连接。整行屏蔽会拒绝计算。</p>${button('清空掩码', 'mask-clear', 'full', 'reset')}<details><summary>显式 Q / K / V</summary><p class="small">可直接编辑有限数值矩阵 JSON。空白使用 Token 的教学向量。</p>${field('Q 矩阵', '<textarea id="explicit-q" rows="3" placeholder="[[1,0],[0,1]]"></textarea>')}${field('K 矩阵', '<textarea id="explicit-k" rows="3"></textarea>')}${field('V 矩阵', '<textarea id="explicit-v" rows="3"></textarea>')}</details>${note('教学向量只解释计算过程，未经过翻译训练；热力图不代表真实翻译对齐。')}</section><div class="workspace"><div class="flow-strip"><span class="flow-active">01 向量映射</span><i>→</i><span>02 相似度打分</span><i>→</i><span>03 Softmax</span><i>→</i><span>04 加权输出</span></div><div id="attention-result"></div></div></div>`;
  const resultRoot = root.querySelector('#attention-result');
  function inspectCell(i, j) {
    selected = [i, j]; const r = current.result;
    const formula = config.method === 'additive' ? 'sᵢⱼ = vₐᵀ tanh(Wq qᵢ + Wk kⱼ + b)；Aᵢⱼ = exp(sᵢⱼ − logΣexp(sᵢ))' : `sᵢⱼ = qᵢ·kⱼ${config.method === 'scaled' ? ' / √d' : ''}；Aᵢⱼ = exp(sᵢⱼ − logΣexp(sᵢ))`;
    inspect({ title: `${current.target[i]} → ${current.source[j]}`, value: r.weights[i][j], formula, inputs: { q: r.Q[i], k: r.K[j], score: Number.isFinite(r.scores[i][j]) ? r.scores[i][j] : '−Infinity（已屏蔽）', rowScores: r.scores[i].map(v => Number.isFinite(v) ? v : '−Infinity'), additive: config.method === 'additive' ? r.additive : undefined }, shape: `A[${i}, ${j}] · ${r.weights.length}×${r.weights[0].length}`, source: `Token → 固定教学映射或显式向量 → ${config.method} → mask → stable softmax`, detail: `当前行概率和 ${fmt(sum(r.weights[i]), 8)}；权重参与 O[${i}] = Σⱼ A[${i},j]V[j]。` });
    draw();
  }
  function draw() {
    if (!current) return;
    const r = current.result, i = Math.min(selected[0], r.weights.length - 1), baseline = store.baselines.attention;
    const compatible = baseline && baseline.result.result.weights.length === r.weights.length && baseline.result.result.weights[0].length === r.weights[0].length;
    resultRoot.innerHTML = `${panel('注意力权重', '每一行是一份关注分布：目标 Token 如何分配给源 Token。', `<div class="matrix-stage">${matrixHTML(r.weights, { rows: current.target, cols: current.source, probability: true, selected, mask: r.mask, offsetRow: page[0], offsetCol: page[1] })}</div>${legend()}<div class="matrix-footer"><span>${r.weights.length} Query × ${r.weights[0].length} Key · 完整计算 / 分块展示</span>${button('上一块', 'matrix-prev', 'compact')}${button('下一块', 'matrix-next', 'compact')}${button('重置视图', 'matrix-reset', 'compact', 'reset')}</div>`, `<span class="badge">${config.method === 'additive' ? 'ADDITIVE' : config.method === 'scaled' ? 'SCALED DOT' : 'DOT PRODUCT'}</span>`)}<div class="two-col">${panel(`Query ${i + 1} · ${escapeHTML(current.target[i])}`, '点击分布条，同步查看该连接的真实分数。', barsHTML(r.weights[i], current.source, { selected: selected[1], id: 'attn-bars' }))}${panel('加权输出 · O = AV', `${r.output.length}×${r.output[0].length} · 源 Value 的加权和`, matrixHTML([r.output[i]], { rows: [current.target[i]], id: 'attn-output', maxCols: 8 }), `<span class="badge quiet">行和 ${fmt(sum(r.weights[i]), 6)}</span>`)}</div><details class="panel details-panel"><summary>查看 Q、K、V 与原始打分</summary><div class="two-col">${panel('Query · Q', '', matrixHTML(r.Q, { rows: current.target, id: 'q-table', maxCols: 8 }))}${panel('Key · K', '', matrixHTML(r.K, { rows: current.source, id: 'k-table', maxCols: 8 }))}${panel('Value · V', '', matrixHTML(r.V, { rows: current.source, id: 'v-table', maxCols: 8 }))}${panel('Score · mask 之后', '', matrixHTML(r.scores.map(row => row.map(v => Number.isFinite(v) ? v : 0)), { rows: current.target, cols: current.source, mask: r.mask, id: 'score-table' }))}</div></details>${baseline ? panel('A / B · 受控对照', `A ${baseline.fingerprint} → B ${fingerprint(current.config)} · ${compatible ? '差值 B−A，共享概率色域 [0,1]' : '形状不兼容；并列查看，不强行相减'}`, `<div class="comparison-meta">${escapeHTML(context.configDiff(baseline.config, current.config))}</div>${compatible ? `<div class="two-col"><div><h3>A · 固定基线</h3>${matrixHTML(baseline.result.result.weights, { rows: baseline.result.target, cols: baseline.result.source, probability: true, id: 'baseline-matrix' })}</div><div><h3>Δ · B − A</h3>${matrixHTML(r.weights.map((row, i) => row.map((v, j) => v - baseline.result.result.weights[i][j])), { rows: current.target, cols: current.source, domain: 1, id: 'diff-matrix' })}</div></div>` : '<p>序列长度或维度发生变化，请重新固定匹配的基线。</p>'}`) : ''}`;
    resultRoot.querySelectorAll('#matrix .matrix-cell').forEach(el => el.onclick = safe(async () => {
      const i = +el.dataset.row, j = +el.dataset.col;
      if (editMask) { config.mask[i] ??= []; config.mask[i][j] = !config.mask[i][j]; await execute(); } else inspectCell(i, j);
    }));
    resultRoot.querySelectorAll('#attn-bars .bar-row').forEach(el => el.onclick = () => inspectCell(i, +el.dataset.index));
    resultRoot.querySelectorAll('#attn-output .matrix-cell').forEach(el => el.onclick = () => { const j = +el.dataset.col; inspect({ title: `加权输出 O[${i},${j}]`, value: r.output[i][j], formula: 'Oᵢd = Σⱼ Aᵢⱼ Vⱼd', inputs: { weights: r.weights[i], values: r.V.map(v => v[j]), terms: r.weights[i].map((w, k) => w * r.V[k][j]) }, shape: `O · ${r.output.length}×${r.output[0].length}`, source: '注意力权重行 → Value 对应维度 → 逐项乘加' }); });
    const nextPage = () => { page[1] += 16; if (page[1] >= r.weights[0].length) { page[1] = 0; page[0] = (page[0] + 16) % (Math.ceil(r.weights.length / 16) * 16); } draw(); };
    resultRoot.querySelector('#matrix-next').onclick = nextPage;
    resultRoot.querySelector('#matrix-prev').onclick = () => { page[1] = Math.max(0, page[1] - 16); if (page[1] === 0) page[0] = Math.max(0, page[0] - 16); draw(); };
    resultRoot.querySelector('#matrix-reset').onclick = () => { page = [0, 0]; draw(); };
  }
  async function execute() {
    config.source = root.querySelector('#source').value; config.target = root.querySelector('#target').value; config.method = root.querySelector('#method').value; config.dim = getNumber('dim');
    const source = tokens(config.source), target = tokens(config.target);
    if (!source.length || !target.length) throw new Error('源序列与目标序列不能为空');
    if (source.length > 1024 || target.length > 1024) throw new Error('最多 1024 Token；请自行分段，不会静默截断');
    const explicit = id => root.querySelector(id).value.trim() ? JSON.parse(root.querySelector(id).value) : null;
    const Q = explicit('#explicit-q') ?? teachingVectors(target, config.dim), K = explicit('#explicit-k') ?? teachingVectors(source, config.dim), V = explicit('#explicit-v') ?? teachingVectors(source, config.dim);
    if (Q.length !== target.length || K.length !== source.length || V.length !== source.length) throw new Error('显式矩阵行数必须匹配对应 Token 数');
    config.Q = Q; config.K = K; config.V = V;
    const result = await run('attention', { Q, K, V, method: config.method, mask: config.mask });
    current = { result, config: structuredClone(config), source, target }; store.configs.attention = structuredClone(config); store.results.attention = current;
    selected = [0, 0]; page = [0, 0]; context.setExperiment(config, current, draw); context.setStatus('completed'); draw();
  }
  root.querySelector('#attention-run').onclick = safe(execute);
  root.querySelector('#mask-edit').onclick = e => { editMask = !editMask; e.currentTarget.classList.toggle('active', editMask); e.currentTarget.querySelector('span').textContent = editMask ? '掩码编辑中 · 点击格子' : '编辑掩码'; };
  root.querySelector('#mask-clear').onclick = safe(async () => { config.mask = []; await execute(); });
  root.querySelectorAll('input,textarea,select').forEach(el => el.addEventListener('input', () => context.setStatus('stale')));
  if (config.Q) root.querySelector('#explicit-q').value = JSON.stringify(config.Q);
  if (config.K) root.querySelector('#explicit-k').value = JSON.stringify(config.K);
  if (config.V) root.querySelector('#explicit-v').value = JSON.stringify(config.V);
  // Explicit saved matrices are replayed; ordinary Token edits regenerate the teaching mapping.
  for (const id of ['source', 'target', 'dim']) root.querySelector(`#${id}`).addEventListener('input', () => { for (const t of ['explicit-q', 'explicit-k', 'explicit-v']) root.querySelector(`#${t}`).value = ''; });
  if (current) { context.setExperiment(current.config, current, draw); draw(); } else await execute();
}
