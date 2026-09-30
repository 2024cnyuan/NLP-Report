export const OPTIMIZATION_VERSION = 'logistic-1.0.0';

export const DEFAULT_SAMPLES = [
  { id: 's1', text: '好', x: [2, 0], y: 1 },
  { id: 's2', text: '好', x: [2, 0], y: 0 },
  { id: 's3', text: '差', x: [0, 2], y: 1 },
  { id: 's4', text: '差', x: [0, 2], y: 0 }
];

export function sigmoid(z) {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

export function softplus(z) {
  return Math.max(z, 0) + Math.log1p(Math.exp(-Math.abs(z)));
}

export function validateSamples(samples) {
  if (!Array.isArray(samples) || samples.length < 2 || samples.length > 2000) throw new Error('样本数需为 2–2000');
  samples.forEach((sample, index) => {
    if (!Array.isArray(sample.x) || sample.x.length !== 2 || sample.x.some(value => !Number.isFinite(value) || Math.abs(value) > 100) || ![0, 1].includes(sample.y)) throw new Error(`第 ${index + 1} 行特征或标签无效`);
  });
}

/** Mean natural-log cross entropy and exact full-batch gradient for a two-weight logistic model. */
export function evaluateLogistic(samples, weights) {
  validateSamples(samples);
  if (!Array.isArray(weights) || weights.length !== 2 || weights.some(value => !Number.isFinite(value))) throw new Error('权重必须是两个有限数');
  let loss = 0;
  const gradient = [0, 0];
  const details = samples.map(sample => {
    const logit = weights[0] * sample.x[0] + weights[1] * sample.x[1];
    const probability = sigmoid(logit);
    const sampleLoss = softplus(logit) - sample.y * logit;
    loss += sampleLoss;
    for (let j = 0; j < 2; j++) gradient[j] += (probability - sample.y) * sample.x[j];
    return { id: sample.id, text: sample.text, x: sample.x, y: sample.y, logit, probability, loss: sampleLoss };
  });
  return { loss: loss / samples.length, gradient: gradient.map(value => value / samples.length), details };
}

/** Every point is an actual evaluation of the current parameters. */
export function trainLogistic({ samples, learningRate, steps, initialWeights = [1.2, -1] }) {
  validateSamples(samples);
  if (!Number.isFinite(learningRate) || learningRate <= 0 || learningRate > 100) throw new Error('学习率需在 (0, 100]');
  if (!Number.isInteger(steps) || steps < 1 || steps > 5000) throw new Error('迭代数需为 1–5000');
  let weights = [...initialWeights];
  const points = [];
  for (let step = 0; step <= steps; step++) {
    const evaluated = evaluateLogistic(samples, weights);
    if (!Number.isFinite(evaluated.loss) || evaluated.gradient.some(value => !Number.isFinite(value))) throw new Error(`第 ${step} 步出现非有限数`);
    points.push({ step, weights: [...weights], loss: evaluated.loss, gradient: evaluated.gradient, details: step === 0 || step === steps ? evaluated.details : undefined });
    if (step === steps) break;
    weights = weights.map((weight, j) => weight - learningRate * evaluated.gradient[j]);
  }
  return { points, initialWeights, finalWeights: weights, learningRate, steps, sampleCount: samples.length, version: OPTIMIZATION_VERSION };
}

/** Keep extrema in each display bucket; never alter the original training log. */
export function downsampleExtrema(points, maxPoints = 500) {
  if (points.length <= maxPoints) return points;
  const output = [points[0]];
  const bucket = Math.ceil((points.length - 2) / Math.floor((maxPoints - 2) / 2));
  for (let start = 1; start < points.length - 1; start += bucket) {
    const slice = points.slice(start, Math.min(start + bucket, points.length - 1));
    const min = slice.reduce((a, b) => a.loss <= b.loss ? a : b);
    const max = slice.reduce((a, b) => a.loss >= b.loss ? a : b);
    output.push(...(min.step < max.step ? [min, max] : max.step < min.step ? [max, min] : [min]));
  }
  output.push(points.at(-1));
  return output;
}
