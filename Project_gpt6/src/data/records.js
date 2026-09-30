import { ALGORITHM_VERSION } from '../core/attention.js';

export function fingerprint(value) {
  const data = JSON.stringify(value);
  let hash = 2166136261;
  for (const char of data) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

export function makeRecord(name, input, config, result, backend, note = '') {
  return {
    schemaVersion: 1,
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    name: String(name).trim() || '未命名实验',
    createdAt: new Date().toISOString(),
    module: 'M04', mode: input.mode || 'principle',
    input, config, result, backend,
    dataSource: 'user input / built-in example',
    dataFingerprint: fingerprint(input),
    model: { kind: 'deterministic teaching vectors', weightId: 'token-fnv1a-1', trained: false },
    preprocessing: { version: 'whitespace-tokenizer-1', trim: true },
    algorithmVersion: ALGORITHM_VERSION,
    seed: null,
    status: 'completed', processed: config.queries.length * config.keys.length,
    note: String(note)
  };
}

const STORAGE_KEY = 'tensorscope-records-v1';
let inMemory = [];

export function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item?.schemaVersion === 1 && item.module === 'M04') : [];
  } catch { return inMemory; }
}

export function saveRecord(record) {
  const records = [record, ...loadRecords()].slice(0, 30);
  inMemory = records;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); return 'localStorage'; }
  catch { return 'memory'; }
}

export function validateRecord(record) {
  if (!record || record.schemaVersion !== 1 || record.module !== 'M04' || !record.input || !record.config || !record.result || !Array.isArray(record.result.weights)) throw new Error('实验记录格式或版本不兼容');
  if (JSON.stringify(record).length > 2_000_000) throw new Error('实验记录超过 2 MB');
  return record;
}

export function csvCell(value) {
  const text = String(value);
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function recordCsv(record) {
  const rows = [['experiment', 'target_index', 'source_index', 'target', 'source', 'score', 'weight', 'masked']];
  record.result.weights.forEach((row, i) => row.forEach((weight, j) => rows.push([record.name, i, j, record.input.targetTokens[i], record.input.sourceTokens[j], record.result.scores[i][j], weight, record.config.masked.includes(j)])));
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function recordMarkdown(record) {
  const weights = record.result.weights.map((row, i) => `| ${i}: ${record.input.targetTokens[i].replaceAll('|', '\\|')} | ${row.map(value => value.toFixed(4)).join(' | ')} |`).join('\n');
  return `# ${record.name}\n\n- 时间：${record.createdAt}\n- 算法：${record.config.method} (${record.algorithmVersion})\n- 数据指纹：${record.dataFingerprint}\n- 计算后端：${record.backend}\n- 向量来源：确定性教学映射，未训练\n- 掩码索引：${record.config.masked.join(', ') || '无'}\n\n| 目标 / 来源 | ${record.input.sourceTokens.join(' | ')} |\n| --- | ${record.input.sourceTokens.map(() => '---').join(' | ')} |\n${weights}\n\n备注：${record.note}\n`;
}

export function downloadText(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
