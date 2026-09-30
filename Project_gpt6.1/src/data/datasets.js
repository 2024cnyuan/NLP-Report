import { fingerprint } from '../core/math.js';

export const PREPROCESSING = 'local-v1';
export function tokenize(text, method = 'character') {
  const normalized = String(text).normalize('NFKC').toLowerCase().trim();
  if (method === 'space') return normalized.split(/\s+/).filter(Boolean);
  if (method !== 'character') throw new Error('未知分词方式');
  return normalized.match(/[\p{Script=Han}]|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];
}
// Original model-assisted teaching sentences; not a downloaded corpus or a benchmark of generalization.
const groups = {
  train: [
    ['这部电影很好看，故事感人',1],['演员表现出色，我很喜欢',1],['画面精美，情节十分精彩',1],['音乐动听，让人印象深刻',1],['值得推荐的一部好作品',1],['我喜欢这个故事和角色',1],['结局温暖，令人满意',1],['服务很好，体验非常愉快',1],['产品质量优秀，使用方便',1],['这本书写得精彩，值得读',1],['餐厅食物美味，环境舒适',1],['课程内容有趣，讲解清楚',1],['旅行安排合理，风景漂亮',1],['收到礼物很开心，谢谢',1],['运行流畅，功能实用',1],['这次体验比预期更好',1],
    ['这部电影很差，故事无聊',0],['演员表现糟糕，我很失望',0],['画面模糊，情节混乱',0],['音乐刺耳，让人难以忍受',0],['不值得推荐的作品',0],['我讨厌这个故事和角色',0],['结局敷衍，令人不满',0],['服务很差，体验非常糟糕',0],['产品质量差，使用麻烦',0],['这本书写得无聊，不值得读',0],['餐厅食物难吃，环境嘈杂',0],['课程枯燥，讲解不清楚',0],['旅行安排混乱，非常疲惫',0],['收到破损商品很生气',0],['运行卡顿，功能不好用',0],['这次体验比预期更差',0],
  ],
  validation: [['摄影很漂亮，整体感觉不错',1],['读完以后非常满意',1],['这个软件使用起来方便',1],['饭菜好吃，服务态度好',1],['情节太无聊，没有意思',0],['用了一天就坏了，很失望',0],['说话声音刺耳，难以忍受',0],['讲解混乱，完全听不懂',0]],
  test: [['剧情紧凑，角色有趣',1],['没有想象中那么差，还算好看',1],['虽然开头无聊，但结局精彩',1],['这家店让我感到很满意',1],['我愿意再读一次这本书',1],['买来送朋友，她很喜欢',1],['视频画面漂亮，音乐温暖',1],['操作清楚，体验顺畅',1],['看完让我觉得浪费时间',0],['虽然画面精美，但故事糟糕',0],['一点也不好看',0],['这次购物真的令人失望',0],['没有精彩情节，十分无聊',0],['服务态度糟糕，食物难吃',0],['功能麻烦，而且经常卡顿',0],['我再也不想参加这个课程',0]],
};
export const builtinDataset = {
  schema: 1, id: 'teaching-sentiment-v1', name: '短文本情感 · 教学集', source: '本项目原创、AI 辅助整理的 56 条教学句子；未作为真实语义泛化基准', license: 'CC0-1.0', preprocessing: PREPROCESSING, method: 'character', classes: ['负向','正向'],
  samples: Object.entries(groups).flatMap(([split, rows]) => rows.map(([text,label],i) => ({ id:`${split}-${i+1}`,group:`${split}-${i+1}`,text,tokens:tokenize(text),label,split }))),
};
export const builtinCorpus = '自然 语言 处理 研究 语言\n语言 模型 学习 词语 表示\n词语 向量 表示 语义 关系\n机器 学习 研究 数据\n深度 学习 训练 神经 网络\n神经 网络 学习 语言 表示\n我 喜欢 学习 自然 语言 处理\n我 喜欢 研究 机器 学习\n模型 训练 使用 数据\n语言 模型 理解 词语\n自然 语言 包含 语义 关系\n词语 向量 帮助 模型 理解 语言';

export function parseCSV(text, delimiter = ',') {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted){quoted=false;}else if(!cell){quoted=true;}else throw new Error(`CSV 第 ${rows.length+1} 行引号位置错误`);}
    else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.length))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV 引号未闭合，请检查分隔符与编码');
  row.push(cell);if(row.some(x=>x.length))rows.push(row);
  return rows;
}
export function parseFile(text,name,delimiter=',') {
  if(text.includes('\uFFFD'))throw new Error('检测到编码替换字符，请导出为 UTF-8 后重新导入');
  text=text.replace(/^\uFEFF/,'');
  if(/\.txt$/i.test(name))return {format:'txt',columns:['text'],rows:text.split(/\r?\n/).filter(s=>s.trim()).map(text=>({text}))};
  if(/\.csv$/i.test(name)){const rows=parseCSV(text,delimiter);if(rows.length<2)throw new Error('CSV 必须含字段名和至少一行数据');const columns=rows.shift();if(new Set(columns).size!==columns.length)throw new Error('CSV 列名重复');return {format:'csv',columns,rows:rows.map((r,i)=>{if(r.length!==columns.length)throw new Error(`CSV 第 ${i+2} 行列数不一致，请检查分隔符`);return Object.fromEntries(columns.map((c,j)=>[c,r[j]]));})};}
  if(/\.jsonl$/i.test(name)){const rows=text.split(/\r?\n/).filter(x=>x.trim()).map((s,i)=>{try{return JSON.parse(s);}catch{throw new Error(`JSONL 第 ${i+1} 行不是合法 JSON`);}});if(rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('JSONL 每行应是字段对象');return {format:'jsonl',columns:[...new Set(rows.flatMap(Object.keys))],rows};}
  if(/\.json$/i.test(name)){const value=JSON.parse(text),rows=Array.isArray(value)?value:value.samples;if(!Array.isArray(rows))throw new Error('JSON 数据应是样本数组或包含 samples 的对象');return {format:'json',columns:[...new Set(rows.flatMap(Object.keys))],rows};}
  throw new Error('支持 TXT、CSV、JSONL、JSON');
}
export function makeDataset(parsed,{textField='text',labelField='label',method='character',name='导入数据',source='用户提供',splitField='split'}={}) {
  if(!parsed.rows.length||parsed.rows.length>50000)throw new Error('样本数须在 1–50,000 范围');
  const rawLabels=[...new Set(parsed.rows.map(r=>r[labelField]).filter(x=>x!==''&&x!=null).map(String))].sort();
  if(rawLabels.length>2)throw new Error('当前分类器支持二分类；请选择一个二分类数据集');
  const seen=new Map();let duplicates=0;
  const samples=parsed.rows.map((r,i)=>{
    const text=r[textField];if(typeof text!=='string'||!text.trim())throw new Error(`第 ${i+1} 行 ${textField} 必须是非空文本`);
    const tokens=Array.isArray(r.tokens)?r.tokens:tokenize(text,method);
    if(tokens.length>1024)throw new Error(`第 ${i+1} 行有 ${tokens.length} Token（上限1024），请分段；不会静默截断`);
    if(tokens.some(t=>typeof t!=='string'||t.length>1024))throw new Error(`第 ${i+1} 行 tokens 无效`);
    const key=fingerprint(tokens);if(seen.has(key))duplicates++;else seen.set(key,i);
    const group=r.group==null?key:fingerprint(String(r.group)),bucket=parseInt(group,16)%10,split=r[splitField]|| (bucket<7?'train':bucket<8?'validation':'test');
    if(!['train','validation','test'].includes(split))throw new Error(`第 ${i+1} 行 split 需为 train/validation/test`);
    return {id:`sample-${i+1}`,group,text,tokens,label:r[labelField]==null||r[labelField]===''?null:rawLabels.indexOf(String(r[labelField])),split};
  });
  // Identical token sequences must never cross splits, including explicit split files.
  const splitByGroup=new Map(),splitByTokens=new Map();for(const s of samples){const key=fingerprint(s.tokens);if((splitByGroup.has(s.group)&&splitByGroup.get(s.group)!==s.split)||(splitByTokens.has(key)&&splitByTokens.get(key)!==s.split))throw new Error(`重复样本/模板组 ${s.id} 跨数据划分，可能造成泄漏`);splitByGroup.set(s.group,s.split);splitByTokens.set(key,s.split);}
  return {schema:1,id:fingerprint(samples),name,source,license:'由用户确认许可',method,preprocessing:PREPROCESSING,classes:rawLabels.length?rawLabels:['负向','正向'],samples,duplicates};
}
export function validateSequence(tokens,max=128){if(!tokens.length)throw new Error('输入没有 Token');if(tokens.length>max)throw new Error(`输入 ${tokens.length} Token，当前上限 ${max}；请明确分段，不会静默截断`);}
