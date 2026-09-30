# 需求映射

原始题目与模板已从相邻 Request 目录只读读取。没有“作业题目(1).docx”，使用无括号副本。课程要求纯前端、直接打开HTML、算法有效、来源声明与报告；中阶建议至少三个。本项目主动选择六模块与四项交互增强，不宣称均由老师规定。

“已验收”仅指此处列出的参考环境与核心用例，不能推导Windows或拓展档通过。原始JSON见 [验收记录](acceptance.md)。下表算法/模块路径相对src，测试位于appendix/tests，开发配置和脚本位于tools。

| ID | 来源 | 实现文件 | 用例/证据 | 状态 |
|---|---|---|---|---|
| M01 | 题目3.2 / prompt7 | algorithms/embeddings.js、modules/embeddings.js、viz/scatter.js | embeddings.test；三算法训练/检索/A/B；5000 Canvas；bench | 已验收 |
| M02 | 同上 | algorithms/neural.js、modules/sequence.js | neural.test 三结构手算/逐参数梯度；步进回退/96步/对照 | 已验收 |
| M03 | 同上 | algorithms/neural.js、modules/cnn.js | 卷积/激活/max手算、梯度、真实训练；池化→原窗口、改权重 | 已验收 |
| M04 | 同上 | algorithms/attention.js、modules/attention.js | 两打分/缩放/mask/分块；检查器、显式QKV、A/B | 已验收 |
| M05 | 同上 | algorithms/classifiers.js、modules/comparison.js | NB/SVM/指标；新文本、混淆筛选、真实训练/重放/四模型批量 | 已验收 |
| M06 | 同上 | algorithms/optimization.js、modules/optimization.js | 手算/有限差分、三学习率日志；曲线/检查器/5000更新 | 已验收 |
| I01 | 项目增强 | components/ui.js 与六模块 | 数值→实际输入/索引/公式；CNN池化追溯窗口；持久检查器 | 已验收 |
| I02 | 项目增强 | app/main.js 与六模块 | 固定A/差异/共享轴域/差值；六模块对照用例 | 已验收 |
| I03 | 项目增强 | modules/{embeddings,comparison,sequence,cnn}.js | 向量→显式重映射→训练→评测；预测→同权重解释 | 已验收 |
| I04 | 项目增强 | data/{store,validation}.js、modules/notebook.js | 六模块JSON/CSV/MD下载；导入校验、训练重放同权重/预测 | 已验收 |
| OFFLINE | 课程 / prompt9 | tools/vite.config.js、runtime/client.js、workers/compute.js、release | 真实file://，无HTTP，自包含Blob Worker，CPU回退、中文空格路径 | 已验收 |
| DATA | 项目增强 | data/datasets.js、modules/data.js | TXT/CSV/JSONL/JSON，字段映射/预览/错误、分组隔离、新数据训练 | 已验收 |
| PERF-TARGET | 项目增强 | tools/scripts/{bench,browser-bench}.mjs、scale.spec | Node/浏览器目标档、5000点、10轮回收；范围见performance | 已验收 |
| RESPONSIVE | 项目视觉规范 | styles、viz、components | 五尺寸注意力、六模块390；实际看过截图、矩阵文字对比度测试 | 已验收 |
| WIN | Windows最终人工验收 | release/index.html | 尚未在真实Windows Chrome/Edge打开 | 已实现待验收 |
| PERF-EXT | 拓展压力档 | 算法预算校验与Worker | 50k条/百万Token/20k向量/1024²未跑，FPS/峰值未测 | 已实现待验收 |
| REPORT | 模板 / prompt13 | README、appendix/docs/report-notes、demo-script、THIRD_PARTY_NOTICES | 真实数据/权重/截图/测试与来源素材已提供，正式Word/PPT和小组身份待人工填写 | 已实现待验收 |

模板末尾同时列入门≥4、中阶≥3，需小组向老师确认口径；不额外实现四个入门模块，不擅自填学生身份、其他模型对话、实际成绩。
