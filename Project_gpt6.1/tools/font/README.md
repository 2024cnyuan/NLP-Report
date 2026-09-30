# 本地字体与公式排版

实际字体/KaTeX由用户安装在tools/node_modules，本目录提供接入配置，不重复安装或复制包。

- 中文正文：Noto Sans SC，400/500/700真实字重；其余界面字重使用浏览器最近字重匹配，不伪造可变字体。
- 英文、普通数字、矩阵数值、图表刻度：Inter，400/500/600/700。正文将Inter放前、Noto Sans SC放后，按字形覆盖回退。
- 代码、JSON和技术输入：JetBrains Mono，400/600；中文注释回退Noto Sans SC。
- 数学公式：KaTeX原配字体。检查器按原公式排版，并保留可展开的纯文本原文；排版不参与计算，失败仍显示原文。

fonts.css引用已安装的WOFF2；plugin.mjs提供PostCSS规则，避免KaTeX的同一字形再打包WOFF/TTF。Vite的IIFE库模式把字体原字节内嵌进release/style.css，不增加外部字体请求，离线包仍为3文件。没有裁剪字形；简体中文字体会显著增加CSS体积。

显示分工在src/styles/typography.css；公式呈现在src/components/math.js；Canvas词向量标签沿用同一界面字体，并在字体加载后重绘。

字体许可与KaTeX声明通过npm --prefix tools run notices生成到根目录THIRD_PARTY_NOTICES。具体实测、失败及未测项在appendix/docs/acceptance.md。
