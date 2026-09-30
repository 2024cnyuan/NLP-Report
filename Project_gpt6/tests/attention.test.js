import { describe, it, expect } from 'vitest';
import { softmax, crossEntropy } from '../src/core/math.js';
import { runAttention, attentionKernel, tokenize, makeVectors, inspectCell } from '../src/core/attention.js';
import { csvCell, recordCsv } from '../src/data/records.js';

describe('数值基础', () => {
  it('稳定 softmax 与自然对数交叉熵', () => {
    expect(softmax([1, 2, 3])).toEqual(expect.arrayContaining([expect.closeTo(0.09003057, 7), expect.closeTo(0.24472847, 7), expect.closeTo(0.66524096, 7)]));
    softmax([1000, 1001, 1002]).forEach((value, index) => expect(value).toBeCloseTo(softmax([1, 2, 3])[index], 12));
    expect(crossEntropy(0.8)).toBeCloseTo(0.22314355, 7);
    expect(() => softmax([1, 2], [false, false])).toThrow();
  });
});

const fixture = { queries: [[1, 0]], keys: [[1, 0], [0, 1]], values: [[2, 4], [6, 8]], masked: [], method: 'dot' };
describe('注意力', () => {
  it('点积、权重与输出可手算', () => {
    const result = runAttention(fixture);
    expect(result.scores[0]).toEqual([1, 0]);
    expect(result.weights[0][0]).toBeCloseTo(Math.E / (Math.E + 1), 12);
    expect(result.outputs[0][0]).toBeCloseTo((2 * Math.E + 6) / (Math.E + 1), 12);
    expect(inspectCell(fixture, result, 0, 0).contribution[0]).toBeCloseTo(2 * Math.E / (Math.E + 1), 12);
  });
  it('缩放点积、加性打分、掩码', () => {
    expect(runAttention({ ...fixture, method: 'scaled' }).scores[0][0]).toBeCloseTo(1 / Math.sqrt(2), 12);
    const additive = runAttention({ ...fixture, method: 'additive' });
    expect(additive.scores[0][0]).toBeCloseTo(Math.tanh(2) / Math.sqrt(2), 12);
    const masked = runAttention({ ...fixture, masked: [0] });
    expect(masked.weights[0]).toEqual([0, 1]);
    expect(masked.outputs[0]).toEqual([6, 8]);
    expect(() => runAttention({ ...fixture, masked: [0, 1] })).toThrow('整行');
  });
  it('拒绝错配形状与非有限数', () => {
    expect(() => runAttention({ ...fixture, queries: [[1]] })).toThrow('形状');
    expect(() => runAttention({ ...fixture, queries: [[Infinity, 0]] })).toThrow('非有限');
  });
  it('教学向量确定性且 Worker 核心与参考实现一致', () => {
    const config = { queries: makeVectors(tokenize('猫 吃 鱼'), 4), keys: makeVectors(tokenize('猫 喜欢 鱼'), 4), values: makeVectors(tokenize('猫 喜欢 鱼'), 4), method: 'additive', masked: [1] };
    expect(attentionKernel(config)).toEqual(runAttention(config));
    expect(makeVectors(['猫'], 4)).toEqual(makeVectors(['猫'], 4));
  });
});

describe('导出', () => {
  it('CSV 引号转义与公式注入保护', () => {
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
    const csv = recordCsv({ name: '=evil', input: { targetTokens: ['a'], sourceTokens: ['b', 'c'] }, config: fixture, result: runAttention(fixture) });
    expect(csv).toContain("'=evil");
  });
});
