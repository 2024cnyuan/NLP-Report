import { it, expect } from '../../../tools/testing/vitest.js';
import { attention, attentionBatched } from '../../../src/algorithms/attention.js';
import { createNeural, neuralForward } from '../../../src/algorithms/neural.js';
import { attentionTrace, cnnTrace, sequenceTrace, summarizeResult } from '../../../src/algorithms/explanations.js';
import { consume } from '../../../src/runtime/tasks.js';
import { sigmoid, sum } from '../../../src/core/math.js';
import { store, record } from '../../../src/data/store.js';
import { summaryMarkdown, traceNumber } from '../../../src/components/computation.js';
import { validateExperiment } from '../../../src/data/validation.js';

const attentionCurrent = (mask = []) => ({ source: ['a', 'b'], target: ['q'], config: { source: 'a b', target: 'q', method: 'dot', Q: [[1, 0]], K: [[1, 0], [0, 1]], V: [[2, 0], [0, 4]], mask }, result: attention({ Q: [[1, 0]], K: [[1, 0], [0, 1]], V: [[2, 0], [0, 4]], method: 'dot', mask }) });
function cnnCurrent() {
  const model = createNeural({ algorithm: 'CNN', vocab: ['<UNK>', 'a', 'b', 'c'], dim: 1, widths: [2], filters: 1 });
  Object.assign(model.weights, { E: [0, 1, 2, 3], K0_0: [2, -1], bK0_0: [.5], C: [1, -1], bC: [0, 0] });
  const tokens = ['a', 'b', 'c'];
  return { model, tokens, config: { model, tokens, text: 'a b c' }, trace: neuralForward(model, tokens) };
}
function lstmCurrent() {
  const model = createNeural({ algorithm: 'LSTM', vocab: ['<UNK>', 'a'], dim: 1, hidden: 1 });
  model.weights.E = [0, 1];
  for (const gate of ['i', 'f', 'o', 'g']) { model.weights['W' + gate] = [.2]; model.weights['U' + gate] = [0]; model.weights['b' + gate] = [0]; }
  const tokens = ['a', 'a'], target = 1;
  return { model, tokens, target, config: { model, tokens, target, text: 'a a' }, trace: neuralForward(model, tokens, { gradient: true, target }) };
}
const step = (stages, id) => stages.find(s => s.id === id);

it('Attention 完整代入链、masked原分数、softmax与输出独立手算一致', () => {
  const a = attentionCurrent(), b = attentionCurrent([[true, false]]), stages = attentionTrace(a, 0, 0, 1);
  expect(step(stages, 'score').inputs.products).toEqual([1, 0]);
  expect(step(stages, 'softmax').value).toBeCloseTo(1 / (1 + Math.exp(-1)), 12);
  expect(step(stages, 'output').value).toBeCloseTo(4 / (1 + Math.exp(1)), 12);
  expect(sum(step(stages, 'output').inputs.terms)).toBeCloseTo(step(stages, 'output').value, 12);
  const masked = attentionTrace(b, 0, 0, 1);
  expect(step(masked, 'score').value).toBe(1);
  expect(step(masked, 'mask').value).toBe('−∞');
  expect(step(masked, 'softmax').value).toBe(0);
  expect(step(masked, 'output').value).toBe(4);
  expect(b.result.rawScores).toEqual([[1, 0]]);
});

it('Attention 加性及分块轨迹保留全部rawScores且前后数值一致', async () => {
  const config = { Q: Array.from({ length: 20 }, () => [1]), K: [[2], [0]], V: [[4], [1]], method: 'additive', additive: { Wq: [[2]], Wk: [[3]], b: [.5], v: [.7] }, mask: [[true, false]] };
  const numeric = attention(config), batched = await consume(attentionBatched(config));
  expect(batched).toEqual(numeric);
  const s = attentionTrace({ result: batched, target: Array(20).fill('q'), source: ['a', 'b'] });
  expect(step(s, 'score').inputs.affine).toEqual([8.5]);
  expect(step(s, 'score').value).toBeCloseTo(.7 * Math.tanh(8.5), 12);
});

it('CNN 链显示完整乘积/偏置/ReLU/真实winner及全池化分类代入', () => {
  const current = cnnCurrent(), stages = cnnTrace(current, 0, 0);
  expect(step(stages, 'convolution').inputs.products).toEqual([2, -2]);
  expect(step(stages, 'convolution').value).toBe(.5);
  expect(step(stages, 'relu').value).toBe(.5);
  expect(step(stages, 'pool').value).toBe(1.5);
  expect(step(stages, 'pool').inputs.winner).toBe(2);
  expect(step(stages, 'logit').value).toBe(1.5);
  expect(step(stages, 'prediction').value).toBeCloseTo(1 / (1 + Math.exp(-3)), 12);
  const classOne = cnnTrace(current, 0, 0, 1);
  expect(step(classOne, 'logit').value).toBe(-1.5);
  expect(step(classOne, 'prediction').value).toBe(current.trace.probabilities[1]);
  const short = { ...current, tokens: ['a'], trace: neuralForward(current.model, ['a']) };
  expect(step(cnnTrace(short), 'embedding').inputs.embedding).toEqual([[1], [0]]);
  expect(step(cnnTrace(short), 'convolution').value).toBe(2.5);
});

it('LSTM preactivation来自真实前向，四门→c/h→最终损失梯度不变', () => {
  const current = lstmCurrent(), stages = sequenceTrace(current, 1), c1 = sigmoid(.2) * Math.tanh(.2);
  for (const gate of ['i', 'f', 'o', 'g']) {
    expect(step(stages, 'gate-' + gate).inputs.preactivation).toBe(.2);
    expect(step(stages, 'gate-' + gate).value).toBeCloseTo(gate === 'g' ? Math.tanh(.2) : sigmoid(.2), 12);
  }
  expect(step(stages, 'cell').value).toBeCloseTo(sigmoid(.2) * c1 + c1, 12);
  expect(step(stages, 'hidden').value).toBeCloseTo(sigmoid(.2) * Math.tanh(sigmoid(.2) * c1 + c1), 12);
  expect(step(stages, 'gradient').value).toBe(current.trace.stateGradients[1][0]);
  expect(step(sequenceTrace(current, 0), 'last-state').value).toEqual(current.trace.states.at(-1).hidden);
  expect(step(sequenceTrace(current, 1, 0, 0), 'prediction').value).toBe(current.trace.probabilities[0]);
  expect(neuralForward(current.model, current.tokens, { target: 1 }).logits).toEqual(current.trace.logits);
});

it('LSTM 目标只改变损失/梯度，不改变前向状态或预测；RNN/GRU轨迹仍可用', () => {
  const current = lstmCurrent(), other = { ...current, target: 0, trace: neuralForward(current.model, current.tokens, { gradient: true, target: 0 }) };
  expect(current.trace.states).toEqual(other.trace.states);
  expect(current.trace.probabilities).toEqual(other.trace.probabilities);
  expect(current.trace.loss).not.toBe(other.trace.loss);
  for (const algorithm of ['RNN', 'GRU']) {
    const model = createNeural({ algorithm, vocab: ['<UNK>', 'a'] }), tokens = ['a'];
    const trace = neuralForward(model, tokens, { gradient: true, target: 1 });
    expect(step(sequenceTrace({ model, tokens, trace, target: 1 }), 'hidden').value).toBe(trace.states[0].hidden[0]);
  }
});

it('真实指标与B−A计算正确，不同Token/维度/目标不作伪对齐', () => {
  const a = attentionCurrent(), b = attentionCurrent([[true, false]]), summary = summarizeResult('attention', b, a);
  expect(summary.comparison.compatible).toBe(true);
  expect(summary.metrics.find(m => m.key === 'entropy').value).toBe(0);
  expect(summary.comparison.metrics.find(m => m.key === 'masked').delta).toBe(1);
  expect(summarizeResult('attention', { ...b, source: ['changed', 'b'] }, a).comparison.compatible).toBe(false);
  const lstm = lstmCurrent();
  expect(summarizeResult('sequence', { ...lstm, target: 0 }, lstm).comparison.compatible).toBe(false);
  const cnn = cnnCurrent(), changed = structuredClone(cnn); changed.model.structure.filters = 2;
  expect(summarizeResult('cnn', changed, cnn).comparison.compatible).toBe(false);
  expect(summarizeResult('optimization', {})).toBeNull();
});

it('分析只读取完成快照、不修改权重/结果；极小梯度不显示成零', () => {
  const current = lstmCurrent(), before = structuredClone(current);
  current.trace.stateGradients[0][0] = 1e-200;
  const summary = summarizeResult('sequence', current);
  expect(summary.metrics.find(m => m.key === 'firstGradient').value).toBe(1e-200);
  expect(traceNumber(1e-200)).toContain('e-200');
  sequenceTrace(current); expect(current.model).toEqual(before.model);
  expect(current.trace.logits).toEqual(before.trace.logits);
});

it('保存包含真实分析与独立A基线快照，Markdown有可读指标而非只有JSON', () => {
  const old = { records: store.records, baselines: store.baselines, storage: store.storage };
  try {
    store.records = []; const a = attentionCurrent(), b = attentionCurrent([[true, false]]);
    store.baselines = { attention: { config: a.config, result: a, fingerprint: 'a' } };
    const r = record('attention', b.config, b);
    expect(r.result.result.scores[0][0]).toBe('-Infinity');
    expect(validateExperiment(r)).toBe(r);
    expect(r.analysis.comparison.metrics.find(m => m.key === 'masked').delta).toBe(1);
    expect(r.baseline.result.result.weights).toEqual(a.result.weights);
    a.result.weights[0][0] = 999;
    expect(r.baseline.result.result.weights[0][0]).not.toBe(999);
    expect(summaryMarkdown(r.analysis)).toContain('| 屏蔽连接数 |');
    expect(summaryMarkdown(r.analysis)).toContain('### A / B 对照');
    expect(summaryMarkdown(r.analysis)).toContain('不证明因果');
  } finally { Object.assign(store, old); }
});
