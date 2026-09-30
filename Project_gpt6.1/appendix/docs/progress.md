# 当前进展

六个模块 M01–M06 与 I01–I04 的核心算法、交互和离线包均已实现，不是仅交付注意力样板。共享数学层、真实训练快照、自带数据、四模型批量评测、同模型解释、实验导出重放可运行。保留现有依赖和锁文件，没有新增包；父仓库及相邻目录的用户改动未触碰，没有执行 Git 写命令。

2026-09-30最终回归：38项单元测试通过；训练脚本重建四模型；IIFE离线构建成功；22项离线浏览器测试全部通过（23.6秒）；Vite开发入口1项浏览器测试通过（5.9秒）。源码/脚本/测试全部通过node --check语法检查。完整交互与额外Canvas/资源测试的最终结果见 acceptance.md 与 evidence 下的原始JSON。目标档 Node/Chromium Worker 基准已运行。

交付仍有明确边界：Windows Chrome/Edge 待用户验证；50k样本、百万Token、1024²注意力等拓展档未验收；真实硬件输入延迟、严格FPS、峰值内存未测。模板入门/中阶口径与学生资料、其他大模型辅助对比材料需小组人工补充。不能据核心完成推导整个提示词所有性能/平台目标均验收。

目录已整理为src/release/tools/appendix，命令从根目录使用npm --prefix tools run，或进入tools使用npm run。迁移验证见structure-migration.md。

下一项：Windows断网双击 release/index.html，按 appendix/docs/demo-script.md 验收并记录实际浏览器版本；根据真实自带语料选择训练预算，不将内置教学分数当作泛化结论。
