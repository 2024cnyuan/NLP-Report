import { fingerprint, rng, shuffle } from '../core/math.js';
import { validateDataset } from '../data/validation.js';

/** Keep fixed source split boundaries; hold validation out of train only when absent. */
export function prepareDataset(dataset, count = 100, seed = 42) {
  validateDataset(dataset);
  if (!Number.isInteger(count) || count < 20 || count > 5000 || count % 2) throw new Error('样本数量需为20–5000之间的偶数');
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647) throw new Error('随机种子无效');
  const seen = new Set(), groups = new Map();
  for (const s of dataset.samples) {
    const key = JSON.stringify(s.tokens), group = s.group ?? key;
    if (seen.has(key)) throw new Error('数据集存在重复 Token 序列，请先去重后再运行');
    seen.add(key);
    if (groups.has(group) && groups.get(group) !== s.split) throw new Error('同组样本跨划分，拒绝潜在泄漏');
    groups.set(group, s.split);
    if (s.tokens.length > 128) throw new Error('数据集模式上限128 Token；请显式分段，或选择短文本子集；不会静默截断');
  }
  const random = rng(seed), selected = [], hasValidation = dataset.samples.some(s => s.split === 'validation');
  const perClass = count / 2, nTrain = Math.floor(perClass * 7 / 10), nValidation = Math.floor(perClass / 10), nTest = perClass - nTrain - nValidation;
  for (const label of [0, 1]) {
    const train = shuffle(dataset.samples.filter(s => s.split === 'train' && s.label === label), random);
    const test = shuffle(dataset.samples.filter(s => s.split === 'test' && s.label === label), random);
    const validation = hasValidation ? shuffle(dataset.samples.filter(s => s.split === 'validation' && s.label === label), random) : train.slice(nTrain, nTrain + nValidation);
    if (train.length < nTrain + (hasValidation ? 0 : nValidation) || validation.length < nValidation || test.length < nTest) throw new Error(`类别 ${dataset.classes[label]} 划分样本不足：本次需要训练${nTrain}、验证${nValidation}、测试${nTest}条；不能借用测试样本补训练集`);
    selected.push(...train.slice(0, nTrain).map(s => ({ ...s, split: 'train' })),
      ...validation.slice(0, nValidation).map(s => ({ ...s, split: 'validation' })),
      ...test.slice(0, nTest).map(s => ({ ...s, split: 'test' })));
  }
  const result = structuredClone({ ...dataset, samples: selected, id: `${dataset.id}-${fingerprint(selected)}`,
    sampling: { count, seed, train: nTrain * 2, validation: nValidation * 2, test: nTest * 2,
      policy: hasValidation ? '各类等量；保留源数据的固定train/validation/test边界；每类按floor(70%)/floor(10%)/余量选样' : '各类等量；保留源train/test边界；验证样本从源训练池留出；每类按floor(70%)/floor(10%)/余量选样' } });
  return result;
}
