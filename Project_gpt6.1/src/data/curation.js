import { parseCSV, tokenize } from './datasets.js';
import { rng, shuffle } from '../core/math.js';

export const CURATION_VERSION = 'balanced-short-v1';
export function cleanAndBalance(csv, { id, perClass, seed = 42, splitSeed = 42 }) {
  if (!id || !Number.isInteger(perClass) || perClass < 10) throw new Error('清洗配置无效');
  if (csv.includes('\uFFFD')) throw new Error('源CSV存在编码替换字符，请确认UTF-8');
  const rows = parseCSV(csv.replace(/^\uFEFF/, '')), header = rows.shift();
  if (JSON.stringify(header) !== JSON.stringify(['label', 'review'])) throw new Error('源CSV必须是label,review两列');
  const stats = { rawRows: rows.length, rawLabels: [0, 0], invalid: 0, empty: 0, long: 0, eligibleBeforeDedup: [0, 0],
    conflictingGroups: 0, conflictingRows: 0, sameLabelDuplicates: 0, eligibleAfterDedup: [0, 0], selected: [0, 0], droppedForBalance: [0, 0] };
  const groups = new Map();
  rows.forEach((r, i) => {
    if (r.length !== 2 || !['0', '1'].includes(r[0])) { stats.invalid++; return; }
    const label = Number(r[0]); stats.rawLabels[label]++;
    const text = r[1].replace(/\s+/g, ' ').trim(), tokens = tokenize(text);
    if (!tokens.length) { stats.empty++; return; }
    if (tokens.length > 128) { stats.long++; return; }
    stats.eligibleBeforeDedup[label]++;
    const key = JSON.stringify(tokens), sample = { id: `${id}-${i + 2}`, group: `${id}-${i + 2}`, text, tokens, label, sourceRow: i + 2 };
    if (!groups.has(key)) groups.set(key, { labels: new Set(), rows: [] });
    groups.get(key).labels.add(label); groups.get(key).rows.push(sample);
  });
  const candidates = [];
  for (const group of groups.values()) {
    if (group.labels.size > 1) { stats.conflictingGroups++; stats.conflictingRows += group.rows.length; continue; }
    stats.sameLabelDuplicates += group.rows.length - 1;
    candidates.push(group.rows[0]); stats.eligibleAfterDedup[group.rows[0].label]++;
  }
  const sampleRandom = rng(seed), splitRandom = rng(splitSeed), samples = [];
  for (const label of [0, 1]) {
    if (stats.eligibleAfterDedup[label] < perClass) throw new Error(`类别${label}仅有${stats.eligibleAfterDedup[label]}条合格文本，不足${perClass}`);
    const selected = shuffle(candidates.filter(r => r.label === label), sampleRandom).slice(0, perClass);
    const splitRows = shuffle(selected, splitRandom), train = Math.floor(perClass * 7 / 10), validation = Math.floor(perClass / 10);
    splitRows.forEach((s, i) => samples.push({ ...s, split: i < train ? 'train' : i < train + validation ? 'validation' : 'test' }));
    stats.selected[label] = perClass; stats.droppedForBalance[label] = stats.eligibleAfterDedup[label] - perClass;
  }
  return { samples, stats, policy: { version: CURATION_VERSION, seed, splitSeed, maxTokens: 128, tokenizer: 'local-v1 character：NFKC/小写；汉字逐字、英文数字按词、符号保留',
    clean: '仅合并空白并去首尾空白；保留emoji/话题/提及/标点；不翻译、不截断、不移除情感词',
    dedup: '以规范化Token序列全局去重；标签冲突的全部文本剔除；同标签重复只保留第一条',
    split: '本项目分层固定划分，非官方原始划分；每类floor(70%)训练、floor(10%)验证、余量测试；近重复未自动识别' } };
}

export function curatedCSV(samples) {
  const quote = v => `"${String(v).replaceAll('"', '""')}"`;
  return 'id,label,review,split,source_row,group\r\n' + samples.map(s => [s.id, s.label, s.text, s.split, s.sourceRow, s.group].map(quote).join(',')).join('\r\n') + '\r\n';
}

export function readCuratedCSV(csv) {
  const rows = parseCSV(csv), header = rows.shift();
  if (JSON.stringify(header) !== JSON.stringify(['id', 'label', 'review', 'split', 'source_row', 'group'])) throw new Error('清洗CSV字段不匹配');
  return rows.map(r => {
    if (r.length !== header.length || !['0', '1'].includes(r[1]) || !['train', 'validation', 'test'].includes(r[3]) || !Number.isInteger(Number(r[4]))) throw new Error('清洗CSV包含无效行');
    const tokens = tokenize(r[2]);
    if (!tokens.length || tokens.length > 128) throw new Error('清洗CSV包含空/超长Token');
    return { id: r[0], label: Number(r[1]), text: r[2], split: r[3], sourceRow: Number(r[4]), group: r[5], tokens };
  });
}
