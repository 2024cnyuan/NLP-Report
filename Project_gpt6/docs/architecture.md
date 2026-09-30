# 架构与数据契约

当前项目使用 Vite 8、模块化 JavaScript、CSS、Vitest。`src/core` 只计算，`src/runtime` 管理 Worker，`src/data` 处理记录，`src/modules` 实现模块交互，`src/main.js` 管理导航；无后端。开发入口是源码 ESM，`scripts/build-offline.mjs` 将 Vite 的 IIFE 与 CSS 写入自包含 `release/index.html`。M04 Worker 使用同一个 `attentionKernel` 函数源码构建 Blob；M06 Worker 在构建时嵌入同一核心源码。如浏览器拒绝 Worker，则运行同一主线程参考实现。取消可终止当前 Worker，但暂停与多任务调度尚待完善。

数据结构版本 1。M04 的 `ExperimentConfig` 含 `queries/keys/values`（有限数二维数组）、`method`、`masked`；`RunResult` 含 `scores/weights/outputs`，每行维度取输入的实际长度。M06 的输入是样本数组、学习率、迭代数和固定初值；每个轨迹点保存实际权重、梯度、全量平均损失。`ExperimentRecord` 目前只在 M04 支持本地保存，含原文、Token、参数、结果、数据指纹、算法版本、向量映射标识、时间与备注。记录最多保存在本地 30 条；导入仅重算配置，不信任文件声称的结果。未来通用 `Dataset`、`ModelArtifact`、`Checkpoint` 契约尚未实现。

状态：`idle → validating → running → completed`；输入变更进入 `stale`，异常进入 `failed`。每次运行附 `runId`，旧响应不会覆盖新结果。页面切换终止 Worker。当前 A/B 对比只在 Token 顺序和维度完全一致时计算逐格差值；两次计算使用相同确定性向量映射。实验模式 128×128 全量计算、16×16 展示。

现阶段重放保障限于相同算法版本和映射规则。跨版本精确重放需要保留对应旧版实现或模型权重，本项目尚未提供。
