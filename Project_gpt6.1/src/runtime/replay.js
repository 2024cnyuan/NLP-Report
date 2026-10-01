import { run } from './client.js';
import { tokenize } from '../data/datasets.js';
import { validateExperiment } from '../data/validation.js';
import { VERSION } from '../core/math.js';

// Imported baseline numbers are never trusted. Recompute A from its inputs.
export async function replayBaseline(module, baseline) {
  const config = structuredClone(baseline.config);
  validateExperiment({ schema: 1, algorithmVersion: VERSION, module, config });
  if (module === 'attention') {
    if (!config.Q || !config.K || !config.V) throw new Error('基线缺少 Q/K/V，无法精确复算');
    const source = config.source.trim().split(/\s+/).filter(Boolean), target = config.target.trim().split(/\s+/).filter(Boolean);
    if (!source.length || !target.length || config.Q.length !== target.length || config.K.length !== source.length || config.V.length !== source.length) throw new Error('基线矩阵行数必须匹配 Token 序列');
    const result = await run('attention', { Q: config.Q, K: config.K, V: config.V, method: config.method, mask: config.mask });
    return { config, source, target, result };
  }
  if (!config.model) throw new Error('基线缺少模型权重，无法精确复算');
  const tokens = config.tokens ?? tokenize(config.text, config.model.method);
  const trace = await run('explain', { model: config.model, tokens, options: { trace: true, gradient: module === 'sequence', target: config.target ?? 0 } });
  return { config, model: config.model, tokens, text: config.text, target: config.target ?? 0, trace, step: 0 };
}
