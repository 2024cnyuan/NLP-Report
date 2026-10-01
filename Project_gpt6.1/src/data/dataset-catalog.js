import hotelCSV from '../datacsv/ChnSentiCorp-balanced-2944.csv?raw';
import weiboCSV from '../datacsv/weibo-senti-balanced-5000.csv?raw';
import manifest from './dataset-manifest.json';
import { readCuratedCSV } from './curation.js';

// Only the curated CSVs are statically bundled; the large originals are NOT imported.
export const realDatasets = manifest.map((d, i) => ({
  schema: 1, id: d.id, name: d.name, samples: readCuratedCSV(i === 0 ? hotelCSV : weiboCSV), available: true,
  method: 'character', preprocessing: 'local-v1', classes: ['负向', '正向'], source: d.source, license: d.license, homepage: d.homepage,
  splitPolicy: 'fixed-stratified-v1',
  scope: `${d.stats.selected.reduce((s, n) => s + n, 0)}条真实短文本；正负各${d.perClass}条，≤128 Token；全局去重并剔除标签冲突。短文本筛选和平衡抽样有选择偏差，不是原始全量基准。`,
  provenance: { sourceFile: d.input, sourceSHA256: d.sourceSHA256, curatedFile: d.output, curatedSHA256: d.outputSHA256,
    policy: d.policy, stats: d.stats, splits: d.splits },
}));
export function getRealDataset(id) {
  const dataset = realDatasets.find(d => d.id === id);
  if (!dataset) throw new Error('未知真实数据集');
  return dataset;
}
