import { trainEmbeddings } from '../core/embeddings.js';
import embeddingsSource from '../core/embeddings.js?raw';

let activeWorker = null;
let activeReject = null;

export function cancelEmbeddings() {
  activeReject?.(new Error('已取消'));
  activeWorker?.terminate();
  activeWorker = null;
  activeReject = null;
}

export async function computeEmbeddings(config, runId) {
  cancelEmbeddings();
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 0));
    return { runId, result: trainEmbeddings(config), backend: 'main-thread' };
  }
  const source = embeddingsSource.replaceAll('export ', '') + '\nself.onmessage=e=>{try{self.postMessage({runId:e.data.runId,result:trainEmbeddings(e.data.config)})}catch(error){self.postMessage({runId:e.data.runId,error:String(error.message||error)})}}';
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  let worker = null;
  try {
    worker = new Worker(url);
    activeWorker = worker;
    const answer = await new Promise((resolve, reject) => {
      activeReject = reject;
      const timer = setTimeout(() => reject(new Error('词向量 Worker 超时')), 60000);
      worker.onmessage = event => { clearTimeout(timer); resolve(event.data); };
      worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message || '词向量 Worker 失败')); };
      worker.postMessage({ config, runId });
    });
    if (answer.error) throw new Error(answer.error);
    return { ...answer, backend: 'blob-worker' };
  } catch (error) {
    if (error.message === '已取消') throw error;
    await new Promise(resolve => setTimeout(resolve, 0));
    return { runId, result: trainEmbeddings(config), backend: 'main-thread' };
  } finally {
    if (activeWorker === worker) { worker.terminate(); activeWorker = null; activeReject = null; }
    URL.revokeObjectURL(url);
  }
}
