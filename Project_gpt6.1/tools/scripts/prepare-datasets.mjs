import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fromProject, evidencePath } from '../paths.mjs';
import { cleanAndBalance, curatedCSV } from '../../src/data/curation.js';
const definitions = [
  { id: 'chnsenticorp', name: 'ChnSentiCorp · 酒店评论', input: 'ChnSentiCorp_htl_all.csv', output: 'ChnSentiCorp-balanced-2944.csv', perClass: 1472 },
  { id: 'weibo', name: '微博情感 · 口语短文本', input: 'weibo_senti_100k.csv', output: 'weibo-senti-balanced-5000.csv', perClass: 2500 },
];
const sha = s => createHash('sha256').update(s).digest('hex'), manifest = [];
for (const d of definitions) {
  // Originals remain untouched in src/datacsv; only the two curated CSVs enter the bundle.
  const sourcePath = `src/datacsv/${d.input}`, source = await readFile(fromProject(sourcePath), 'utf8');
  const result = cleanAndBalance(source, { id: d.id, perClass: d.perClass, seed: 42, splitSeed: 42 }), csv = curatedCSV(result.samples);
  const splits = Object.fromEntries(['train', 'validation', 'test'].map(split => [split, [0, 1].map(c => result.samples.filter(s => s.split === split && s.label === c).length)]));
  manifest.push({ ...d, sourcePath, sourceSHA256: sha(source), outputSHA256: sha(csv), outputBytes: Buffer.byteLength(csv), policy: result.policy, stats: result.stats, splits,
    source: '用户提供的ChineseNlpCorpus命名CSV；原文及标注来自原语料，非项目生成句子',
    homepage: `https://github.com/SophonPlus/ChineseNlpCorpus/tree/master/datasets/${d.input.replace('.csv', '')}`,
    license: '用户提供第三方语料；未据此授予ISC/CC0许可，原文版权归原作者；使用和再分发需确认数据权利' });
  await writeFile(fromProject(`src/datacsv/${d.output}`), csv);
  console.log(JSON.stringify({ id: d.id, stats: result.stats, splits, bytes: Buffer.byteLength(csv) }));
}
await writeFile(fromProject('src/data/dataset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(evidencePath('dataset-curation.json'), JSON.stringify(manifest, null, 2) + '\n');
