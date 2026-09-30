# 验收记录

2026-09-30，WSL Node 24.14.0、npm 11.9.0、Vite 8.3.1、Vitest 5.0.2。`npm run test:run`：11/11 通过。`npm run build:offline`：生成内联 CSS 与经典 IIFE 的 `release/index.html`。`npm run test:offline`：静态审计通过；该命令目前**不执行浏览器自动化**。`npm run bench`：Node CPU 128×128×32，1 次热身后 6 次计时的中位约 4.40ms、p95 约 7.16ms；这不是浏览器总耗时。原始终端输出未自动归档，重跑脚本可得到本机新结果。

WSL Chromium 通过 browser-use 打开真实 `file:///mnt/d/大三上/NLP/Project/release/index.html`，在 `#attention` 直达页面运行默认例：Worker 完成，12 个权重格，检查器首格约 0.3547。固定 A 后将 `scaled` 改 `dot`，页面提示“结果已过期”；重新运行显示首格差值约 +0.1207。样式初次因外链 CSS 的 `file://` 行为失效，已改为内联并复验。1440×900 与 390×844 截图见本目录；手机 `scrollWidth = innerWidth = 390`。截图已实际查看。

M06 在同一 `file://` 浏览器打开 `#optimization`，默认 40 次训练由 Worker 完成，最终平均损失约 0.6931。固定 A（η=0.5）后选 η=8，配置标记过期，重新训练最终损失约 1.9365，图上两条实测曲线共享坐标。1440×900 和 390×844 截图见本目录；手机无整页横向溢出。截图已实际查看。M06 Worker 首次函数序列化失败而回退主线程，改为打包同一核心源码后复验 Worker 正常。

待验：Windows Chrome/Edge 双击、断网请求拦截、JSON/CSV/Markdown 文件落地与导入循环、更多响应式尺寸、长输入 Worker 取消、持续运行内存、可访问性对比度。不能把当前 WSL 浏览器结果冒充 Windows 实测。
