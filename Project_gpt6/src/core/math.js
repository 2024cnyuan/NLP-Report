export function softmax(values, mask = values.map(() => true)) {
  if (!Array.isArray(values) || !values.length || mask.length !== values.length) throw new Error('Softmax 输入与掩码长度必须一致且非空');
  const valid = values.filter((value, index) => mask[index] && Number.isFinite(value));
  if (valid.length !== mask.filter(Boolean).length) throw new Error('Softmax 有效位置必须为有限数');
  if (!valid.length) throw new Error('整行被掩码屏蔽，无法计算注意力');
  const max = Math.max(...valid);
  const exp = values.map((value, index) => mask[index] ? Math.exp(value - max) : 0);
  const denominator = exp.reduce((sum, value) => sum + value, 0);
  return exp.map(value => value / denominator);
}

export function dot(a, b) {
  if (a.length !== b.length || !a.length) throw new Error('向量维度不一致');
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

export function crossEntropy(probability) {
  if (!(probability > 0 && probability <= 1)) throw new Error('真类概率必须在 (0, 1]');
  return -Math.log(probability);
}
