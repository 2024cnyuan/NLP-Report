# 架构与契约

源码：原生 HTML/CSS/ESM JS。D3 只负责比例尺、图形、等高线。Vite 8 库模式输出 IIFE；Worker 内联成自包含 Blob；开发使用 Vite，交付不依赖服务器、CDN、字体或 fetch。

app 导航与全局工具 → modules 实验流程 → algorithms 纯数学 → core 数学/随机/反向传播。runtime 单重任务调度，workers 批次执行。viz/charts 与 components/ui 只渲染真结果。

- Dataset：schema=1，id/source/license/preprocessing/samples；samples={id,text,tokens,label,split,group}，空标签代表未标注。
- ModelArtifact：schema=1，algorithm/structure/vocab/classes/weights/trainConfig/source/version/id。权重形状和有限值必须验证。
- ExperimentConfig：module/mode/seed/params/data 与模型；fingerprint 用于结果失效。
- TraceStep：step/op/input/output/shape/upstream。单样本按需重算；批处理不保留完整 trace。
- RunResult：真实结果、状态、processed、elapsedMs/configFingerprint。不同模块结果含对应真实轨迹。
- Checkpoint：weights/optimizer/randomState/dataPosition/version；记录不等于任意跨版本可复现。

runId 唯一递增，客户端丢弃过期 Worker 消息；配置改变标 stale；切页任务可继续，视图回调受页面版本保护。训练迭代、序列步和播放步互不混用。

安全：用户内容经 escapeHTML，文件有限大小、shape 与值校验，不 eval。localStorage 不可用则内存会话与显式导出。
