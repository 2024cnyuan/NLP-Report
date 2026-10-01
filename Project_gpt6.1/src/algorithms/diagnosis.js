import { metrics } from '../core/metrics.js';

// Observable error patterns, not causal or semantic explanations.
export function diagnose(rows, name) {
  const labeled = rows.filter(r => r.label != null && r.predictions[name]);
  const errors = labeled.filter(r => r.label !== r.predictions[name].prediction);
  const slice = (id, label, test) => {
    const selected = labeled.filter(test);
    const wrong = selected.filter(r => r.label !== r.predictions[name].prediction).length;
    return { id, label, count: selected.length, errors: wrong, errorRate: selected.length ? wrong / selected.length : null };
  };
  const directions = [0, 1].map(label => ({ trueLabel: label, predictedLabel: 1 - label, count: errors.filter(r => r.label === label).length }));
  const oovTokens = labeled.reduce((s, r) => s + r.predictions[name].oov, 0);
  const tokens = labeled.reduce((s, r) => s + r.tokens.length, 0);
  const evidence = errors.map(r => {
    const p = r.predictions[name], disagreement = new Set(Object.values(r.predictions).map(v => v.prediction)).size > 1;
    return { id: r.id, prediction: p.prediction, label: r.label, oov: p.oov, length: r.tokens.length, disagreement,
      confidence: p.probabilities?.[p.prediction] ?? null, margin: name === 'SVM' ? p.score : null,
      clues: [p.oov ? `包含 ${p.oov} 个 OOV Token` : '无 OOV', r.tokens.length > 64 ? '长度超过 64 Token' : '长度不超过 64 Token', disagreement ? '已运行模型之间存在分歧' : '已运行模型预测一致'] };
  }).sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
  return { model: name, count: labeled.length, errors: errors.length, errorRate: labeled.length ? errors.length / labeled.length : null,
    metrics: metrics(labeled.map(r => r.label), labeled.map(r => r.predictions[name].prediction)), directions,
    oovRate: tokens ? oovTokens / tokens : null,
    slices: [slice('known', '无 OOV', r => !r.predictions[name].oov), slice('oov', '含 OOV', r => r.predictions[name].oov > 0),
      slice('short', '长度 ≤64', r => r.tokens.length <= 64), slice('long', '长度 >64', r => r.tokens.length > 64),
      slice('negation', '含否定 / 转折词形', r => /\b(?:not|no|never|but|however)\b|不|没|无|但|虽然/i.test(r.text))], evidence,
    limits: '切片可能重叠；错误率分母只含已标注样本。OOV、长度、词形和模型分歧只是线索，不是错误的因果证明。归一化概率未经可靠性校准；SVM margin 不是概率。' };
}
