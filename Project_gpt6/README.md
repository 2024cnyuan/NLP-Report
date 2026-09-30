# TensorScope｜NLP 原理实验室

课程大作业开发中。当前可运行 **M04 注意力机制**与 **M06 损失与优化**。M04 支持三种打分、掩码、逐格检查、A/B 和实验记录；M06 支持真实 Logistic 梯度训练、损失曲线、二维损失切面、学习率对照与轨迹导出。其余四个模块仍在开发，首页的路线列表不可点击。

## 开发

在 WSL 中进入项目目录，运行：

```bash
npm ci
npm run dev
```

在 Windows Chrome/Edge 访问 Vite 输出的本地地址。Node.js 24、npm 11 已在当前 WSL 实测；依赖以 `package-lock.json` 为准。

## 离线交付

```bash
npm run build:offline
npm run test:run
npm run test:offline
npm run bench
```

然后在 Windows 双击 `release/index.html`，无需启动 Vite，也无需网络。离线构建把 CSS 与 IIFE 脚本内嵌到 HTML；数据也由脚本提供。`test:offline` 当前是静态包审计；WSL Chromium 的 `file://` 手动交互证据见 `docs/acceptance.md`。Windows 浏览器验收仍待完成。

建议先进入“注意力机制”，点击“运行实验”，再点热力图格子查看分数和归一化；固定为 A，切换打分方式后重跑 B 可看差值。勾选来源掩码后重跑，可验证被屏蔽列权重为 0。实验笔记支持保存、JSON/CSV/Markdown 导出及 JSON 重新计算。浏览器本地存储不可用时，记录只保存在当前会话，宜及时导出。

“损失与优化”默认提供故意含冲突标签的四条教学样本。点击“开始训练”，固定基线 A；选择“震荡 8”并重跑 B，可看到同数据与初值下实际曲线的差异。曲线可点击或用滑块定位，查看该步梯度和更新。样本输入每行格式为 `文本,好次数,差次数,标签`，文本字段不支持逗号。轨迹可导出 JSON/CSV/Markdown；目前没有 M06 记录导入与暂停恢复。

M04 内置向量由 Token 字符的确定性哈希映射得到，**不是训练模型或语义向量**；热图仅用于演示数学过程，不能解释真实翻译模型。实验模式可计算每侧 128 Token，画面只展示前 16×16 格，导出包含全量权重。M06 只有两项可训练权重且无偏置，不代表深层模型。当前没有任意向量编辑、通用数据集导入或跨模块模型链路。

需求、架构、算法与实测状态分别在 `docs/requirements.md`、`docs/architecture.md`、`docs/algorithm-specs.md`、`docs/progress.md`。第三方来源见 `THIRD_PARTY_NOTICES.md`。
