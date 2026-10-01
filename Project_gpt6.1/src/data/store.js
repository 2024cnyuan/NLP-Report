import { fingerprint, VERSION } from '../core/math.js';
import { summarizeResult } from '../algorithms/explanations.js';

// Match JSON exports: masked −Infinity scores remain explicit strings, rather
// than invalid JSON numbers or silently converted nulls in localStorage.
const portableSnapshot = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));

export const store = { page: 'home', mode: 'principle', records: [], dataset: null, models: null, embedding: null, incoming: null, results: {}, baselines: {}, configs: {}, views: {}, comparisonMode: 'case', storage: '内存会话' };
try { store.records = JSON.parse(localStorage.getItem('tensorscope-records') ?? '[]'); if (!Array.isArray(store.records)) store.records = []; localStorage.setItem('tensorscope-probe', '1'); localStorage.removeItem('tensorscope-probe'); store.storage = '本机存储'; } catch { store.records = []; }
export function persist() { try { localStorage.setItem('tensorscope-records', JSON.stringify(store.records)); } catch { store.storage = '内存会话 · 请导出'; } }
export function record(module, config, result, extras = {}) {
  const r = { schema: 1, id: `exp-${Date.now()}`, name: `${module} · ${new Date().toLocaleString('zh-CN')}`, module, mode: store.mode, seed: config.seed ?? 42, config: structuredClone(config), result: portableSnapshot(result), configFingerprint: fingerprint(config), algorithmVersion: VERSION, preprocessing: 'local-v1', dataSource: config.dataset?.source ?? store.dataset?.source ?? '内置教学数据', dataFingerprint: result?.dataFingerprint ?? fingerprint(config.dataset?.samples ?? store.dataset?.samples ?? config), modelId: result?.modelId ?? null, status: 'completed', notes: '', createdAt: new Date().toISOString(), ...extras };
  const baseline = store.baselines[module];
  r.analysis = summarizeResult(module, result, baseline?.result);
  if (r.analysis && baseline) r.baseline = portableSnapshot(baseline);
  r.modelId ??= result?.model?.id ?? null;
  store.records.unshift(r); if (store.records.length > 20) store.records.length = 20; persist(); return r;
}
