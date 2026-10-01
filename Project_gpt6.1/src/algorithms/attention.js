import { finiteMatrix, dot, softmax, rng, fingerprint } from '../core/math.js';

export function teachingVectors(tokens, d = 4) {
  return tokens.map(token => { const r = rng(parseInt(fingerprint(token), 16)); return Array.from({ length: d }, () => +(r() * 2 - 1).toFixed(4)); });
}
export function attention({ Q, K, V, method = 'scaled', mask = [], additive }) {
  finiteMatrix(Q, 'Q'); finiteMatrix(K, 'K'); finiteMatrix(V, 'V');
  if (Q[0].length !== K[0].length || K.length !== V.length) throw new Error('Q/K 特征维度与 K/V 序列长度必须匹配');
  if (!['dot', 'scaled', 'additive'].includes(method)) throw new Error('未知注意力打分');
  const d = Q[0].length;
  const a = additive ?? { Wq: Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => Number(i === j))), Wk: Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => Number(i === j))), b: Array(d).fill(0), v: Array(d).fill(1 / Math.sqrt(d)) };
  if (method === 'additive') {
    finiteMatrix(a.Wq, 'Wq'); finiteMatrix(a.Wk, 'Wk');
    if (a.Wq[0].length !== d || a.Wk[0].length !== d || a.Wq.length !== a.Wk.length || a.v.length !== a.Wq.length || a.b.length !== a.v.length || [...a.v, ...a.b].some(x => !Number.isFinite(x))) throw new Error('加性注意力参数形状错误');
  }
  const rawScores = Q.map(q => K.map(k => {
    if (method === 'additive') return dot(a.v, a.Wq.map((w, t) => Math.tanh(dot(w, q) + dot(a.Wk[t], k) + a.b[t])));
    return dot(q, k) / (method === 'scaled' ? Math.sqrt(d) : 1);
  }));
  const scores = rawScores.map((row, i) => row.map((score, j) => mask[i]?.[j] ? -Infinity : score));
  const weights = scores.map(softmax);
  const output = weights.map(w => Array.from({ length: V[0].length }, (_, d) => w.reduce((s, a, j) => s + a * V[j][d], 0)));
  return { rawScores, scores, weights, output, Q, K, V, additive: a, method, mask };
}
export async function* attentionBatched(config) {
  if (config.Q?.length <= 16) return attention(config);
  const weights=[], scores=[], rawScores=[], output=[]; let result;
  for(let i=0;i<config.Q.length;i+=16){result=attention({...config,Q:config.Q.slice(i,i+16),mask:config.mask?.slice(i,i+16)});weights.push(...result.weights);scores.push(...result.scores);rawScores.push(...result.rawScores);output.push(...result.output);yield{processed:Math.min(i+16,config.Q.length),total:config.Q.length,stage:'按 Query 行分批计算'};}
  return {...result,Q:config.Q,mask:config.mask??[],weights,scores,rawScores,output};
}
