import { softmax, dot } from './math.js';

export const ALGORITHM_VERSION = 'attention-1.0.0';

/** FNV-1a, used only for a deterministic teaching vector mapping. */
export function tokenVector(token, dimensions = 4) {
  if (!token || !Number.isInteger(dimensions) || dimensions < 2 || dimensions > 32) throw new Error('Token 不能为空，维度需为 2–32');
  const vector = Array(dimensions).fill(0);
  for (const char of [...token]) {
    let hash = 2166136261;
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
    vector[hash % dimensions] += (hash & 256) ? 1 : -1;
  }
  const norm = Math.hypot(...vector);
  return norm ? vector.map(value => value / norm) : vector;
}

export function tokenize(text) {
  const tokens = text.trim().split(/\s+/u).filter(Boolean);
  if (!tokens.length) throw new Error('请至少输入一个 Token，Token 之间用空格分隔');
  if (tokens.length > 128) throw new Error('最多支持 128 个 Token');
  return tokens;
}

export function makeVectors(tokens, dimensions) {
  return tokens.map(token => tokenVector(token, dimensions));
}

export function validateAttention(config) {
  const { queries, keys, values, method, masked = [] } = config;
  if (!['dot', 'scaled', 'additive'].includes(method)) throw new Error('未知注意力打分方式');
  if (!Array.isArray(queries) || !queries.length || !Array.isArray(keys) || !keys.length || !Array.isArray(values) || values.length !== keys.length) throw new Error('Q/K/V 不可为空，K 与 V 长度必须一致');
  if (queries.length > 128 || keys.length > 128) throw new Error('每侧最多 128 个 Token');
  const d = keys[0].length;
  const dv = values[0].length;
  if (d < 2 || d > 32 || dv < 1 || dv > 32 || queries.some(q => q.length !== d) || keys.some(k => k.length !== d) || values.some(v => v.length !== dv)) throw new Error('Q/K/V 形状不兼容');
  if ([...queries, ...keys, ...values].some(vector => vector.some(value => !Number.isFinite(value)))) throw new Error('向量包含非有限数');
  if (masked.some(index => !Number.isInteger(index) || index < 0 || index >= keys.length) || new Set(masked).size !== masked.length) throw new Error('掩码索引无效或重复');
  if (masked.length === keys.length) throw new Error('整行被掩码屏蔽，无法计算注意力');
}

/** Same pure kernel runs on main thread and in the Blob Worker. */
export function attentionKernel(config) {
  const { queries, keys, values, method, masked = [] } = config;
  const d = keys[0].length;
  const allowed = keys.map((_, j) => !masked.includes(j));
  const scores = queries.map(q => keys.map(k => {
    if (method === 'additive') {
      // Wq = Wk = I, b = 0, va = [1/sqrt(d), ...].
      return q.reduce((sum, value, t) => sum + Math.tanh(value + k[t]) / Math.sqrt(d), 0);
    }
    const raw = q.reduce((sum, value, t) => sum + value * k[t], 0);
    return method === 'scaled' ? raw / Math.sqrt(d) : raw;
  }));
  const weights = scores.map(row => {
    const max = Math.max(...row.filter((_, j) => allowed[j]));
    const terms = row.map((score, j) => allowed[j] ? Math.exp(score - max) : 0);
    const total = terms.reduce((a, b) => a + b, 0);
    return terms.map(value => value / total);
  });
  const outputs = weights.map(row => values[0].map((_, t) => row.reduce((sum, weight, j) => sum + weight * values[j][t], 0)));
  return { scores, weights, outputs };
}

export function runAttention(config) {
  validateAttention(config);
  const result = attentionKernel(config);
  result.weights.forEach((row, i) => {
    const expected = softmax(result.scores[i], result.scores[i].map((_, j) => !config.masked?.includes(j)));
    if (row.some((value, j) => Math.abs(value - expected[j]) > 1e-12)) throw new Error('注意力归一化校验失败');
  });
  return result;
}

export function inspectCell(config, result, i, j) {
  const q = config.queries[i];
  const k = config.keys[j];
  const masked = config.masked.includes(j);
  const terms = config.method === 'additive' ? q.map((value, t) => Math.tanh(value + k[t]) / Math.sqrt(q.length)) : q.map((value, t) => value * k[t]);
  const max = Math.max(...result.scores[i].filter((_, index) => !config.masked.includes(index)));
  const exps = result.scores[i].map((score, index) => config.masked.includes(index) ? 0 : Math.exp(score - max));
  return { i, j, q, k, v: config.values[j], masked, terms, score: result.scores[i][j], weight: result.weights[i][j], max, numerator: exps[j], denominator: exps.reduce((a, b) => a + b, 0), contribution: config.values[j].map(value => value * result.weights[i][j]), output: result.outputs[i], dot: dot(q, k) };
}
