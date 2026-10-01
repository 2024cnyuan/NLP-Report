import { realDatasets, getRealDataset } from '../data/dataset-catalog.js';
import { store } from '../data/store.js';
import { run, runtime } from '../runtime/client.js';

import { names } from '../algorithms/classifiers.js';
import { panel, field, select, number, button, note, escapeHTML, getNumber, safe, fmt, pct, notify } from '../components/ui.js';
import { matrixHTML, curveSVG } from '../viz/charts.js';
import { diagnosisHTML, bindDiagnosis } from '../components/diagnosis.js';

export async function mountDatasetMode(root, context) {
  const replay = store.incoming?.type === 'replay' && store.configs.comparison?.experimentMode === 'dataset';
  const config = structuredClone((replay ? store.configs.comparison : store.configs.datasetLab) ?? {
    experimentMode: 'dataset', datasetId: 'chnsenticorp', count: 100, modelNames: [...names], epochs: 5, lr: .03, dim: 4, hidden: 4, batch: 4, seed: 42,
  });
  if (replay) store.incoming = null;
  let current = replay ? null : store.results.datasetLab, selected = current?.modelNames[0] ?? 'NB', page = 0, onlyErrors = false, confusion = null;
  const options = realDatasets.map(d => [d.id, d.name]);
  if (store.dataset) options.push(['imported', '已确认的用户数据（仍须二分类）']);
  if (config.datasetId === 'imported' && config.dataset) options.push(['saved', '记录内的原始数据快照']);
  if (replay && !options.some(([id]) => id === config.datasetId)) options.push([config.datasetId, '记录内的原始数据快照']);
  root.innerHTML = `<div class="lab-layout"><section class="controls panel">
    <div class="control-heading"><span class="eyebrow">DATASET EXPERIMENT</span><h2>训练，再用留出样本评测</h2></div>
    ${field('数据集', select('dataset-choice', options, config.datasetId))}<div id="dataset-origin"></div>
    ${field('总样本数量', '<input id="dataset-count" type="number" min="20" max="5000" step="2" value="' + config.count + '" required>', '偶数，至少20条；每类floor(70%)训练、floor(10%)验证、余量测试，各划分正负等量。')}
    ${button('使用完整数据集', 'dataset-full', 'full')}
    <fieldset class="dataset-models"><legend>参与实验的模型（可多选）</legend>${names.map(n => `<label><input type="checkbox" name="dataset-model" value="${n}" ${config.modelNames.includes(n) ? 'checked' : ''}> ${n === 'CNN' ? 'CNN / Text-CNN' : n}</label>`).join('')}</fieldset>
    ${field('训练轮数', number('dataset-epochs', config.epochs, 1, 100), 'NB 使用闭式词计数，不进行迭代；轮数影响 SVM/RNN/CNN。')}
    ${field('学习率', number('dataset-lr', config.lr, .0001, 1, .001))}
    ${field('随机种子', number('dataset-seed', config.seed, 0, 2147483647), '控制抽样、初始化及训练顺序；同种子可复算。')}
    <details><summary>神经模型结构</summary>${field('Embedding 维度', number('dataset-dim', config.dim, 2, 32))}${field('RNN 隐藏维度', number('dataset-hidden', config.hidden, 2, 32))}${field('神经模型批大小', number('dataset-batch', config.batch, 1, 64))}<p class="small">CNN 核宽 2/3，各3个核；CPU 参考实现，从同种子初值真实训练，非预训练模型。</p></details>
    ${button('运行数据集实验', 'dataset-run', 'primary full', 'play')}
    ${note('词表只拟合训练集；验证集本轮保留，不用于调参或校准；指标只用测试集。先用100条检查流程，全量可先选NB/SVM；全量神经训练可能较慢，支持暂停/取消。')}
    <a href="#help/datasets" class="guide-link">数据集实验怎么做 →</a>
  </section><div class="workspace"><div class="flow-strip"><span class="flow-active">01 分层抽样</span><i>→</i><span>02 真实训练</span><i>→</i><span>03 测试集评测</span><i>→</i><span>04 错误诊断</span></div><div id="dataset-result"></div></div></div>`;
  const out = root.querySelector('#dataset-result');
  function source() {
    const id = root.querySelector('#dataset-choice').value;
    if (id === 'saved' || (replay && id === config.datasetId)) return config.dataset;
    if (id === 'imported') return store.dataset ?? config.dataset;
    return getRealDataset(id);
  }
  function origin() {
    const d = source();
    const homepage = typeof d.homepage === 'string' && /^https?:\/\//i.test(d.homepage) ? d.homepage : null;
    root.querySelector('#dataset-origin').innerHTML = `<div class="note"><span>${escapeHTML(d.name)}<br>${d.samples.length} 条可用源样本 · ${d.classes.map(escapeHTML).join(' / ')}<br>${escapeHTML(d.scope ?? '用户提供的数据；需足够原 train/test 样本，不自动截断。')}<br><small>${escapeHTML(d.license)}</small>${homepage ? `<br><a href="${escapeHTML(homepage)}" target="_blank" rel="noopener noreferrer">原始来源（联网查看） ↗</a>` : ''}<br>${!d.samples.length ? '<a href="#data">等待数据；也可导入已有文件 →</a>' : ''}</span></div>`;
    if (d.provenance?.splits) root.querySelector('#dataset-origin').insertAdjacentHTML('beforeend', `<p class="small">全量固定划分：${Object.entries(d.provenance.splits).map(([split, values]) => `${split} ${values[0]+values[1]}`).join(' / ')}。本项目分层划分，非官方原划分。<br>文件 ${escapeHTML(d.provenance.curatedFile)}<br>清洗版本 ${escapeHTML(d.provenance.policy.version)}；原始数据保留、不进入演示包。</p>`);
    const countInput = root.querySelector('#dataset-count');
    countInput.max = Math.min(5000, d.samples.length);
    if (Number(countInput.value) > Number(countInput.max)) { countInput.value = Math.floor(Number(countInput.max)/2)*2; countInput.dispatchEvent(new Event('input', { bubbles: true })); }
    const runButton = root.querySelector('#dataset-run');
    runButton.dataset.unavailable = String(!d.samples.length);
    runButton.disabled = !d.samples.length || ['running', 'progress', 'paused', 'cancelling'].includes(runtime.status);
    const fullButton = root.querySelector('#dataset-full');
    fullButton.dataset.unavailable = runButton.dataset.unavailable;
    fullButton.disabled = runButton.disabled;
  }
  origin();
  function send(row, model) {
    store.incoming = { type: 'explain', sample: structuredClone(row), model: structuredClone(model) };
    location.hash = model.algorithm === 'CNN' ? 'cnn' : 'sequence';
  }
  function draw() {
    if (!current) { out.innerHTML = panel('两套小型真实数据，两个文本场景', '默认100条：70训练 / 10验证 / 20测试。点击运行才生成成绩；没有预填的准确率。', `<div class="panel-body"><h3>酒店评论 · ChnSentiCorp</h3><p>2,944条，正负各1,472；适合观察酒店服务、设施等较完整评论。全量固定2060训练 / 294验证 / 590测试。</p><h3>微博情感 · 短文本</h3><p>5,000条，正负各2,500；保留口语、emoji、话题和网络用语。全量固定3500训练 / 500验证 / 1000测试。</p><p>两套数据均按本项目分词≤128 Token筛选、不截断，全局去重并剔除标签冲突。它们来自不同领域；模型跨数据集分数高低不能单独解释为领域难度或泛化能力。</p><p>先用100条跑通，再点击「使用完整数据集」。清洗平衡的数据已内嵌，断网可运行；原始大CSV不进入离线包。</p><a href="#help/learning" class="btn">查看学习路线 →</a></div>`); return; }
    if (!current.modelNames.includes(selected)) selected = current.modelNames[0];
    const data = current.dataset, stat = current.metrics[selected];
    let rows = current.rows.filter(r => !onlyErrors || r.label !== r.predictions[selected].prediction);
    if (confusion) rows = rows.filter(r => r.label === confusion[0] && r.predictions[selected].prediction === confusion[1]);
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
    const baseline = store.baselines.comparison;
    const comparable = baseline?.result.experimentMode === 'dataset' && baseline.result.dataFingerprint === current.dataFingerprint && baseline.config.seed === current.config.seed;
    out.innerHTML = panel('数据集实验结果 · 实际计算', `${escapeHTML(data.name)} · 总 ${data.samples.length} 条 = 训练 ${data.sampling.train} / 验证 ${data.sampling.validation} / 测试 ${current.rows.length}；下方指标分母仅为测试集。`, `
      <div class="table-wrap"><table class="data-table" id="dataset-metrics"><thead><tr><th>模型</th><th>Accuracy</th><th>Macro-F1</th><th>Precision₁</th><th>Recall₁</th><th>F1₁</th><th>测试分母</th><th>模型版本</th></tr></thead><tbody>${current.modelNames.map(n => { const s = current.metrics[n]; return `<tr><td>${n}</td><td>${pct(s.accuracy)}</td><td>${fmt(s.macroF1, 3)}</td><td>${fmt(s.perClass[1].precision, 3)}</td><td>${fmt(s.perClass[1].recall, 3)}</td><td>${fmt(s.perClass[1].f1, 3)}</td><td>${s.count}</td><td>${escapeHTML(current.models[n].id)}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="panel-body small">${escapeHTML(data.scope ?? '用户导入数据，仅代表这次抽样。')}<br>类别₀=${escapeHTML(data.classes[0])} / 类别₁=${escapeHTML(data.classes[1])}；数据指纹 ${current.dataFingerprint} · 推理 ${fmt(current.elapsedMs, 1)} ms（不含训练 / 渲染）。<br>清洗数据校验 ${escapeHTML(data.provenance?.curatedSHA256 ?? '用户数据快照')}；预处理 ${escapeHTML(data.preprocessing)}。低分如实展示；不得与原始全量基准成绩比较。<br>${escapeHTML(data.sampling.policy)}</div>`)
      + diagnosisHTML(current, selected, 'dataset-diagnosis')
      + panel(`混淆矩阵 · ${selected}`, '行真实类别 / 列预测类别；点击格子筛选下面的样本。', matrixHTML(stat.confusion, { rows: data.classes, cols: data.classes, id: 'dataset-confusion', domain: Math.max(1, ...stat.confusion.flat()), selected: confusion }))
      + panel('测试样本与预测', `筛选 ${rows.length} / 测试 ${current.rows.length} 条；每页最多20条，筛选不改变上方全量指标。`, `
        <div class="filter-row"><label><input type="checkbox" id="dataset-errors" ${onlyErrors ? 'checked' : ''}> 只看错误</label>${button('清空筛选', 'dataset-clear', 'compact')}</div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>文本 / 真实标签</th>${current.modelNames.map(n => `<th>${n}</th>`).join('')}</tr></thead><tbody>${rows.slice(page * 20, page * 20 + 20).map(r => `<tr><td>${escapeHTML(r.text)}<br><small>${escapeHTML(r.id)} · ${escapeHTML(data.classes[r.label])} · ${r.tokens.length} Token</small></td>${current.modelNames.map(n => { const p = r.predictions[n]; return `<td><span class="tag ${p.prediction !== r.label ? 'error' : ''}">${escapeHTML(data.classes[p.prediction])}</span><br><small>${n === 'SVM' ? `margin ${fmt(p.score, 3)}` : `p ${fmt(p.probabilities[p.prediction], 3)}`} · OOV ${p.oov}</small>${n === 'RNN' || n === 'CNN' ? `<br><button class="btn compact" data-dataset-explain="${n}" data-id="${escapeHTML(r.id)}">原模型解释</button>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
        ${rows.length ? '' : '<p class="panel-body">当前筛选没有样本。</p>'}<div class="pagination"><span>第 ${page + 1} / ${Math.max(1, Math.ceil(rows.length / 20))} 页</span><div>${button('上一页', 'dataset-prev', 'compact')}${button('下一页', 'dataset-next', 'compact')}</div></div>`)
      + (Object.keys(current.histories).length ? panel('真实神经模型训练日志', '仅训练集平均 CE；验证集留出，未按测试集挑选轮数。', curveSVG(Object.entries(current.histories).map(([label, h]) => ({ label, values: h.map(v => ({ x: v.epoch, y: v.loss })) })), { xLabel: '训练轮数' })) : '')
      + (baseline ? panel('A / B · 数据集实验对照', comparable ? '相同抽样数据指纹与种子；其他参数变化仍需逐项核对。' : 'A/B 模式、抽样数据或种子不同，不能作为受控数值对照。', comparable ? `<div class="panel-body"><p>${escapeHTML(context.configDiff(baseline.config, config))}</p><div class="table-wrap"><table class="data-table"><thead><tr><th>模型</th><th>A Accuracy</th><th>B Accuracy</th><th>B−A</th></tr></thead><tbody>${current.modelNames.filter(n => baseline.result.metrics[n]).map(n => `<tr><td>${n}</td><td>${pct(baseline.result.metrics[n].accuracy)}</td><td>${pct(current.metrics[n].accuracy)}</td><td>${fmt(current.metrics[n].accuracy - baseline.result.metrics[n].accuracy, 4)}</td></tr>`).join('')}</tbody></table></div></div>` : '<p class="panel-body small">请分别保存结果；更高的小样本测试分数不自动代表模型更好。</p>') : '');
    bindDiagnosis(out, current, selected, (n, row, m) => { if (row) send(row, m); else { selected = n; page = 0; confusion = null; draw(); } }, 'dataset-diagnosis');
    out.querySelector('#dataset-errors').onchange = e => { onlyErrors = e.target.checked; page = 0; draw(); };
    out.querySelector('#dataset-clear').onclick = () => { onlyErrors = false; confusion = null; page = 0; draw(); };
    out.querySelector('#dataset-prev').onclick = () => { page = Math.max(0, page - 1); draw(); };
    out.querySelector('#dataset-next').onclick = () => { page++; draw(); };
    out.querySelectorAll('#dataset-confusion .matrix-cell').forEach(el => el.onclick = () => { confusion = [+el.dataset.row, +el.dataset.col]; page = 0; draw(); });
    out.querySelectorAll('[data-dataset-explain]').forEach(el => el.onclick = () => send(current.rows.find(r => r.id === el.dataset.id), current.models[el.dataset.datasetExplain]));
  }
  async function execute() {
    const { models: previousModels, ...inputConfig } = config;
    const next = { ...inputConfig, experimentMode: 'dataset', operation: 'dataset-training', datasetId: root.querySelector('#dataset-choice').value,
      count: getNumber('dataset-count'), epochs: getNumber('dataset-epochs'), lr: getNumber('dataset-lr'), seed: getNumber('dataset-seed'),
      dim: getNumber('dataset-dim'), hidden: getNumber('dataset-hidden'), batch: getNumber('dataset-batch'),
      modelNames: [...root.querySelectorAll('[name="dataset-model"]:checked')].map(el => el.value), dataset: structuredClone(source()) };
    if (!next.dataset.samples.length) throw new Error('此数据集尚未接入；等待数据文件，不显示成绩');
    if (!next.modelNames.length) throw new Error('至少选择一个模型');
    const result = await run('dataset-experiment', next);
    if (!root.isConnected) return;
    Object.assign(config, next, { dataFingerprint: result.dataFingerprint });
    current = result; selected = result.modelNames[0]; confusion = null; page = 0;
    store.results.datasetLab = current; store.configs.datasetLab = structuredClone(config); store.configs.comparison = structuredClone(config);
    context.setExperiment(config, current, draw); draw(); notify('已完成真实训练与留出测试；案例模式的模型未被替换');
  }
  root.querySelector('#dataset-run').onclick = safe(execute);
  root.querySelector('#dataset-full').onclick = () => { const input = root.querySelector('#dataset-count'); input.value = Math.min(5000, source().samples.length); input.dispatchEvent(new Event('input', { bubbles: true })); };
  root.querySelector('#dataset-choice').onchange = origin;
  root.querySelectorAll('.controls input,.controls select').forEach(el => el.addEventListener('input', () => context.setStatus('stale')));
  if (replay) await execute();
  else if (current) { context.setExperiment(config, current, draw); draw(); }
  else { context.setStatus('idle'); draw(); }
}
