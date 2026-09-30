import { trainLogistic } from '../core/optimization.js';
import optimizationSource from '../core/optimization.js?raw';

let worker = null;
let rejectActive = null;

export function cancelOptimization() {
  rejectActive?.(new Error('已取消'));
  worker?.terminate();
  worker = null;
  rejectActive = null;
}

export async function computeOptimization(config, runId) {
  cancelOptimization();
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 0));
    return { runId, result: trainLogistic(config), backend: 'main-thread' };
  }
  const code = optimizationSource.replaceAll('export ', '') + '\nself.onmessage=e=>{try{self.postMessage({runId:e.data.runId,result:trainLogistic(e.data.config)})}catch(error){self.postMessage({runId:e.data.runId,error:String(error.message||error)})}}';
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  let ownWorker = null;
  try {
    ownWorker = new Worker(url);
    worker = ownWorker;
    const answer = await new Promise((resolve, reject) => {
      rejectActive = reject;
      const timer = setTimeout(() => reject(new Error('Worker 超时')), 30000);
      ownWorker.onmessage = event => { clearTimeout(timer); resolve(event.data); };
      ownWorker.onerror = event => { clearTimeout(timer); reject(new Error(event.message || 'Worker 运行失败')); };
      ownWorker.postMessage({ config, runId });
    });
    if (answer.error) throw new Error(answer.error);
    return { ...answer, backend: 'blob-worker' };
  } catch (error) {
    if (error.message === '已取消') throw error;
    await new Promise(resolve => setTimeout(resolve, 0));
    return { runId, result: trainLogistic(config), backend: 'main-thread' };
  } finally {
    if (worker === ownWorker) { ownWorker.terminate(); worker = null; rejectActive = null; }
    URL.revokeObjectURL(url);
  }
}
