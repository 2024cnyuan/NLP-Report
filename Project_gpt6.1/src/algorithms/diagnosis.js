import { metrics } from '../core/metrics.js';

// Observable error patterns, not causal or semantic explanations.
export function diagnose(rows, name, context = {}) {
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
  const negation = r => /\b(?:not|no|never|but|however)\b|不|没|无|但|虽然/i.test(r.text);
  const emoji = r => /\p{Extended_Pictographic}/u.test(r.text);
  const disagreement = r => new Set(Object.values(r.predictions).map(v => v.prediction)).size > 1;
  const slices = [slice('known', '无 OOV', r => !r.predictions[name].oov), slice('oov', '含 OOV', r => r.predictions[name].oov > 0),
    slice('short', '长度 ≤64', r => r.tokens.length <= 64), slice('long', '长度 >64', r => r.tokens.length > 64),
    slice('negation', '含否定 / 转折词形', negation), slice('plain', '无否定 / 转折词形', r => !negation(r)),
    slice('emoji', '含 emoji', emoji), slice('no-emoji', '无 emoji', r => !emoji(r)),
    slice('disagreement', '模型有分歧', disagreement), slice('agreement', '模型预测一致', r => !disagreement(r))];
  const distribution = [0, 1].map(label => ({ label, actual: labeled.filter(r => r.label === label).length,
    predicted: labeled.filter(r => r.predictions[name].prediction === label).length,
    train: context.dataset?.samples?.filter(r => r.split === 'train' && r.label === label).length ?? null }));
  const findings = [];
  for (const [a, b, hypothesis, next] of [
    ['oov', 'known', '词表覆盖差异可能影响这些样本；OOV 也可能与领域、长度一起变化。', '检查具体未知 Token。固定原模型，对同一条文本做有记录的替换，再重算；不要用测试集重新拟合词表。'],
    ['long', 'short', '长文本可能同时含更多 OOV、混合情绪或转折，不能直接归因于记忆能力。', '选取长度接近、OOV 接近的错误与正确案例，查看原模型状态或卷积窗口；仅改一个因素复算。'],
    ['negation', 'plain', '否定词或转折只是词形筛选，尚未识别语义范围。NB/SVM 的词袋不保留顺序，可能无法区分同词不同语序。', '用相同词项计数、不同语序的成对句子检查 NB/SVM；在 RNN/CNN 中核对位置变化后的计算。'],
    ['emoji', 'no-emoji', 'emoji 可能是情绪线索，也可能只是与话题或 OOV 相关。', '核对 emoji 是否在训练词表；固定模型，对同一条句子保留/删除 emoji 重算，并记录分数变化。'],
    ['disagreement', 'agreement', '模型分歧说明决策不同；一致错分可能涉及共同输入信息或训练覆盖，不自动说明标签有误。', '比较同一错误的模型分数与特征贡献；人工核对完整上下文和标签，保留原标签，记录疑点。'],
  ]) {
    const left = slices.find(s => s.id === a), right = slices.find(s => s.id === b);
    if (!left.count || !right.count) continue;
    findings.push({ id: a, observed: `${left.label}：错 ${left.errors}/${left.count}；${right.label}：错 ${right.errors}/${right.count}。错误率差（前者−后者）${((left.errorRate-right.errorRate)*100).toFixed(1)} 个百分点。`,
      hypothesis, next, caution: Math.min(left.count, right.count) < 10 ? '至少一组不足10条，结果易波动；此差值不是显著性检验。' : '这是观察性切片对照，不是受控实验或显著性检验。' });
  }
  if (labeled.length) {
    const dominant = distribution[1].predicted > distribution[0].predicted ? 1 : 0;
    findings.unshift({ id: 'class-bias', observed: `预测类别分布：类别₀ ${distribution[0].predicted}/${labeled.length}，类别₁ ${distribution[1].predicted}/${labeled.length}；真实类别分布 ${distribution[0].actual}/${distribution[1].actual}${distribution[0].train == null ? '' : `；训练类别分布 ${distribution[0].train}/${distribution[1].train}`}。`,
      hypothesis: distribution[dominant].predicted === labeled.length ? '当前全部预测为同一类。可能涉及训练不足、类别/特征偏向或数据问题；仅凭此现象不能确定原因。' : '预测分布与标签分布的差异可提示类别偏向，但不等同于训练数据不平衡。',
      next: '先核对标签顺序、两类 Recall 与训练分布；再固定数据、种子和结构，只改训练轮数，对照训练损失与留出结果。', caution: '不能根据本轮测试结果反复挑选超参数后，仍把同一测试集当独立验收集。' });
  }
  const mean = list => { const values = list.map(r => name === 'SVM' ? Math.abs(r.predictions[name].score) : r.predictions[name].probabilities?.[r.predictions[name].prediction]).filter(Number.isFinite); return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null; };
  const certainty = { correct: mean(labeled.filter(r=>r.label===r.predictions[name].prediction)), wrong: mean(errors),
    highConfidenceErrors: name === 'SVM' ? null : errors.filter(r=>r.predictions[name].probabilities?.[r.predictions[name].prediction]>=.9).length };
  const history = context.histories?.[name] ?? context.models?.[name]?.history;
  if (history?.length) findings.push({ id: 'training', observed: `训练日志 ${history.length} 轮：首轮平均损失 ${history[0].loss.toFixed(5)}，末轮 ${history.at(-1).loss.toFixed(5)}。`,
    hypothesis: '训练损失下降只说明训练目标变化，不保证测试错误减少；SVM 日志为 hinge+L2，神经模型为 CE，不能跨模型直接比较。',
    next: '固定数据与初始化，用少量明确的训练配置做对照；需要选择配置时使用独立验证集，最后评测未参与选择的测试集。', caution: '这里没有自动判定过拟合：缺少逐轮验证损失。' });
  return { model: name, count: labeled.length, errors: errors.length, errorRate: labeled.length ? errors.length / labeled.length : null,
    metrics: metrics(labeled.map(r => r.label), labeled.map(r => r.predictions[name].prediction)), directions,
    oovRate: tokens ? oovTokens / tokens : null,
    slices, evidence, distribution, certainty, findings,
    limits: '切片可能重叠；错误率分母只含已标注样本。OOV、长度、词形和模型分歧只是线索，不是错误的因果证明。归一化概率未经可靠性校准；SVM margin 不是概率。' };
}
