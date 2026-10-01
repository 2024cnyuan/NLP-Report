# 验收记录 · 最新更新 2026-10-01

目录迁移后：配置/依赖/脚本在tools，测试/文档在appendix。从根目录使用npm --prefix tools run，或进入tools执行下表npm run命令。迁移验证与证据输出位置见 [structure-migration.md](structure-migration.md)。下表功能验收与完整性能基准保留原始测量范围，短smoke测试不冒充完整压力档重测。

交付范围是六模块 M01–M06 及 I01–I04 的核心可运行实现，不是六张占位卡片。结果来自 algorithms/core；教学随机初始化和AI辅助原创数据明确标识。Windows和未跑的拓展性能目标仍未验收，不将此版本表述为提示词全部平台/预算已完成。

## 执行环境与证据

WSL2 Linux 6.18.33.2、Intel i9-14900HX、WSL可见内存约15.4GiB；Node24.14.0、npm11.9.0、Vite8.3.1、D3 7.9.0、Vitest5.0.2、Playwright1.63.0、Chromium153.0.8010.12。浏览器为headless，不替代Windows人工检查。路径大小写在Windows挂载盘指向同一目录；恢复小写工作路径时沙箱缓存写入曾报EROFS，已通过授权重跑相同项目命令，没有改安全策略。

| 命令 | 实测结果 | 原始证据 |
|---|---|---|
| npm run test:run | 9文件、49测试通过，3.52秒；原41项及新增8项计算链/分析/记录测试 | [unit-results.json](evidence/unit-results.json) |
| npm run train | 四模型完整共享源码训练，快照重建成功 | [training.json](evidence/training.json)、src/data/models.json |
| npm run build:offline | IIFE构建成功，仅index.html/app.js/style.css，普通script | release/ 与tools/vite.config.js |
| npm run test:offline | 计算链最终版34项通过，48.9秒，无失败/跳过/重试；原28项及新增6项计算链/分析/重放回归 | [playwright-results.json](evidence/playwright-results.json)、[HTML报告](../playwright-report/offline/index.html) |
| npm run test:dev | 最终源码Vite ESM入口、指南深链接及本地字体/公式共3项通过，8.1秒；临时服务器测试后关闭 | [playwright-dev-results.json](evidence/playwright-dev-results.json)、[HTML报告](../playwright-report/development/index.html) |
| npm run bench | Node所有目标档实际跑完 | [bench.json](evidence/bench.json) |
| npm run bench:browser | file:// Worker目标档实际跑完，无pageerror/HTTP请求 | [browser-bench.json](evidence/browser-bench.json) |

数学覆盖：稳定softmax/logsumexp/CE；注意力两种打分与mask/维度；独立CNN乘加/ReLU/max、三序列单元、RNN/LSTM/GRU/CNN逐权重梯度；词窗口/负采样/GloVe梯度/训练复现；Logistic有限差分与学习率真实日志；NB/SVM、指标、CSV引号/分组划分、模型导入与同权重预测；极小/极大范数、PCA基底复用、分块同步一致、矩阵文字对比度≥4.5。

离线覆盖：真实file://、拦截并拒绝HTTP/HTTPS、实际Blob Worker、强制Worker失败后的CPU小样例一致；中文与空格路径复制后运行；五尺寸无整页横向溢出；六模块默认/关键参数改变/检查器/对照/三格式下载；自带CSV导入与新模型训练；向量→RNN/CNN→评测→同权重解释；保存→JSON导入→重新计算；训练重放相同权重ID及预测；10轮暂停/恢复/取消；切页与编辑时旧任务不能标成当前有效结果。

## 性能与资源

使用说明和字体更新未改数学定义；本次计算链更新在数学核心新增真实中间值的追踪与派生指标，未重新训练内置模型或修改训练预算，也未重跑下述完整性能基准。这些数值仍是原压力测试结果，不代表加入字体、KaTeX和计算链后的加载耗时、峰值内存或性能重测。

浏览器实测：100kToken/V5000/d32 Skip-gram单轮约7.27秒；四模型10k条×128Token/d8h8约9.09秒；256²d32注意力约90ms；5000次Logistic更新约832ms；2000条×64Token/d32h32 RNN单轮约60.1秒、CNN约9.9秒。所有压力输入仅证明吞吐，不报告语义准确率。20轮取消p95约31ms。详细范围与未测条件见 [performance.md](performance.md)。

真实训练的5000向量另行Canvas展示，搜索word4999与全词检索、邻居表可操作。10轮切页后强制GC：监听器/节点没有明显持续增长，堆允许2MiB差额且通过。原始计数与可见DOM元素数量见 [canvas-resources.json](evidence/canvas-resources.json)。这是后GC快照，不是峰值内存或长期无泄漏证明。

## 实际视觉检查

已实际查看首页、六模块1440截图、注意力A/B、390窄屏多模块、CSV预览/错误状态、5000点图、空笔记、锁定检查器、演示视图与真实暂停状态；注意力1920/1440/1366/768/390五尺寸生成并实际查看。矩阵可局部横向滚动，输入/运行/说明仍可访问；手机不同时展示完整矩阵。固定种子，截图禁用过渡动画避免768截图捕获侧栏移动中间帧，并隐藏短暂toast。没有声称全站所有颜色/控件都已通过完整WCAG审计。

修复了首页迷你曲线黑填充、发散色带与文字对比度、CNN控制区维度与实际模型不一致、A/B巨大权重文本、散点标签碰撞、截图滚动导致固定导航落在画面中间等问题。截图位于evidence/*png。

## 使用说明页更新验收

使用说明新增8章目录、章节深链接、返回目录、六模块入口、3张内嵌SVG示意图、注意力掩码A/B逐步例子，以及本地生成的8条CSV示例。图中明确标识为操作/布局示意，不冒充实测结果；release仍只有原3文件，不依赖外部图片或网络。算法、模型、依赖与根目录README未改。

新增4项离线测试验证：全部章节键盘跳转与焦点、目录高亮、刷新/浏览器前进后退、未知章节回退；从指南进入注意力并屏蔽「理解→语言」、核对权重为0和行和为1后保存笔记；示例CSV下载、8条预览确认和真实重新训练；六模块入口与1440/768/390布局，手机图内可横向滚动且无整页溢出。四项均拦截HTTP/HTTPS，未发现请求或pageerror；完整26项离线回归通过。开发测试增加相同指南深链接与模块入口检查，共2项通过；单元测试38项通过，语法/引用检查52个JS/MJS通过。

已实际查看 [桌面指南](evidence/help-1440.png)、[平板指南](evidence/help-768.png)、[手机指南](evidence/help-390.png)，以及三种尺寸的help-example截图；另查看 [界面示意](evidence/help-workspace-1440.png)、[模块流程图](evidence/help-workflow-1440.png)、[数据导入说明](evidence/help-data-1440.png)、[笔记说明](evidence/help-notebook-1440.png)。按平板截图调整了章节滚动留白，避免上一节文字露在固定顶栏下方。

browser-use在本地file://下返回空的元素索引列表，但DOM读取证实页面已正确加载；重开仍如此。改用它的DOM点击/读取核验导入章节，实测hash为#help/data、焦点help-data、顶端约93.6px、目录高亮匹配且有3张图。正式点击、键盘、前进后退与离线验收以Playwright结果为准，未安装新浏览器或使用云服务。构建曾因沙箱EROFS失败，授权后使用相同构建命令成功；未改安全策略。Windows实机人工验收仍未执行。

## 本地字体与公式更新 · 2026-10-01

复用用户已安装在tools/node_modules的@fontsource/inter、@fontsource/noto-sans-sc、@fontsource/jetbrains-mono（均5.3.0）及katex（0.18.10），没有重新安装、升级或改动tools/package.json/package-lock.json。tools/font存放字体引用与构建接入配置；src/styles/typography.css负责界面字体分工。THIRD_PARTY_NOTICES已纳入字体OFL和KaTeX MIT许可原文，共39个包。

中文正文为Noto Sans SC（400/500/700），英文/普通数字为Inter（400/500/600/700），代码/JSON为JetBrains Mono（400/600），中文代码注释回退Noto Sans SC。使用实际静态字重，未将文件伪装为可变字体。矩阵、刻度和指标使用Inter等宽数字；Canvas词向量标签从界面继承字体，在字体加载后重绘并保留销毁保护。

六模块检查器的20种既有公式使用KaTeX原配字体排版，提供MathML及可展开的纯文本原文；数学运算及输出数值不变。只对已知公式提供明确LaTeX映射，未知或排版失败时保留转义后的原文，不执行用户公式代码。较长公式在卡片内部滚动，不扩展整页宽度。

离线构建仍只有index.html/app.js/style.css；字体原字节作为29个WOFF2 data URL内嵌，不经CDN、不另行请求字体。实测app.js 631,353字节，style.css 5,222,686字节；简体中文字形未裁剪，内嵌字体使CSS明显增大。仅保留WOFF2避免同一字体重复嵌入WOFF/TTF，面向当前Chromium；未验证旧浏览器兼容性。

41项单元测试通过，新增测试覆盖全部20种公式的KaTeX/MathML输出、未知/恶意原文安全回退，以及WOFF2筛选规则。28项离线测试通过，新增用Chromium实际字形资源统计验证Noto Sans SC、Inter、JetBrains Mono和六模块KaTeX均使用自定义字体，而非只检查CSS声明。全部字体URL内嵌、HTTP/HTTPS拦截记录为空，无pageerror；展开公式原文后实测Mono，数值检查器仍显示原数据。3项开发页面测试通过，字体加载和公式在Vite入口也正常；语法/引用/依赖与目录检查56个JS/MJS通过。

已实际查看[中文与代码桌面截图](evidence/typography-code-1440.png)、[公式桌面截图](evidence/typography-formula-1440.png)、[公式平板截图](evidence/typography-formula-768.png)、[公式手机截图](evidence/typography-formula-390.png)及[browser-use注意力检查器截图](evidence/typography-browser-use.png)。browser-use本地state仍返回空元素索引，使用文档支持的DOM读取/点击确认页面、公式和已加载字体；未使用云浏览器，正式回归以Playwright为准。Windows Chrome/Edge人工验收仍未执行。

本次历史失败：初始构建筛选未作用于被导入的KaTeX CSS，产生重复旧格式字体，改为PostCSS规则后29个URL全部为WOFF2；新增字体检测首次因未启用CSS调试通道失败，启用后通过；随后KaTeX祖先容器没有直接文本，字体统计为空，改为实际含字形的mathnormal节点；跨模块测试保留的检查器遮住下一模块按钮导致点击超时，按正常操作关闭检查器再切换，未使用强制点击绕过。最终完整28项回归通过，失败记录在此保留。

## 真实计算链与结果分析更新 · 2026-10-01

Attention、CNN、序列页面新增“本次计算链”和数值分析，不以动画生成结果。algorithms/explanations从本次完成结果及真实权重推导代入说明与指标；components/computation只渲染和绑定检查器。原前向/反向数学定义保留，现有全权重有限差分、推理/可微一致、训练和离线回归继续验证；没有新增依赖或修改package/锁文件。

- Attention：Q/K/V → 掩码前rawScores → 应用mask的scores → 稳定Softmax及整行分母 → 选中连接的贡献 → 加权输出。分块路径保留全部rawScores；点击权重切换连接，点击输出或选择维度同步更新计算链。
- CNN：真实Embedding窗口（短文本显式补零）→ 每项乘积及偏置 → ReLU → max与真实winner位置 → 全池化特征的分类乘加 → 所选类别概率。移动窗口、选择核或点击分类概率与计算链联动，修改权重后重新执行相同数学核心。分类所用target也随配置保存，避免解释来源丢失后改变记录中的损失口径。
- LSTM：选中Token的x与前一h/c → 四门真实preactivations和激活值 → c更新的保留项/写入项 → 当前h → 继续递推后的末步完整h → 分类及最终CE反向梯度。可以选择状态维度及解释类别；不把当前步单个状态冒充最终分类输入，也不把时间轴的h₀零状态冒充第一个Token计算。RNN/GRU原功能继续保留，播放仍只浏览已计算轨迹。LSTM依然是明确标识的教学初始化，未扩充训练工作台为LSTM模型。

分析显示Attention平均行熵、最大行和误差、输出范数和屏蔽数；CNN实际分类概率、池化范数、正激活比例和OOV；序列末步h/c范数、目标CE及首步/末步/全参数梯度范数。小的非零数使用科学计数法，避免显示成精确0。匹配输入、维度、算法及适用目标口径时列出B−A；不匹配时明确拒绝逐项指标对齐。这些指标不自动证明语义能力、泛化改善或现实因果。

三模块保存和JSON/Markdown导出包含分析及现有A基线的输入、权重、结果。笔记展示已保存指标与差值，Markdown包含可读指标表，不再只有原始JSON。外部分析先标未核验；重放先验证baseline.config并通过同一Worker重新计算A，再用原输入和权重重算B，忽略导入的baseline.result成绩。旧记录无analysis/baseline字段时仍可运行后另存；没有自动改写用户历史记录。双结果会增加记录体积，20条持久存储与10MiB导入上限未放宽。

掩码的−Infinity在新保存的结果/基线快照中明确编码为字符串，与JSON导出一致，避免直接从本地笔记重放时被有限值校验拒绝或被localStorage变为null。复算中的离页保护同时检查记录列表、页面及即时hash，旧重放不能把用户从首页拉回实验页。

新增8项单元测试覆盖独立手算Attention打分/掩码/归一化/贡献、加性与分块轨迹一致、CNN乘积/池化/短文本/类别切换、LSTM门控仿射/c/h/末步/梯度、目标只改变损失与梯度、指标与不可比口径、结果不被说明修改、极小梯度显示、可保存的掩码记录及独立A快照。共9文件49项通过；公式测试覆盖原有及计算链共41种已知公式的KaTeX/MathML输出。

新增6项离线测试覆盖三模块真实输出与链上数值对应、参数修改后旧结果不伪变且禁止保存、重算后变化、输出/状态维度和类别联动、A/B指标、分析报告与刷新保留、篡改导入的成绩后双方仍复算、CNN/LSTM原权重双结果重放，以及先确认runId真的增加再验证立即离页不被旧任务跳回。新增测试拒绝HTTP/HTTPS且无pageerror。最终34项全部通过，开发3项通过，语法/引用/依赖目录61个JS/MJS检查通过；统计以上表和JSON报告为准。开发/离线HTML与轨迹现在分别放在各自offline/development子目录，并行回归各自成功，没有再次覆盖轨迹。

已实际查看[Attention计算链](evidence/computation-attention-chain.png)、[CNN计算链](evidence/computation-cnn-chain.png)、[LSTM计算链](evidence/computation-lstm-chain.png)，以及三模块桌面完整页面、LSTM 768/390窄屏截图。完整截图先回到页面顶部，细节截图暂时隐藏固定顶栏和toast，避免遮住卡片，不改变计算结果。browser-use本地state仍为空索引，按其DOM读取/点击方法实际运行LSTM，四门显示值与真实states[0].gates一致，并保存[浏览器检查截图](evidence/computation-browser-use.png)，会话检查后关闭。正式回归以Playwright为准。Windows Chrome/Edge、完整压力预算、加入计算链后的严格FPS/加载耗时/峰值内存仍未验收。

本次失败与修复：开发测试与离线测试并行共用轨迹目录，曾在关闭上下文时ENOENT，改为独立输出/HTML目录后重跑；新增分析标题使旧A/B正则定位出现严格歧义，限定原实验h2，保留断言；旧笔记数量定位也改为直接子记录，等待实际导入完成。JSON把−0写为0，权重比对改为同一序列化口径，未改变数学权重。新增概率点击检查发现CNN计算链仍显示预测类别，补齐选中类别联动；检查本地掩码记录发现−Infinity校验问题，改为显式可携带编码。离页检查首版未确认实际启动，加入runId断言后发现hashchange事件前旧store.page仍是notebook，复算完成会跳回旧页；加入即时hash校验修复，保留该回归。不删除失败用例，也不把早期通过报告称为最终版本结果。

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
