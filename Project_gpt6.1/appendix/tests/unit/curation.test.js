import { describe, it, expect } from '../../../tools/testing/vitest.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fromProject } from '../../../tools/paths.mjs';
import { cleanAndBalance, curatedCSV, readCuratedCSV } from '../../../src/data/curation.js';
import { realDatasets } from '../../../src/data/dataset-catalog.js';

describe('真实语料清洗与来源追踪', () => {
  it('去空/超长/非法行，按Token去重，冲突全删，保留emoji且不截断', () => {
    const rows = ['label,review'];
    for (const label of [0, 1]) for (let i = 0; i < 12; i++) rows.push(`${label},${label} sample${i} 😊 #话题 @用户`);
    rows.push('0,0 sample0 😊 #话题 @用户', '0,共同文本', '1,共同文本', '0,   ', `1,${'好'.repeat(129)}`, '2,非法标签');
    const csv = rows.join('\n'), a = cleanAndBalance(csv, { id: 'fixture', perClass: 10 });
    expect(a.stats).toMatchObject({ rawRows: 30, invalid: 1, empty: 1, long: 1, conflictingGroups: 1, conflictingRows: 2, sameLabelDuplicates: 1, selected: [10, 10] });
    expect(a.samples.every(s => s.text.includes('😊 #话题 @用户'))).toBe(true);
    expect(a.samples.filter(s => s.split === 'train')).toHaveLength(14);
    expect(a).toEqual(cleanAndBalance(csv, { id: 'fixture', perClass: 10 }));
    expect(readCuratedCSV(curatedCSV(a.samples))).toEqual(a.samples);
    expect(() => cleanAndBalance(csv, { id: 'fixture', perClass: 13 })).toThrow('不足');
    expect(() => cleanAndBalance('label,review\n0,\uFFFD', { id: 'x', perClass: 10 })).toThrow('编码');
    expect(() => readCuratedCSV('text,label')).toThrow('字段');
  });
  it('两份源CSV可复现生成完全一致的产物SHA，来源行与标签可核查', async () => {
    const manifests = JSON.parse(await readFile(fromProject('src/data/dataset-manifest.json'), 'utf8'));
    const hash = text => createHash('sha256').update(text).digest('hex');
    for (const [i, m] of manifests.entries()) {
      const raw = await readFile(fromProject(`src/datacsv/${m.input}`), 'utf8');
      const result = cleanAndBalance(raw, { id: m.id, perClass: m.perClass, seed: m.policy.seed, splitSeed: m.policy.splitSeed });
      const output = await readFile(fromProject(`src/datacsv/${m.output}`), 'utf8');
      expect(hash(raw)).toBe(m.sourceSHA256);
      expect(curatedCSV(result.samples)).toBe(output);
      expect(hash(output)).toBe(m.outputSHA256);
      expect(result.stats).toEqual(m.stats);
      expect(readCuratedCSV(output)).toEqual(realDatasets[i].samples);
    }
  }, 30000);
});
