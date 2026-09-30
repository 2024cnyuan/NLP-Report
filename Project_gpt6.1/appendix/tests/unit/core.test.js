import { describe, it, expect } from '../../../tools/testing/vitest.js';
import { softmax, crossEntropy, cosine, dot, rng, pca, Tape, norm } from '../../../src/core/math.js';
import { attention, teachingVectors } from '../../../src/algorithms/attention.js';
import { logistic, optimize } from '../../../src/algorithms/optimization.js';
import { consume } from '../../../src/runtime/tasks.js';

describe('数值核心', () => {
  it('稳定 softmax 与 natural-log CE', () => { expect(softmax([1, 2, 3])[2]).toBeCloseTo(0.66524096, 7); expect(softmax([1000, 1001, 1002])).toEqual(softmax([1, 2, 3]).map(v => expect.closeTo(v, 10))); expect(crossEntropy([Math.log(0.8), Math.log(0.2)], 0)).toBeCloseTo(0.22314355, 7); });
  it('余弦、零向量、形状', () => { expect(cosine([1, 0], [1, 1])).toBeCloseTo(Math.SQRT1_2); expect(cosine([0, 0], [1, 1])).toBe(0); expect(() => dot([1], [1, 2])).toThrow(); });
  it('随机重复性和 PCA', () => { const a = rng(42), b = rng(42); expect(Array.from({ length: 100 }, a)).toEqual(Array.from({ length: 100 }, b)); const r = pca([[1, 0], [2, 0], [3, 0]]); expect(Math.abs(r.points[2][0] - r.points[0][0])).toBeCloseTo(2); });
  it('独立导数检验', () => { const t = new Tape(), x = t.v(0.7), y = t.tanh(t.mul(x, x)); t.backward(y); expect(x.grad).toBeCloseTo(1.4 * (1 - Math.tanh(0.49) ** 2), 10); });
  it('极小梯度范数不因平方而下溢，极大向量不溢出',()=>{expect(norm([1e-200,0])).toBe(1e-200);expect(norm([1e200,0])).toBe(1e200);});
});
describe('注意力', () => {
  it('手算点积、输出与缩放', () => { const config = { Q: [[1, 0]], K: [[1, 0], [0, 1]], V: [[2, 0], [0, 4]], method: 'dot' }; const r = attention(config); expect(r.scores).toEqual([[1, 0]]); expect(r.weights[0][0]).toBeCloseTo(1 / (1 + Math.exp(-1))); expect(r.output[0][1]).toBeCloseTo(4 / (1 + Math.exp(1))); expect(attention({ ...config, method: 'scaled' }).scores[0][0]).toBeCloseTo(Math.SQRT1_2); });
  it('手算加性', () => { const r = attention({ Q: [[1]], K: [[2], [0]], V: [[4], [1]], method: 'additive', additive: { Wq: [[2]], Wk: [[3]], b: [0.5], v: [0.7] } }); expect(r.scores[0][0]).toBeCloseTo(0.7 * Math.tanh(8.5)); expect(r.scores[0][1]).toBeCloseTo(0.7 * Math.tanh(2.5)); });
  it('mask、整行无效、极大分数和形状', () => { const c = { Q: [[100]], K: [[100], [99]], V: [[1], [2]], method: 'dot', mask: [[false, true]] }; expect(attention(c).weights).toEqual([[1, 0]]); expect(() => attention({ ...c, mask: [[true, true]] })).toThrow('整行'); expect(() => attention({ ...c, Q: [[1, 2]] })).toThrow('维度'); });
  it('长输入全量计算与教学映射稳定', () => { const v = teachingVectors(Array.from({ length: 256 }, (_, i) => `t${i}`), 32); const r = attention({ Q: v, K: v, V: v }); expect(r.weights).toHaveLength(256); expect(r.weights[50].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12); expect(teachingVectors(['语言'])).toEqual(teachingVectors(['语言'])); });
});
describe('Logistic 真实优化', () => {
  it('单步手算和有限差分', async () => { const data = [{ x: [2, 1], y: 1 }]; expect(logistic([0, 0], data).gradient).toEqual([-1, -0.5]); const r = await consume(optimize({ data, lr: 0.1, steps: 1, batch: 1 })); expect(r.w).toEqual([0.1, 0.05]); const w = [0.3, -0.4], eps = 1e-6; for (let i = 0; i < 2; i++) { const a = [...w], b = [...w]; a[i] += eps; b[i] -= eps; expect(logistic(w).gradient[i]).toBeCloseTo((logistic(a).loss - logistic(b).loss) / (2 * eps), 6); } });
  it('正常、慢收敛和大步长振荡由日志产生', async () => { const good = await consume(optimize({ lr: 0.1, steps: 100 })), slow = await consume(optimize({ lr: 0.001, steps: 100 })), high = await consume(optimize({ lr: 8, steps: 100 })); expect(good.history.at(-1).loss).toBeLessThan(slow.history.at(-1).loss); expect(Math.max(...high.history.map(h => h.loss))).toBeGreaterThan(2); expect(high.history.slice(-10).some((h, i, a) => i && h.loss > a[i - 1].loss)).toBe(true); });
});
