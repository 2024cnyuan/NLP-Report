import { fingerprint, VERSION } from '../core/math.js';

export const store = { page: 'home', mode: 'principle', records: [], dataset: null, models: null, embedding: null, incoming: null, results: {}, baselines: {}, configs: {}, storage: '内存会话' };
try { store.records = JSON.parse(localStorage.getItem('tensorscope-records') ?? '[]'); if (!Array.isArray(store.records)) store.records = []; localStorage.setItem('tensorscope-probe', '1'); localStorage.removeItem('tensorscope-probe'); store.storage = '本机存储'; } catch { store.records = []; }
export function persist() { try { localStorage.setItem('tensorscope-records', JSON.stringify(store.records)); } catch { store.storage = '内存会话 · 请导出'; } }
export function record(module, config, result, extras = {}) {
  const r = { schema: 1, id: `exp-${Date.now()}`, name: `${module} · ${new Date().toLocaleString('zh-CN')}`, module, mode: store.mode, seed: config.seed ?? 42, config: structuredClone(config), result: structuredClone(result), configFingerprint: fingerprint(config), algorithmVersion: VERSION, preprocessing: 'local-v1', dataSource: store.dataset?.source ?? '内置教学数据', dataFingerprint: fingerprint(store.dataset?.samples ?? config), modelId: result?.modelId ?? null, status: 'completed', notes: '', createdAt: new Date().toISOString(), ...extras };
  store.records.unshift(r); if (store.records.length > 20) store.records.length = 20; persist(); return r;
}
