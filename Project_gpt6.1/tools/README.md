# TensorScope 开发与验证工具

六个可操作的中阶 NLP 实验模块：词向量、序列模型、Text-CNN、注意力、多模型对照、损失与优化。计算全部在本地进行，不需要后端、账号、在线模型或 API Key。

## 直接打开

在 Windows 双击 **release/index.html**。保持 `index.html`、`app.js`、`style.css` 在同一个目录；可以整体复制到含中文/空格的路径。`tools/index.html` 是开发入口，需要Vite服务器；服务端把 localhost 首页映射到该文件。

WSL Chromium 已验证真实 `file://`、Blob Worker、导入、导出、中文/空格路径与核心交互。Windows Chrome/Edge **仍需用户实际验收**，不把 WSL 测试称为 Windows 实测。

## 开发和验证（WSL）

在项目根目录先进入 tools。迁移保留了原 node_modules 和锁文件，不需要重新安装；只有新机器首次安装时才运行 npm ci：

```sh
cd tools
# npm ci  # 新机器首次安装时使用
npm run dev
```

Windows 浏览器访问终端显示的地址，默认 `http://localhost:5173`。如 WSL localhost 转发未启用，可使用终端显示的 WSL 地址。

```sh
npm run test:run        # 单次 Vitest，退出并保存 JSON 证据
npm run build:offline   # IIFE + 本地 CSS + 自包含 Blob Worker
npm run test:offline    # 不启动 Vite，真实 file:// + 拒绝意外网络请求
npm run test:e2e        # 同一离线端到端测试套件
npm run test:dev        # 临时 Vite :5187 + 开发入口测试，测试后自动停止
npm run train           # 同源码、固定数据/参数重建内置四模型快照
npm run bench           # Node CPU 目标档基准
npm run bench:browser   # 实际离线 Chromium Worker 基准
npm run notices
npm run check           # 源码语法、依赖位置和离线入口检查
```

已经安装的工具：Node 24.14.0、npm 11.9.0、Vite 8.3.1、D3 7.9.0、Vitest 5.0.2、Playwright 1.63.0。字体更新复用用户已安装的三个 @fontsource 字体包和 KaTeX，没有重新安装依赖或修改锁文件，接入说明见 [font/README.md](font/README.md)。Playwright 浏览器未安装的机器先运行 `npx playwright install chromium`；离线交付网页不需要这些工具。

## 如何验收

1. 注意力：点击权重→检查器；固定 A→编辑掩码→点击格子，查看 B−A；导出 JSON。
2. 损失：运行 η=0.1 后固定 A，再运行 η=8；曲线来自真实更新；点击点查看梯度和参数。
3. 词向量：分别训练 Skip-gram、CBOW、GloVe，定位词、查邻居、词类比，拖拽/缩放/Shift框选。点击「送入 RNN/CNN」，核对覆盖率与分词并明确确认重映射。
4. 序列：选择 RNN/LSTM/GRU，单步/回退/播放，查看门控与最终 CE 对早期状态的真实梯度。长序列案例使用96个 Token。
5. CNN：点击池化值定位原窗口，查看逐项乘加；修改一个核权重，模型产生新版本，旧评测失效。
6. 多模型：输入训练集外文本；筛选错误或点击混淆矩阵；点击 RNN/CNN「解释」，使用同一权重与 Token。
7. 数据：导入自己的 UTF-8 CSV/JSONL/TXT，映射字段→预览→确认，分词/类别不匹配时明确重新训练。
8. 笔记：保存、命名、备注、JSON/CSV/Markdown 导出；导入后重新计算。仅引用数据的记录需重新提供指纹匹配的原文件。

## 数据格式

```csv
text,label,split,group
故事很精彩,正向,train,story-a
体验很糟糕,负向,train,service-a
这是新样本,正向,test,story-b
```

`label` 可省略；无标签不能产生 Accuracy/F1。`split` 可取 `train/validation/test`，省略时按固定指纹哈希分组；`group` 可把同模板句子放在同一集合。CSV 支持引号、转义和引号内换行。JSONL 每行一个 `{text,label,split,group}` 对象，可保留显式 `tokens`。

中文默认确定性字符切分，英文按词；空格模式要求已预分词，不声称是中文词级分词器。类别按字符串排序，模型里保存实际类别顺序。

## 数值与规模边界

- 内置56条原创、AI辅助整理教学句子，固定32/8/16划分；不是外部真实泛化基准。
- 内置模型确实训练过，来源/预算/权重在 `src/data/models.json` 与 `appendix/docs/evidence/training.json`。NB/RNN/CNN 默认概率未校准；SVM 默认显示 margin，可用独立验证集做 Platt 校准。
- 注意力教学映射不证明翻译对齐；小语料词向量不保证经典类比正确；PCA距离不等于原空间距离。
- CPU 双精度透明实现，神经模型训练全部 Embedding、循环/卷积与分类参数，完整 BPTT，无 GPU、无隐藏 API。
- 数据最多50MiB/50,000条；词向量最多1,000,000Token/20,000词/64维；注意力最大1024×1024，矩阵分块；序列解释最多256Token；CNN/神经训练/批量推理最多128Token。超限拒绝，不静默截断。
- 两模式共用数学定义与预算，原理模式推荐低维逐项观察，实验模式使用批量运行和摘要；切换不自动换权重或删除数据。
- localStorage 不可用/容量不足时保留内存会话，必须显式导出。实验导入最多10MiB，同版本重放；跨版本不保证一致。

性能、缺陷与未测档位见 [验收记录](../appendix/docs/acceptance.md)。50,000条与1,000,000Token等拓展档、Windows浏览器、操作系统真实输入延迟和精确峰值内存，未标为通过。

## 目录

`src/algorithms` 数学算法；`src/core` 数值/随机/指标；`src/modules` 六模块和数据/笔记；`src/viz` D3/SVG/Canvas；`src/runtime` 和 `src/workers` 调度；`appendix/tests` 数学、状态与浏览器验证；`tools/scripts` 训练、构建证据与基准；`appendix/docs/evidence` 真正运行的结果和截图；`release` 离线包。

课程要求与项目增强项分别映射到 [需求文档](../appendix/docs/requirements.md)。第三方资源与完整许可证见 `THIRD_PARTY_NOTICES`；论文和网页来源见 [references](../appendix/docs/references.md)。本项目没有执行 Git commit/push 或改动相邻项目。

## 路径与依赖约定

所有工具与依赖只在 tools。根目录没有 node_modules 符号链接，也没有重复安装。tools/paths.mjs 按自身位置定位项目根目录，Vite/Vitest 显式从tools解析D3和KaTeX；tools/font/fonts.css引用已安装的本地字体，离线构建内嵌到style.css。测试通过tools/testing的桥接模块使用同一份测试框架。src/package.json与appendix/tests/package.json只标记ESM，不声明依赖、不需要安装。

根目录也可执行 npm --prefix tools run dev、npm --prefix tools run build:offline、npm --prefix tools run test:run 等。训练输出src/data/models.json；构建输出release；截图/JSON输出appendix/docs/evidence；HTML报告输出appendix/playwright-report；轨迹输出appendix/test-results；缓存只在tools/node_modules。

基准的 --smoke 仅验证入口与输出路径，不等于重新验收所有训练压力档，且写入独立文件，不覆盖此前完整基准：

```sh
npm run bench -- --smoke
npm run bench:browser -- --smoke
```
