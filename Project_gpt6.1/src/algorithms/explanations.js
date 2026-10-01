import { dot, sum, mean, norm, logsumexp, fingerprint } from '../core/math.js';

// Derive explanations from a completed result, never from unsent UI inputs.
const stage = (id, title, expression, value, inputs, detail = '') => ({ id, title, expression, value, inputs, detail });
const finiteScores = row => row.map(value => Number.isFinite(value) ? value : '−Infinity（已屏蔽）');

export function attentionTrace(current, row = 0, col = 0, dimension = 0) {
  const r = current.result, q = r.Q[row], k = r.K[col], v = r.V[col];
  const method = r.method, blocked = Boolean(r.mask?.[row]?.[col]);
  const products = q.map((value, d) => value * k[d]);
  const affine = method === 'additive' ? r.additive.Wq.map((w, d) => dot(w, q) + dot(r.additive.Wk[d], k) + r.additive.b[d]) : null;
  const rawScore = r.rawScores?.[row]?.[col] ?? (affine ? dot(r.additive.v, affine.map(Math.tanh)) : sum(products) / (method === 'scaled' ? Math.sqrt(q.length) : 1));
  const logZ = logsumexp(r.scores[row]), max = Math.max(...r.scores[row]);
  const expShifted = r.scores[row].map(score => Number.isFinite(score) ? Math.exp(score - max) : 0);
  const terms = r.weights[row].map((weight, j) => weight * r.V[j][dimension]);
  return [
    stage('vectors', '输入向量 Q / K / V', 'Token → 实际参与计算的向量', q, { query: current.target[row], key: current.source[col], q, k, value: v }, '默认哈希教学向量未经训练；显式矩阵使用用户提供的数值。'),
    stage('score', '数学打分', method === 'additive' ? 's = vᵀ tanh(Wq·q + Wk·k + b)' : method === 'scaled' ? 's = Σ(qd × kd) / √d' : 's = Σ(qd × kd)', rawScore, affine ? { q, k, parameters: r.additive, affine, tanh: affine.map(Math.tanh) } : { q, k, products, dot: sum(products), divisor: method === 'scaled' ? Math.sqrt(q.length) : 1 }),
    stage('mask', '应用掩码', '屏蔽 → −∞；保留 → 原分数', blocked ? '−∞' : r.scores[row][col], { blocked, before: rawScore, after: blocked ? '−Infinity' : r.scores[row][col] }),
    stage('softmax', '行归一化权重', 'Aij = exp(sij − max) / Σ exp(sik − max)', r.weights[row][col], { rowScores: finiteScores(r.scores[row]), max, expShifted, denominator: sum(expShifted), logZ, weight: r.weights[row][col], rowSum: sum(r.weights[row]) }, '分母包含整行未屏蔽连接；被屏蔽连接权重为 0。'),
    stage('contribution', '当前连接的贡献', 'Aij × Vjd', terms[col], { dimension: dimension + 1, weight: r.weights[row][col], value: r.V[col][dimension], product: terms[col] }, '单个连接的贡献，不是完整输出。'),
    stage('output', '加权输出', 'Oid = Σj Aij × Vjd', r.output[row][dimension], { dimension: dimension + 1, weights: r.weights[row], values: r.V.map(value => value[dimension]), terms, output: r.output[row][dimension] }, '逐项贡献相加得到输出，图形只展示这些实际数值。'),
  ];
}

function classifierStages(current, selectedClass = current.trace.prediction) {
  const r = current.trace, m = current.model, c = selectedClass;
  const weights = m.weights.C.slice(c * r.pooled.length, (c + 1) * r.pooled.length);
  return [
    stage('logit', '分类层乘加', 'logitc = Σ(Ccd × featured) + bc', r.logits[c], { class: m.classes[c], features: r.pooled, weights, products: weights.map((w, i) => w * r.pooled[i]), bias: m.weights.bC[c], logits: r.logits }),
    stage('prediction', '最终分类输出', 'p = Softmax(logits)；类别 = argmax(p)', r.probabilities[c], { selectedClass: m.classes[c], classes: m.classes, logits: r.logits, probabilities: r.probabilities, prediction: m.classes[r.prediction] }, `正在解释「${m.classes[c]}」的概率；整体预测为「${m.classes[r.prediction]}」。概率未经校准，不等于可靠置信度。`),
  ];
}

export function cnnTrace(current, kernel = 0, position = 0, selectedClass = current.trace.prediction) {
  const r = current.trace, m = current.model, f = r.features[kernel], d = m.structure.dim;
  const window = Array.from({ length: f.width }, (_, i) => r.embedding[position + i] ?? Array(d).fill(0));
  const products = window.flatMap((row, i) => row.map((value, j) => value * f.weights[i * d + j]));
  return [
    stage('embedding', '输入与 Embedding 窗口', 'Token → 查表向量；不足窗口右侧补零', window, { tokens: current.tokens.slice(position, position + f.width), start: position + 1, width: f.width, embedding: window, oov: r.oov }),
    stage('convolution', '逐项卷积乘加', 'zt = Σi,d Kid × Et+i,d + b', f.raw[position], { kernel: f.weights, embedding: window, products, productSum: sum(products), bias: f.bias, raw: f.raw[position] }),
    stage('relu', 'ReLU 激活', 'at = max(0, zt)', f.activations[position], { raw: f.raw[position], activation: f.activations[position] }),
    stage('pool', '最大池化与位置', 'p = max(at)；位置 = argmax(at)', f.value, { activations: f.activations, winner: f.winner + 1, winnerTokens: current.tokens.slice(f.winner, f.winner + f.width), pooled: f.value }, `获胜窗口起点 ${f.winner + 1}；不一定是当前浏览窗口。`),
    ...classifierStages(current, selectedClass),
  ];
}

export function sequenceTrace(current, time = 0, dimension = 0, selectedClass = current.trace.prediction) {
  const r = current.trace, m = current.model, s = r.states[time], j = dimension;
  const formula = m.algorithm === 'LSTM' ? 'h = o ⊙ tanh(c)' : m.algorithm === 'GRU' ? 'h = z ⊙ h前 + (1−z) ⊙ n' : 'h = tanh(Wx + Uh前 + b)';
  const stages = [stage('embedding', '当前输入与前一状态', 'Token → x；读取 h前 / c前', s.x, { time: time + 1, token: s.token, x: s.x, previous: s.previous, previousCell: s.previousCell })];
  if (m.algorithm === 'LSTM') {
    for (const gate of ['i', 'f', 'o', 'g']) {
      const W = m.weights[`W${gate}`].slice(j * m.structure.dim, (j + 1) * m.structure.dim);
      const U = m.weights[`U${gate}`].slice(j * m.structure.hidden, (j + 1) * m.structure.hidden);
      stages.push(stage(`gate-${gate}`, { i: '输入门 i', f: '遗忘门 f', o: '输出门 o', g: '候选值 g' }[gate], `${gate} = ${gate === 'g' ? 'tanh' : 'σ'}(Wx + Uh前 + b)`, s.gates[gate][j], { x: s.x, previous: s.previous, W, U, inputProducts: W.map((w, i) => w * s.x[i]), recurrentProducts: U.map((w, i) => w * s.previous[i]), bias: m.weights[`b${gate}`][j], preactivation: s.preactivations?.[gate]?.[j] ?? dot(W, s.x) + dot(U, s.previous) + m.weights[`b${gate}`][j], activation: s.gates[gate][j] }));
    }
    stages.push(stage('cell', '更新细胞状态 c', 'c = f × c前 + i × g', s.cell[j], { previousCell: s.previousCell[j], f: s.gates.f[j], i: s.gates.i[j], g: s.gates.g[j], retained: s.gates.f[j] * s.previousCell[j], written: s.gates.i[j] * s.gates.g[j], cell: s.cell[j] }));
  } else if (m.algorithm === 'GRU') stages.push(stage('gates', '真实门控 z / r / n', 'z、r = σ(仿射)；n = tanh(Wx + U(r⊙h前) + b)', s.gates.z[j], { gates: s.gates, previous: s.previous }, '采用 reset-before 定义；完整门向量见输入数值。'));
  stages.push(stage('hidden', '当前隐藏状态 h', formula, s.hidden[j], { dimension: j + 1, previous: s.previous, cell: s.cell, gates: s.gates, hidden: s.hidden }, '当前时间步状态；最终分类使用最后一个时间步，不把中间状态冒充最终输出。'));
  stages.push(stage('last-state', '继续递推至末步', '剩余 Token 逐步递推 → 最终完整 h', r.pooled, { selectedStep: time + 1, totalSteps: r.states.length, finalToken: r.states.at(-1).token, finalHidden: r.states.at(-1).hidden, finalCell: r.states.at(-1).cell, classifierInput: r.pooled }, '分类层读取末步完整隐藏向量，不只读取当前选择的状态单元。'));
  stages.push(...classifierStages(current, selectedClass));
  if (r.stateGradients) stages.push(stage('gradient', '最终损失与反向梯度', 'CE = logΣexp(logits) − logit目标；∂CE/∂ht', r.stateGradients[time][j], { target: m.classes[current.target], loss: r.loss, gradientAtTime: r.stateGradients[time], fullGradientNorm: r.gradientNorm }, '梯度来自最终分类损失的反向传播，不是动画或隐状态大小的替代值。'));
  return stages;
}

const same = (a, b) => fingerprint(a) === fingerprint(b);
export function summarizeResult(module, current, baseline = null) {
  if (!current || !['attention', 'cnn', 'sequence'].includes(module)) return null;
  const metrics = [], add = (key, label, value) => metrics.push({ key, label, value });
  let observation, limits, algorithm;
  if (module === 'attention') {
    const r = current.result; algorithm = r.method;
    add('queries', 'Query 数', r.weights.length); add('keys', 'Key 数', r.weights[0].length);
    add('entropy', '平均行熵 · natural log', mean(r.weights.map(row => -sum(row.map(p => p > 0 ? p * Math.log(p) : 0)))));
    add('rowError', '最大行和误差', Math.max(...r.weights.map(row => Math.abs(sum(row) - 1))));
    add('outputNorm', '输出 Frobenius 范数', r.output.reduce((n, row) => Math.hypot(n, norm(row)), 0));
    let masked = 0; for (const row of r.mask ?? []) for (const value of row ?? []) if (value) masked++;
    add('masked', '屏蔽连接数', masked);
    observation = '行熵描述权重的集中程度，行和误差检查归一化；输出范数描述数值尺度。';
    limits = '这些指标不评判翻译或语义质量；默认向量未经训练。';
  } else {
    const r = current.trace, m = current.model; algorithm = m.algorithm;
    add('tokens', 'Token 数', current.tokens.length); add('oov', 'OOV 数', r.oov);
    m.classes.forEach((label, i) => add(`probability-${i}`, `${label}概率 · 未校准`, r.probabilities[i]));
    if (module === 'cnn') {
      add('features', '卷积特征数', r.features.length); add('poolNorm', '池化向量范数', norm(r.pooled));
      let active = 0, total = 0; for (const f of r.features) for (const value of f.activations) { total++; if (value > 0) active++; }
      add('activeRatio', 'ReLU 正激活比例', total ? active / total : 0);
      observation = `预测「${m.classes[r.prediction]}」；池化由各核真实获胜窗口产生，点击计算链可查看位置与乘加。`;
    } else {
      add('hiddenNorm', '末步隐藏状态范数', norm(r.states.at(-1).hidden));
      if (r.states.at(-1).cell) add('cellNorm', '末步细胞状态范数', norm(r.states.at(-1).cell));
      add('loss', `最终 CE · 目标 ${m.classes[current.target]}`, r.loss);
      if (r.stateGradients) {
        add('firstGradient', '首步梯度范数', norm(r.stateGradients[0]));
        add('lastGradient', '末步梯度范数', norm(r.stateGradients.at(-1)));
        add('gradientNorm', '全参数梯度范数', r.gradientNorm);
      }
      observation = `预测「${m.classes[r.prediction]}」；目标类别仅用于损失和梯度计算，不改变前向预测。`;
    }
    limits = `${m.trained ? '使用训练/编辑模型' : '教学初始化未经训练'}；单条输入不能产生 Accuracy/F1，概率未经校准，门值不直接代表语义记忆。`;
  }
  const summary = { schema: 1, module, algorithm, metrics, observation, limits, comparison: null };
  if (baseline) {
    const b = baseline;
    const compatible = module === 'attention'
      ? same(current.source, b.source) && same(current.target, b.target) && current.result.Q[0].length === b.result?.Q?.[0]?.length && current.result.V[0].length === b.result?.V?.[0]?.length
      : same(current.tokens, b.tokens) && same(current.model.classes, b.model?.classes) && current.model.algorithm === b.model?.algorithm && current.model.structure.dim === b.model?.structure.dim && (module === 'sequence' ? current.model.structure.hidden === b.model?.structure.hidden && current.target === b.target : same(current.model.structure.widths, b.model?.structure.widths) && current.model.structure.filters === b.model?.structure.filters);
    const before = summarizeResult(module, baseline);
    summary.comparison = { compatible, reason: compatible ? '输入与比较口径匹配；以下为 B−A 数值变化，不证明因果或模型更优。' : '输入、结构或目标口径不匹配，不作逐项差值；可分别保存后查看。', metrics: compatible ? metrics.flatMap(metric => {
      const a = before.metrics.find(item => item.key === metric.key);
      return a && Number.isFinite(a.value) && Number.isFinite(metric.value) ? [{ ...metric, before: a.value, after: metric.value, delta: metric.value - a.value }] : [];
    }) : [] };
  }
  return summary;
}
