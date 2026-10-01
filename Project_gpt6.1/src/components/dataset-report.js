import { diagnose } from '../algorithms/diagnosis.js';
const text = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
const number = v => v == null ? '—' : v.toFixed(4);
export function datasetReportMarkdown(result) {
  if (result?.experimentMode !== 'dataset') return '';
  const d = result.dataset, s = d.sampling;
  return `## 数据集实验\n\n数据集：${text(d.name)}\n\n来源：${text(d.source)}\n\n原始来源：${text(d.homepage ?? '用户导入')}\n\n清洗文件：${text(d.provenance?.curatedFile ?? '用户快照')}\n\n清洗SHA-256：${text(d.provenance?.curatedSHA256 ?? '无内置校验')}\n\n划分策略：${text(s.policy)}\n\n范围：${text(d.scope ?? '用户数据的分层抽样')}\n\n许可说明：${text(d.license)}\n\n总样本 ${s.count}；训练 ${s.train} / 验证 ${s.validation} / 测试 ${s.test}。种子 ${s.seed}。词表仅拟合训练集，验证集本轮未参与训练，指标仅用测试标签。\n\n### 测试结果\n\n| 模型 | Accuracy | Macro-F1 | 分母 |\n| --- | ---: | ---: | ---: |\n${result.modelNames.map(n => `| ${n} | ${number(result.metrics[n].accuracy)} | ${number(result.metrics[n].macroF1)} | ${result.metrics[n].count} |`).join('\n')}\n\n${result.modelNames.map(n => {
    const a = diagnose(result.rows, n);
    return `### 错误诊断 · ${n}\n\n错分 ${a.errors} / ${a.count}；错误率 ${number(a.errorRate)}；OOV Token 占比 ${number(a.oovRate)}。\n\n${a.directions.map(v => `${text(d.classes[v.trueLabel])} → ${text(d.classes[v.predictedLabel])}：${v.count} 条`).join('；')}。\n\n| 切片 | 样本数 | 错分数 | 错误率 |\n| --- | ---: | ---: | ---: |\n${a.slices.map(v => `| ${v.label} | ${v.count} | ${v.errors} | ${number(v.errorRate)} |`).join('\n')}\n\n${text(a.limits)}\n`;
  }).join('\n')}\n成绩只代表当前清洗平衡子集与训练配置，不等于原始酒店/微博数据集全量基准成绩；跨领域分数差异不自动证明泛化能力。\n`;
}
