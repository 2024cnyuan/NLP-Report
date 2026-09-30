export const VERSION = 'tensorscope-1.0.0';
export const sum = a => a.reduce((s, x) => s + x, 0);
export const mean = a => a.length ? sum(a) / a.length : 0;
export const norm = a => Math.hypot(...a);
export function dot(a, b) {
  if (a.length !== b.length) throw new Error('向量维度不匹配');
  return a.reduce((s, x, i) => s + x * b[i], 0);
}
export function cosine(a, b) { const n = norm(a) * norm(b); return n ? dot(a, b) / n : 0; }
export function sigmoid(x) { return x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)); }
export function logsumexp(a) {
  if (!a.length) throw new Error('空分数向量');
  const m = Math.max(...a);
  if (m === -Infinity) throw new Error('整行全部屏蔽：至少保留一个有效位置');
  if (!Number.isFinite(m)) throw new Error('分数包含非有限数值');
  return m + Math.log(sum(a.map(x => Math.exp(x - m))));
}
export function softmax(a) { const l = logsumexp(a); return a.map(x => Math.exp(x - l)); }
export function crossEntropy(logits, y) { return logsumexp(logits) - logits[y]; }
export function rng(seed = 42) {
  let state = seed >>> 0;
  const next = () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  next.state = () => state >>> 0;
  return next;
}
export function shuffle(a, random) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
export function fingerprint(value) {
  const s = JSON.stringify(value); let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function finiteMatrix(a, name = '矩阵') {
  if (!Array.isArray(a) || !a.length || !Array.isArray(a[0]) || !a[0].length || a.length > 1024 || a[0].length > 128) throw new Error(`${name} 形状无效（最多 1024×128）`);
  if (a.some(r => !Array.isArray(r) || r.length !== a[0].length || r.some(x => !Number.isFinite(x)))) throw new Error(`${name} 必须是矩形且所有值有限`);
  return a;
}
export const numericOps = {
  v: x => x, val: x => x, add: (a, b) => a + b, mul: (a, b) => a * b,
  tanh: Math.tanh, sigmoid, relu: x => Math.max(0, x),
};

/** Reverse-mode scalar reference; every network operation shares definitions with numeric inference. */
export class Tape {
  constructor() { this.nodes = []; }
  v(value) { const n = { value, grad: 0, parents: [] }; this.nodes.push(n); return n; }
  node(value, parents) { const n = this.v(value); n.parents = parents; return n; }
  val(a) { return a.value; }
  add(a, b) { return this.node(a.value + b.value, [[a, 1], [b, 1]]); }
  mul(a, b) { return this.node(a.value * b.value, [[a, b.value], [b, a.value]]); }
  tanh(a) { const v = Math.tanh(a.value); return this.node(v, [[a, 1 - v * v]]); }
  sigmoid(a) { const v = sigmoid(a.value); return this.node(v, [[a, v * (1 - v)]]); }
  relu(a) { return this.node(Math.max(0, a.value), [[a, a.value > 0 ? 1 : 0]]); }
  ce(logits, y) { const p = softmax(logits.map(x => x.value)); return this.node(crossEntropy(logits.map(x => x.value), y), logits.map((n, i) => [n, p[i] - Number(i === y)])); }
  backward(loss) { loss.grad = 1; for (let i = this.nodes.length - 1; i >= 0; i--) { const n = this.nodes[i]; for (const [p, d] of n.parents) p.grad += n.grad * d; } }
}

/** Centered PCA, deterministic power iteration and deflation; basis can be reused for A/B. */
export function pca(vectors, basis) {
  if (!vectors.length) return { points: [], basis: null };
  const d = vectors[0].length;
  const center = basis?.center ?? Array.from({ length: d }, (_, j) => mean(vectors.map(v => v[j])));
  const x = vectors.map(v => v.map((v, j) => v - center[j]));
  let axes = basis?.axes;
  if (!axes) {
    const covariance = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => mean(x.map(v => v[i] * v[j]))));
    axes = [];
    for (let k = 0; k < Math.min(d, 2); k++) {
      let v = Array.from({ length: d }, (_, j) => Math.sin((j + 1) * (k + 1.4)));
      for (let t = 0; t < 80; t++) {
        let w = covariance.map(r => dot(r, v));
        for (const axis of axes) { const c = dot(w, axis); w = w.map((a, j) => a - c * axis[j]); }
        const n = norm(w); if (n < 1e-12) { v = Array(d).fill(0); break; } v = w.map(a => a / n);
      }
      axes.push(v);
    }
    if (d === 1) axes.push([0]);
  }
  return { points: x.map(v => axes.map(a => dot(v, a))), basis: { center, axes } };
}
