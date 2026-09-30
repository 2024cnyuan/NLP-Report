# 验收记录 · 2026-09-30

目录迁移后：配置/依赖/脚本在tools，测试/文档在appendix。从根目录使用npm --prefix tools run，或进入tools执行下表npm run命令。迁移验证与证据输出位置见 [structure-migration.md](structure-migration.md)。下表功能验收与完整性能基准保留原始测量范围，短smoke测试不冒充完整压力档重测。

交付范围是六模块 M01–M06 及 I01–I04 的核心可运行实现，不是六张占位卡片。结果来自 algorithms/core；教学随机初始化和AI辅助原创数据明确标识。Windows和未跑的拓展性能目标仍未验收，不将此版本表述为提示词全部平台/预算已完成。

## 执行环境与证据

WSL2 Linux 6.18.33.2、Intel i9-14900HX、WSL可见内存约15.4GiB；Node24.14.0、npm11.9.0、Vite8.3.1、D3 7.9.0、Vitest5.0.2、Playwright1.63.0、Chromium153.0.8010.12。浏览器为headless，不替代Windows人工检查。路径大小写在Windows挂载盘指向同一目录；恢复小写工作路径时沙箱缓存写入曾报EROFS，已通过授权重跑相同项目命令，没有改安全策略。

| 命令 | 实测结果 | 原始证据 |
|---|---|---|
| npm run test:run | 7文件、38测试通过，独立有限差分epsilon=1e-6、误差目标1e-5 | [unit-results.json](evidence/unit-results.json) |
| npm run train | 四模型完整共享源码训练，快照重建成功 | [training.json](evidence/training.json)、src/data/models.json |
| npm run build:offline | IIFE构建成功，仅index.html/app.js/style.css，普通script | release/ 与tools/vite.config.js |
| npm run test:offline | 22项通过，23.6秒，无失败/跳过/重试；六模块、Worker、无网、导出、重放、资源回收、异步安全 | [playwright-results.json](evidence/playwright-results.json) |
| npm run test:dev | Vite ESM入口1项通过；临时服务器测试后关闭 | [playwright-dev-results.json](evidence/playwright-dev-results.json) |
| npm run bench | Node所有目标档实际跑完 | [bench.json](evidence/bench.json) |
| npm run bench:browser | file:// Worker目标档实际跑完，无pageerror/HTTP请求 | [browser-bench.json](evidence/browser-bench.json) |

数学覆盖：稳定softmax/logsumexp/CE；注意力两种打分与mask/维度；独立CNN乘加/ReLU/max、三序列单元、RNN/LSTM/GRU/CNN逐权重梯度；词窗口/负采样/GloVe梯度/训练复现；Logistic有限差分与学习率真实日志；NB/SVM、指标、CSV引号/分组划分、模型导入与同权重预测；极小/极大范数、PCA基底复用、分块同步一致、矩阵文字对比度≥4.5。

离线覆盖：真实file://、拦截并拒绝HTTP/HTTPS、实际Blob Worker、强制Worker失败后的CPU小样例一致；中文与空格路径复制后运行；五尺寸无整页横向溢出；六模块默认/关键参数改变/检查器/对照/三格式下载；自带CSV导入与新模型训练；向量→RNN/CNN→评测→同权重解释；保存→JSON导入→重新计算；训练重放相同权重ID及预测；10轮暂停/恢复/取消；切页与编辑时旧任务不能标成当前有效结果。

## 性能与资源

浏览器实测：100kToken/V5000/d32 Skip-gram单轮约7.27秒；四模型10k条×128Token/d8h8约9.09秒；256²d32注意力约90ms；5000次Logistic更新约832ms；2000条×64Token/d32h32 RNN单轮约60.1秒、CNN约9.9秒。所有压力输入仅证明吞吐，不报告语义准确率。20轮取消p95约31ms。详细范围与未测条件见 [performance.md](performance.md)。

真实训练的5000向量另行Canvas展示，搜索word4999与全词检索、邻居表可操作。10轮切页后强制GC：监听器/节点没有明显持续增长，堆允许2MiB差额且通过。原始计数与可见DOM元素数量见 [canvas-resources.json](evidence/canvas-resources.json)。这是后GC快照，不是峰值内存或长期无泄漏证明。

## 实际视觉检查

已实际查看首页、六模块1440截图、注意力A/B、390窄屏多模块、CSV预览/错误状态、5000点图、空笔记、锁定检查器、演示视图与真实暂停状态；注意力1920/1440/1366/768/390五尺寸生成并实际查看。矩阵可局部横向滚动，输入/运行/说明仍可访问；手机不同时展示完整矩阵。固定种子，截图禁用过渡动画避免768截图捕获侧栏移动中间帧，并隐藏短暂toast。没有声称全站所有颜色/控件都已通过完整WCAG审计。

修复了首页迷你曲线黑填充、发散色带与文字对比度、CNN控制区维度与实际模型不一致、A/B巨大权重文本、散点标签碰撞、截图滚动导致固定导航落在画面中间等问题。截图位于evidence/*png。

## 失败及修复记录

- 首次IIFE构建遇到top-level await，改为异步初始化函数调用，移除动态import。
- 浏览器发现小数stepMismatch，数字控件小数使用any、整数保留1。
- CBOW追踪的中心向量不是实际更新对象，改为真实上下文源向量；GloVe保存更新前输入与偏置；不同目标损失不共轴。
- 词向量与分类预处理不匹配时须显式重映射；导入数据不兼容原模型时保留训练控件，不能以异常覆盖整个页面。
- 实验导入NB列预算过严已修正；未核验导入成绩不允许直接固定为A。
- 运行中改参数、切页的旧完成结果曾错误标新，使用runId/页面代次/输入版本保护。
- 浏览器基准发现诊断接口漏导入run，修正后完成目标档。
- 新增5000点测试首次失败为重复图例的严格定位歧义，限定图例后原功能通过；未删除用例。
- 单轮训练只有一个损失记录，线段不可见，补真实数据点；新增断言曾使用不存在的图表ID，已修正定位，保留检查。
- 六模块导出测试发现多模型A/B配置摘要对缺失dataset求指纹导致异常，修正空值处理与实际实验配置比较，保留A/B回归测试。
- 错误文件及字段变化后仍留旧确认按钮，清空候选预览；增加导入版本/离页保护，旧异步文件不覆盖新预览。

最终报告覆盖历史跑分；历史失败原因在此保留，不声称测试从未失败。

## 未测与限制

Windows Chrome/Edge断网人工验收；50,000条/50MiB、百万Token/20k词、20k Canvas、1024²注意力；真实硬件输入p95、严格FPS、后台页与精确峰值内存未测。数据最大值是校验预算，不是实测吞吐保证。不能任意中断断电后续训；暂停是同一Worker内存恢复。CSV读取与数据构建在Worker内完成，但此版本不提供50MiB流式分块解析；模型跨版本重放不保证完全一致。默认神经教学模型分数较低且如实展示。

下一步由用户在Windows断网双击release/index.html，按 [demo-script.md](demo-script.md) 验收，填写实际浏览器版本和发现的问题。正式报告/PPT、学生资料与其他大模型过程材料待小组人工补充。
