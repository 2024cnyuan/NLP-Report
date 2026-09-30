# TensorScope｜NLP 原理实验室

六个可操作的NLP中阶实验：词向量、序列模型、Text-CNN、注意力、多模型对照、损失与优化。计算在本地完成，没有后端、在线模型或API Key。

## 离线演示

在Windows双击 [release/index.html](release/index.html)。保持同目录的app.js和style.css完整；不需要启动Vite或安装Node。可以整体复制release文件夹到中文或空格路径。

已在WSL Chromium验证真实file://、Blob Worker和核心交互；Windows Chrome/Edge仍需人工验收，不冒充已经测试。

## 项目结构

- release/：最终演示包。
- src/：实际应用源码、算法、教学数据和真实模型快照。
- tools/：开发入口、依赖、构建与测试配置、训练/基准脚本。
- appendix/：测试源码、截图、验收记录、报告材料及原始prompt。
- THIRD_PARTY_NOTICES：第三方来源与完整许可证。
- AGENTS.md：以后修改项目时遵守的协作约定。

## 继续开发

从项目根目录执行：

```sh
npm --prefix tools run dev
npm --prefix tools run check
npm --prefix tools run test:run
npm --prefix tools run build:offline
npm --prefix tools run test:offline
```

开发入口通常为 http://localhost:5173，终端地址为准。开发配置位于tools，不能双击tools/index.html代替离线入口。

原有依赖已整体保存在tools/node_modules，版本与锁文件未升级，无需重新安装。新机器需要安装时执行 npm --prefix tools ci；开发网页需要Node，离线演示包不需要。

详细命令、数据格式和规模限制见 [工具说明](tools/README.md)。测试及课程材料见 [附录说明](appendix/README.md)、[验收记录](appendix/docs/acceptance.md)、[演示脚本](appendix/docs/demo-script.md)。

内置数据是56条原创、AI辅助整理教学句子，不是泛化基准；教学初始化与实际训练权重明确区分。Windows验收、更大规模拓展档、严格FPS和精确峰值内存仍有未测项，详见验收记录。
