import { attentionKernel, runAttention, validateAttention } from '../core/attention.js';

let activeWorker = null;
let activeReject = null;

export function cancelAttention() {
  activeReject?.(new Error('已取消'));
  activeWorker?.terminate();
  activeWorker = null;
  activeReject = null;
}

export async function computeAttention(config, runId) {
  validateAttention(config);
  cancelAttention();
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 0));
    return { runId, result: runAttention(config), backend: 'main-thread' };
  }
  const source = `const attentionKernel = ${attentionKernel.toString()};\nself.onmessage = event => { try { const result = attentionKernel(event.data.config); self.postMessage({runId:event.data.runId,result}); } catch(error) { self.postMessage({runId:event.data.runId,error:String(error.message || error)}); } };`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  let worker = null;
  try {
    worker = new Worker(url);
    activeWorker = worker;
    const response = await new Promise((resolve, reject) => {
      activeReject = reject;
      const timer = setTimeout(() => reject(new Error('Worker 超时')), 15000);
      worker.onmessage = event => { clearTimeout(timer); resolve(event.data); };
      worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message || 'Worker 启动失败')); };
      worker.postMessage({ config, runId });
    });
    if (response.error) throw new Error(response.error);
    return { ...response, backend: 'blob-worker' };
  } catch (error) {
    if (error.message === '已取消') throw error;
    // Some file:// browsers reject Blob Workers. The same kernel remains available.
    await new Promise(resolve => setTimeout(resolve, 0));
    return { runId, result: runAttention(config), backend: 'main-thread' };
  } finally {
    if (activeWorker === worker) {
      worker.terminate();
      activeWorker = null;
      activeReject = null;
    }
    URL.revokeObjectURL(url);
  }
}
