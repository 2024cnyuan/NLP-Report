import { attention } from '../algorithms/attention.js';
import { optimize } from '../algorithms/optimization.js';

export const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
export async function* job(type, config) {
  if (type === 'attention') return attention(config);
  if (type === 'optimization') return yield* optimize(config);
  throw new Error(`未知任务 ${type}`);
}
export async function consume(iterator, control = {}, progress = () => {}) {
  let step;
  while (true) {
    if (control.cancelled) throw new Error('任务已取消');
    while (control.paused) { if (control.cancelled) throw new Error('任务已取消'); await new Promise(r => setTimeout(r, 30)); }
    step = await iterator.next(); if (step.done) return step.value;
    progress(step.value); await yieldTask();
  }
}
