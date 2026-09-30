import { job, consume } from '../runtime/tasks.js';

let active = null;
self.onmessage = async ({ data }) => {
  const { runId, type, config, action } = data;
  if (action === 'start') {
    if (active) active.cancelled = true;
    const control = { cancelled: false, paused: false, runId }; active = control;
    try {
      const result = await consume(job(type, config), control, progress => self.postMessage({ runId, event: 'progress', progress }));
      if (!control.cancelled) self.postMessage({ runId, event: 'completed', result });
    } catch (error) { self.postMessage({ runId, event: control.cancelled ? 'cancelled' : 'failed', error: error.message }); }
    finally { if (active === control) active = null; }
  } else if (active?.runId === runId) {
    if (action === 'pause') active.paused = true;
    if (action === 'resume') active.paused = false;
    if (action === 'cancel') active.cancelled = true;
    self.postMessage({ runId, event: action === 'pause' ? 'paused' : action === 'resume' ? 'running' : 'cancelling' });
  }
};
