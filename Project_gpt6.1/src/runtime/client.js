import ComputeWorker from '../workers/compute.js?worker&inline';
import { job, consume } from './tasks.js';

let sequence = 0, active = null, worker = null;
export const runtime = { status: 'idle', engine: 'Worker', progress: null, runId: null, error: null, listeners: new Set() };
const emit = () => runtime.listeners.forEach(fn => fn(runtime));
function finish(data) {
  if (!active || data.runId !== active.runId) return;
  runtime.status = data.event; if (data.progress) runtime.progress = data.progress; emit();
  if (data.event === 'completed') { active.resolve(data.result); active = null; }
  if (data.event === 'failed' || data.event === 'cancelled') { runtime.error = data.error; active.reject(new Error(data.error ?? '任务已取消')); active = null; emit(); }
}
export function run(type, config) {
  if (active) return Promise.reject(new Error('已有计算在运行，请先完成或取消当前任务'));
  const runId = ++sequence; runtime.status = 'running'; runtime.runId = runId; runtime.progress = null; runtime.error = null;
  return new Promise((resolve, reject) => {
    active = { runId, resolve, reject, cancelled: false, paused: false };
    try {
      if (!worker) { worker = new ComputeWorker(); worker.onmessage = e => finish(e.data); worker.onerror = () => { finish({ runId: active?.runId, event: 'failed', error: 'Worker 运行失败；请重试或使用 CPU 回退' }); worker?.terminate(); worker = null; }; }
      worker.postMessage({ action: 'start', type, config, runId });
    } catch {
      runtime.engine = '分块 CPU 回退';
      consume(job(type, config), active, progress => finish({ runId, event: 'progress', progress })).then(result => finish({ runId, event: 'completed', result }), e => finish({ runId, event: active?.cancelled ? 'cancelled' : 'failed', error: e.message }));
    }
    emit();
  });
}
export function control(action) {
  if (!active) return;
  if (runtime.engine === 'Worker') worker.postMessage({ runId: active.runId, action });
  else { if (action === 'cancel') active.cancelled = true; active.paused = action === 'pause'; runtime.status = action === 'pause' ? 'paused' : action === 'cancel' ? 'cancelling' : 'running'; emit(); }
}
