import { sigmoid, rng, shuffle, mean } from '../core/math.js';

export const optimizationData = [
  { x: [-4, 1], y: 0 }, { x: [-3, 1], y: 0 }, { x: [-2, 1], y: 1 }, { x: [-1, 1], y: 0 },
  { x: [1, 1], y: 1 }, { x: [2, 1], y: 0 }, { x: [3, 1], y: 1 }, { x: [4, 1], y: 1 },
];
export function logistic(w, data = optimizationData) {
  if (!data.length) throw new Error('训练数据为空');
  const rows = data.map(({ x, y }) => {
    const z = x[0] * w[0] + x[1] * w[1], p = sigmoid(z);
    const loss = Math.max(z, 0) - y * z + Math.log1p(Math.exp(-Math.abs(z)));
    return { x, y, z, p, loss, gradient: x.map(a => (p - y) * a) };
  });
  return { loss: mean(rows.map(r => r.loss)), gradient: w.map((_, j) => mean(rows.map(r => r.gradient[j]))), rows };
}
export async function* optimize(config) {
  const { lr = 0.1, steps = 100, seed = 42, batch = 8, initial = [0, 0], data = optimizationData } = config;
  if (!(lr > 0 && lr <= 100) || !Number.isInteger(steps) || steps < 1 || steps > 10000 || !Number.isInteger(batch) || batch < 1 || batch > data.length || initial.length !== 2 || initial.some(x => !Number.isFinite(x))) throw new Error('学习率/步数/批大小/初值无效');
  let w = [...initial], order = [], cursor = 0; const random = rng(seed), history = [];
  for (let i = 0; i <= steps; i++) {
    const evalResult = logistic(w, data);
    if (!Number.isFinite(evalResult.loss) || w.some(x => !Number.isFinite(x))) throw new Error(`第 ${i} 步数值非有限，训练中止`);
    if (cursor + batch > order.length) { order = shuffle(data, random); cursor = 0; }
    const train = logistic(w, order.slice(cursor, cursor + batch)); cursor += batch;
    history.push({ step: i, w: [...w], loss: evalResult.loss, trainLoss: train.loss, gradient: [...train.gradient] });
    if (i < steps) w = w.map((v, j) => v - lr * train.gradient[j]);
    if (i % 25 === 0) yield { processed: i, total: steps, loss: evalResult.loss, history: history.slice(-30) };
  }
  return { history, w, config, checkpoint: { weights: w, optimizer: 'SGD', randomState: random.state(), dataPosition: cursor }, details: logistic(w, data) };
}
