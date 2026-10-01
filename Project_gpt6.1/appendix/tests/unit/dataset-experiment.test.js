import { describe, it, expect } from '../../../tools/testing/vitest.js';
import { realDatasets } from '../../../src/data/dataset-catalog.js';
import { prepareDataset } from '../../../src/algorithms/dataset-experiment.js';
import { diagnose } from '../../../src/algorithms/diagnosis.js';
import { trainComparison, predict } from '../../../src/algorithms/classifiers.js';
import { consume, job } from '../../../src/runtime/tasks.js';
import { datasetReportMarkdown } from '../../../src/components/dataset-report.js';
import { tokenize } from '../../../src/data/datasets.js';
import { validateExperiment } from '../../../src/data/validation.js';
import { VERSION } from '../../../src/core/math.js';
// Test-only synthetic corpus: never shipped or presented as real dataset data.
const fixture = { schema: 1, id: 'test-fixture', name: '合成测试语料', source: '测试专用，非真实语料', license: '测试夹具', method: 'character', preprocessing: 'local-v1', classes: ['负向', '正向'], samples: ['train', 'test'].flatMap(split => [0, 1].flatMap(label => Array.from({ length: split === 'train' ? 80 : 20 }, (_, i) => { const text = `${split} ${label ? 'good' : 'bad'} sample${i}`; return { id: `${split}-${label}-${i}`, group: `${split}-${label}-${i}`, text, tokens: tokenize(text), label, split, originalSplit: split }; }))) };

describe('真实数据集实验与诊断', () => {
  it('仅两个真实短文本数据集，正负平衡、无重复、固定划分，全量抽样不越界', () => {
    expect(realDatasets.map(d => d.id)).toEqual(['chnsenticorp', 'weibo']);
    for (const [i, d] of realDatasets.entries()) {
      const count = [2944, 5000][i], sizes = [[2060, 294, 590], [3500, 500, 1000]][i];
      expect(d.samples).toHaveLength(count); expect(d.available).toBe(true);
      expect(d.samples.filter(s => s.label === 0)).toHaveLength(count / 2);
      expect(d.samples.every(s => s.tokens.length > 0 && s.tokens.length <= 128)).toBe(true);
      expect(new Set(d.samples.map(s => JSON.stringify(s.tokens))).size).toBe(count);
      expect(d.provenance.curatedSHA256).toMatch(/^[a-f0-9]{64}$/);
      const full = prepareDataset(d, count, 42), shuffled = prepareDataset(d, count, 43);
      expect(full.samples).toHaveLength(count);
      for (const [j, split] of ['train', 'validation', 'test'].entries()) {
        const rows = full.samples.filter(s => s.split === split);
        expect(rows).toHaveLength(sizes[j]);
        expect(rows.filter(s => s.label === 0)).toHaveLength(sizes[j] / 2);
        expect(new Set(rows.map(s => s.id))).toEqual(new Set(d.samples.filter(s => s.split === split).map(s => s.id)));
        expect(new Set(shuffled.samples.filter(s => s.split === split).map(s => s.id))).toEqual(new Set(rows.map(s => s.id)));
      }
      expect(prepareDataset(d, 100, 42)).toEqual(prepareDataset(d, 100, 42));
      expect(d.samples).toHaveLength(count);
    }
    expect(() => prepareDataset(realDatasets[0], 5000)).toThrow('不足');
  });
  it('酒店与微博全量NB真实训练，测试分母590/1000、独立预测及训练词表一致', async () => {
    for (const d of realDatasets) {
      const result = await consume(job('dataset-experiment', { dataset: d, count: d.samples.length, seed: 42, modelNames: ['NB'] }));
      expect(result.metrics.NB.count).toBe(d.id === 'weibo' ? 1000 : 590);
      expect(result.rows).toHaveLength(result.metrics.NB.count);
      const train = result.dataset.samples.filter(s => s.split === 'train');
      expect(result.models.NB.vocab.slice(1)).toEqual([...new Set(train.flatMap(s => s.tokens))].sort());
      for (const row of result.rows) expect(row.predictions.NB).toEqual(predict(result.models.NB, row.tokens));
      expect(result.metrics.NB.accuracy).toBe(result.rows.filter(r => r.label === r.predictions.NB.prediction).length / result.rows.length);
    }
  }, 20000);
  it('所有数量档位严格70/10/20且每类等量，同种子一致，输入不变', () => {
    for (const d of [fixture]) for (let count = 20; count <= 200; count += 20) {
      const before = JSON.stringify(d), a = prepareDataset(d, count, 42), b = prepareDataset(d, count, 42);
      expect(a).toEqual(b); expect(a.samples).toHaveLength(count);
      for (const [split, fraction] of [['train', .7], ['validation', .1], ['test', .2]]) {
        const rows = a.samples.filter(s => s.split === split);
        expect(rows).toHaveLength(Math.round(count * fraction));
        expect(rows.filter(s => s.label === 0)).toHaveLength(rows.length / 2);
        for (const s of rows) expect(s.originalSplit).toBe(split === 'validation' ? 'train' : split);
      }
      expect(new Set(a.samples.map(s => JSON.stringify(s.tokens))).size).toBe(count);
      expect(JSON.stringify(d)).toBe(before);
    }
    expect(prepareDataset(fixture, 100, 43).samples).not.toEqual(prepareDataset(fixture, 100, 42).samples);
  });
  it('拒绝数量、种子、超长、重复、跨组泄漏、样本不足', () => {
    const d = fixture;
    for (const count of [0, 21, 201, 100.5]) expect(() => prepareDataset(d, count)).toThrow('样本数量');
    expect(() => prepareDataset(d, 100, -1)).toThrow('种子');
    const change = fn => { const x = structuredClone(d); fn(x); return x; };
    expect(() => prepareDataset(change(x => x.samples[0].tokens = Array(129).fill('x')))).toThrow('128');
    expect(() => prepareDataset(change(x => x.samples[1].tokens = x.samples[0].tokens))).toThrow('重复');
    expect(() => prepareDataset(change(x => x.samples.at(-1).group = x.samples[0].group))).toThrow('跨划分');
    expect(() => prepareDataset({ ...d, samples: d.samples.slice(0, 10) })).toThrow('不足');
  });
  it('只训练选中NB，测试分母20，训练词表未见测试文本，报告指标真实', async () => {
    const result = await consume(job('dataset-experiment', { dataset: fixture, count: 100, seed: 42, modelNames: ['NB'] }));
    expect(Object.keys(result.models)).toEqual(['NB']);
    expect(result.rows).toHaveLength(20); expect(result.metrics.NB.count).toBe(20);
    const train = result.dataset.samples.filter(s => s.split === 'train');
    expect(result.models.NB.vocab.slice(1)).toEqual([...new Set(train.flatMap(s => s.tokens))].sort());
    for (const r of result.rows) expect(r.predictions.NB).toEqual(predict(result.models.NB, r.tokens));
    expect(result.diagnostics.NB.errors).toBe(result.rows.filter(r => r.label !== r.predictions.NB.prediction).length);
    const md = datasetReportMarkdown(result);
    expect(md).toContain('训练 70 / 验证 10 / 测试 20');
    expect(md).toContain(`| NB | ${result.metrics.NB.accuracy.toFixed(4)} |`);
    expect(md).toContain('错误诊断 · NB'); expect(md).not.toContain('### 错误诊断 · RNN');
  });
  it('四模型真实训练，独立预测一致，RNN参数随训练轮数改变，可播种复算', async () => {
    const dataset = prepareDataset(fixture, 20, 42), params = { dataset, epochs: 1, dim: 2, hidden: 2, seed: 42, batch: 4 };
    const a = await consume(trainComparison(params)), b = await consume(trainComparison(params));
    expect(a.models).toEqual(b.models); expect(a.rows).toEqual(b.rows);
    for (const n of ['NB', 'SVM', 'RNN', 'CNN']) {
      expect(a.metrics[n].count).toBe(4);
      for (const r of a.rows) expect(r.predictions[n].prediction).toBe(predict(a.models[n], r.tokens).prediction);
    }
    expect(a.models.RNN.trained).toBe(true); expect(a.models.CNN.trained).toBe(true);
    const c = await consume(trainComparison({ ...params, epochs: 2, modelNames: ['RNN'] }));
    expect(c.models.RNN.weights).not.toEqual(a.models.RNN.weights);
    expect(Object.keys(c.models)).toEqual(['RNN']);
    await expect(consume(trainComparison({ ...params, modelNames: [] }))).rejects.toThrow('至少一个');
  });
  it('诊断分母、重叠切片、未标注、方向、概率和SVM margin不混淆', () => {
    const row = (id, label, prediction, oov, len, text = 'not good') => ({ id, label, tokens: Array(len).fill('t'), text,
      predictions: { NB: { prediction, oov, probabilities: [.2, .8] }, SVM: { prediction: 0, oov, score: -.5 } } });
    const rows = [row('a', 0, 1, 2, 70), row('b', 1, 1, 0, 5), row('c', 1, 0, 0, 3), row('d', null, 0, 9, 10)];
    const d = diagnose(rows, 'NB');
    expect(d.count).toBe(3); expect(d.errors).toBe(2); expect(d.errorRate).toBeCloseTo(2 / 3);
    expect(d.directions.map(v => v.count)).toEqual([1, 1]);
    expect(d.slices.find(v => v.id === 'oov')).toMatchObject({ count: 1, errors: 1, errorRate: 1 });
    expect(d.oovRate).toBeCloseTo(2 / 78);
    expect(d.evidence[0]).toMatchObject({ id: 'a', confidence: .8, margin: null, disagreement: true });
    expect(diagnose(rows, 'SVM').evidence[0]).toMatchObject({ confidence: null, margin: -.5 });
    expect(diagnose([], 'NB').errorRate).toBeNull();
    expect(diagnose([], 'NB').slices.every(v => v.errorRate === null)).toBe(true);
  });
  it('导入数据集记录校验数值与模型选择，拒绝字段注入和无效配置', () => {
    const record = { schema: 1, module: 'comparison', algorithmVersion: VERSION, config: { experimentMode: 'dataset', datasetId: 'imported', dataset: fixture, count: 100, seed: 42, epochs: 1, dim: 4, hidden: 4, batch: 4, lr: .03, modelNames: ['NB'] } };
    expect(validateExperiment(record)).toBe(record);
    for (const [key, value] of [['count', '100" autofocus'], ['count', 21], ['seed', -1], ['dim', 65], ['epochs', 1.5], ['modelNames', []], ['modelNames', ['NB', 'NB']], ['modelNames', ['Transformer']], ['lr', '0.3']]) {
      expect(() => validateExperiment({ ...record, config: { ...record.config, [key]: value } })).toThrow('参数无效');
    }
  });
});
