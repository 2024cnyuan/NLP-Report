# TensorScope 协作约定

- 以 `prompt.md` 为项目目标；课程原始范围以 `原始题目/作业题目.docx` 为准。不要把项目增强目标写成教师硬性要求。
- 保留用户在父目录及仓库中的未提交改动；不执行 commit、push、checkout、reset、clean。
- 数值结果必须来自 `src/core` 的真实计算。改算法时同步更新可手算测试、版本号及 `docs/algorithm-specs.md`。
- 交付以 `npm run build:offline` 生成 `release/index.html`；用 `file://` 实测，不能只以 Vite 预览作为离线证据。
- 任何未实测的模块或性能档位在 `docs/progress.md` 标明真实状态。Windows Chrome/Edge 结果需用户本机验证。
