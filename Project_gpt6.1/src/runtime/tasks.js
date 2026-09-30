import { attentionBatched } from '../algorithms/attention.js';
import { optimize } from '../algorithms/optimization.js';
import { trainEmbeddings } from '../algorithms/embeddings.js';
import { trainNeural, neuralForward, createNeural, makeVocab } from '../algorithms/neural.js';
import { trainComparison, evaluateBatch } from '../algorithms/classifiers.js';
import { parseFile, makeDataset } from '../data/datasets.js';

export const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
export async function* job(type, config) {
  if (type === 'attention') return yield* attentionBatched(config);
  if (type === 'optimization') return yield* optimize(config);
  if (type === 'embeddings') return yield* trainEmbeddings(config);
  if (type === 'neural') return yield* trainNeural(config.model, config.samples, config.params);
  if (type === 'comparison') return yield* trainComparison(config);
  if (type === 'batch') return yield* evaluateBatch(config);
  if (type === 'explain') return neuralForward(config.model, config.tokens, config.options);
  if (type === 'parse') return parseFile(config.text, config.name, config.delimiter);
  if (type === 'dataset') return makeDataset(config.parsed, config.options);
  if (type === 'benchmark-neural') return yield* trainNeural(createNeural({algorithm:config.algorithm,vocab:makeVocab(config.dataset.samples),dim:config.dim,hidden:config.hidden,widths:[2,3],filters:3,seed:config.seed}),config.dataset.samples,config);
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
