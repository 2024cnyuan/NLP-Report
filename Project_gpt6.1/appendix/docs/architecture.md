# 架构与契约

源码：原生 HTML/CSS/ESM JS。D3 只负责比例尺、图形、等高线。Vite 8 库模式输出 IIFE；Worker 内联成自包含 Blob；开发使用 Vite，交付不依赖服务器、CDN、外部字体文件或 fetch。界面字体及KaTeX字体已内嵌到style.css。

目录分离：应用源码src，离线release，开发工具/依赖/配置tools，测试与证据appendix。tools/paths.mjs统一绝对定位；Vite/Vitest显式解析tools内D3，测试框架由tools/testing桥接。src与appendix/tests中的小型package.json仅标记ESM，不安装重复依赖。root的localhost入口映射tools/index.html，生产仍普通IIFE script。

app 导航与全局工具 → modules 实验流程 → algorithms 纯数学 → core 数学/随机/反向传播。runtime 单重任务调度，workers 批次执行。viz/charts 与 components/ui 只渲染真结果。

- Dataset：schema=1，id/source/license/preprocessing/samples；samples={id,text,tokens,label,split,group}，空标签代表未标注。
- ModelArtifact：schema=1，algorithm/structure/vocab/classes/weights/trainConfig/source/version/id。权重形状和有限值必须验证。
- ExperimentConfig：module/mode/seed/params/data 与模型；fingerprint 用于结果失效。
- TraceStep：step/op/input/output/shape/upstream。单样本按需重算；批处理不保留完整 trace。
- RunResult：真实结果、状态、processed、elapsedMs/configFingerprint。不同模块结果含对应真实轨迹。
- Checkpoint：weights/optimizer/randomState/dataPosition/version；记录不等于任意跨版本可复现。

runId 唯一递增，客户端丢弃过期 Worker 消息；配置改变标 stale；切页任务可继续，视图回调受页面版本保护。训练迭代、序列步和播放步互不混用。

安全：用户内容经 escapeHTML，文件有限大小、shape 与值校验，不 eval。localStorage 不可用则内存会话与显式导出。

## 可检查计算链与分析

algorithms/attention保留掩码前rawScores和实际scores；algorithms/neural的LSTM trace保留真实仿射preactivations。algorithms/explanations从已完成的结果、真实权重和选中的连接/窗口/时间步构建代入说明；不会从尚未提交的控件推算新结果。它计算行熵、范数、激活比例与A/B差值，components/computation只负责渲染、检查器绑定和报告格式。

新记录analysis是同一次完成结果的分析；baseline包含适用A基线的输入、权重和结果，不另立算法版本。缺少新字段的旧记录仍可重放。外部记录中的分析与baseline.result不作为真实成绩：runtime/replay先用baseline.config通过同一Worker重新计算A，再由模块重算B，只有重新计算的结果用于页面对照。没有将LSTM教学初始化标为已训练模型，也未扩充四模型工作台的算法范围。
