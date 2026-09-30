# 目录迁移记录 · 2026-09-30

本次仅整理当前项目，不执行Git写命令，不碰.git/.agents/.codex/.aws或父仓库。计算定义、UI实现和依赖版本不变。

| 原位置 | 新位置 |
|---|---|
| index.html、vite.config.js、playwright.config.js | tools/下同名文件 |
| Vite内的test配置 | tools/vitest.config.js |
| package.json、package-lock.json、node_modules/ | tools/下同名文件/目录 |
| scripts/ | tools/scripts/ |
| tests/、docs/、prompt.md | appendix/下同名文件/目录 |
| playwright-report/、test-results/ | appendix/下同名目录 |

源码与测试新增极小的package.json用于明确ESM格式，不创建新的依赖安装。tools/paths.mjs统一按文件位置定位根目录，不依赖调用者cwd。Vite开发首页映射tools/index.html，离线入口仍为release/index.html。

测试框架通过tools/testing桥接；D3由Vite/Vitest别名解析到tools/node_modules，避免源码在兄弟目录找不到库。不在项目根目录保留node_modules软链接，不修改系统PATH、不移动Chromium缓存，不重装或升级包。

输出：训练写src/data/models.json；构建写release；数学/浏览器JSON、截图写appendix/docs/evidence；HTML报告与轨迹写appendix/playwright-report、appendix/test-results；构建/测试缓存在tools/node_modules内。原报告与截图搬迁保留；正常验证会更新对应报告。

锁文件迁移前后SHA-256：6c89f88726fc0680ac6d59e914012c49fb223383f29ceee3abfee0e75ac8b2db，完全一致。原模型完整记录SHA-256基线：25bc3c90745a1d49d423b24986d6bd3c7170b21b10cf93d6a5c4d7cbddcf19bf；复跑训练会更新耗时字段，完整JSON因此变化，不能用整个文件哈希宣称逐字相同。实际权重ID保持 NB-30a8aa8e、SVM-eda2107f、RNN-95600ec2、CNN-9af1e8f9，指标不变。

最终迁移验证：

| 操作（根目录 npm --prefix tools run） | 结果 | 输出 |
|---|---|---|
| check | 51文件语法、全部静态相对导入、4个依赖解析、根目录无旧路径，均通过 | 终端检查输出 |
| test:run | 38/38通过 | appendix/docs/evidence/unit-results.json |
| build:offline | 成功，自包含IIFE/Blob Worker | release/index.html、app.js、style.css |
| test:offline | 最终22/22通过，约23.2秒 | appendix/docs/evidence/playwright-results.json；截图同目录 |
| test:dev | 1/1通过，约6.5秒，服务器测试后关闭 | appendix/docs/evidence/playwright-dev-results.json |
| train | 成功，相同权重ID和真实指标 | src/data/models.json、appendix/docs/evidence/training.json |
| notices | 成功，35个包的许可 | 根目录THIRD_PARTY_NOTICES |
| bench -- --smoke | 导入10k、256²d32注意力各3次通过 | appendix/docs/evidence/bench-smoke.json |
| bench:browser -- --smoke | file://加载/10k导入、注意力、5000更新、20轮控制及检查器；无页面错误/HTTP请求 | appendix/docs/evidence/browser-bench-smoke.json |

完整Node/浏览器训练压力档此次未重新跑，原bench.json/browser-bench.json保留。短检查不冒充全档位重测。Markdown本地链接审计发现课程文档链接因层级改变失效，已多补一层相对路径，并明确这些参考文档不随本项目分发。

最终本地Markdown链接24处均存在；package.json与锁文件依赖声明一致，锁文件SHA-256未变；根目录不存在旧的node_modules/docs/tests/scripts或开发配置副本。首页迁移后截图已实际查看，外观正常。

路径大小写在Windows挂载盘解析到原大写目录，沙箱对移动命令报只读；经用户工具授权只在本项目迁移，未改变权限或浏览器安全策略。
