import { describe, it, expect } from 'vitest';
import { sigmoid, softplus, evaluateLogistic, trainLogistic, DEFAULT_SAMPLES, downsampleExtrema } from '../src/core/optimization.js';

describe('M06 Logistic 优化', () => {
  it('稳定 sigmoid 和 softplus', () => {
    expect(sigmoid(1000)).toBe(1);
    expect(sigmoid(-1000)).toBe(0);
    expect(softplus(1000)).toBeCloseTo(1000, 12);
    expect(softplus(-1000)).toBeCloseTo(0, 12);
  });
  it('手算交叉熵、梯度与单次更新', () => {
    const samples = [{ x: [1, 0], y: 1 }, { x: [0, 1], y: 0 }];
    const value = evaluateLogistic(samples, [0, 0]);
    expect(value.loss).toBeCloseTo(Math.log(2), 12);
    expect(value.gradient).toEqual([-0.25, 0.25]);
    const result = trainLogistic({ samples, learningRate: 1, steps: 1, initialWeights: [0, 0] });
    expect(result.finalWeights).toEqual([0.25, -0.25]);
    expect(result.points[1].loss).toBeLessThan(result.points[0].loss);
  });
  it('独立有限差分核对两个梯度分量', () => {
    const weights = [0.7, -0.3];
    const analytic = evaluateLogistic(DEFAULT_SAMPLES, weights).gradient;
    for (let j = 0; j < 2; j++) {
      const plus = [...weights], minus = [...weights];
      plus[j] += 1e-5;
      minus[j] -= 1e-5;
      const numeric = (evaluateLogistic(DEFAULT_SAMPLES, plus).loss - evaluateLogistic(DEFAULT_SAMPLES, minus).loss) / 2e-5;
      expect(analytic[j]).toBeCloseTo(numeric, 8);
    }
  });
  it('固定初值下真实出现慢收敛和大步长震荡', () => {
    const slow = trainLogistic({ samples: DEFAULT_SAMPLES, learningRate: 0.01, steps: 20 });
    const normal = trainLogistic({ samples: DEFAULT_SAMPLES, learningRate: 0.5, steps: 20 });
    const large = trainLogistic({ samples: DEFAULT_SAMPLES, learningRate: 8, steps: 20 });
    expect(normal.points.at(-1).loss).toBeLessThan(slow.points.at(-1).loss);
    expect(large.points.at(-1).loss).toBeGreaterThan(normal.points.at(-1).loss);
    expect(large.points.slice(1).some((point, i) => point.loss > large.points[i].loss)).toBe(true);
  });
  it('降采样保留首末及局部峰值', () => {
    const points = Array.from({ length: 1000 }, (_, step) => ({ step, loss: step === 501 ? 100 : 1 }));
    const view = downsampleExtrema(points, 100);
    expect(view[0].step).toBe(0);
    expect(view.at(-1).step).toBe(999);
    expect(view.some(point => point.step === 501)).toBe(true);
  });
});
