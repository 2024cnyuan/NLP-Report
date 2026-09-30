import { performance } from 'node:perf_hooks';
import { runAttention } from '../src/core/attention.js';

const size = Number(process.argv[2] || 128);
if (!Number.isInteger(size) || size < 1 || size > 1024) throw new Error('size must be 1..1024');
const vector = Array.from({ length: 32 }, (_, i) => Math.sin(i));
const config = { queries: Array.from({ length: size }, () => vector), keys: Array.from({ length: size }, () => vector), values: Array.from({ length: size }, () => vector), method: 'scaled', masked: [] };
const samples = [];
for (let i = 0; i < 7; i++) {
  const start = performance.now();
  const result = runAttention(config);
  samples.push(performance.now() - start);
  if (result.weights.length !== size) throw new Error('incorrect output shape');
}
samples.shift();
samples.sort((a, b) => a - b);
console.log(JSON.stringify({ size, cells: size * size, dimensions: 32, medianMs: (samples[2] + samples[3]) / 2, p95Ms: samples[5], note: 'Node CPU only; no browser render or worker transfer' }, null, 2));
