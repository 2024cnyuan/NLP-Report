# 视觉规范（当前实现）

浅色科学工作台：背景 `#f5f7fa`、白色面板、正文 `#172b3a`、主色 `#087f8c`。正文默认 15px；标题约 19–31px；数学数值使用等宽字体和 tabular nums。8px 网格、14px 面板圆角、8px 控件圆角、40px 按钮最小高度。系统中文字体，无远程字体。

注意力热图使用顺序青色，色深按当前与兼容基线的共同最大值归一；同时印出数值。主画布、参数区、检查器在桌面三列，较窄屏折叠成两列/一列。390px 实测页面无整页横向滚动。支持键盘聚焦热图按钮与 `prefers-reduced-motion`。对比度尚未完成自动量化；不能声称全站 WCAG 合规。

`docs/attention-desktop.png`、`docs/attention-mobile.png`、`docs/optimization-desktop.png` 和 `docs/optimization-mobile.png` 是 WSL Chromium 对真实 `file://` 的截图，已人工查看。其余目标尺寸、空/错状态和 Windows 实机截图待补。
