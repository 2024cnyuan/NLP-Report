# TensorScope 工作约定

- 只修改本项目；保留父仓库和其他目录的用户改动。不要操作 Git 写命令。
- 计算在 src/algorithms 与 src/core；UI 不生成伪造结果。教学权重必须明确标识。
- 六个中阶模块及 I01–I04 是最终范围。阶段交付不能标成全项目完成。
- 离线入口 release/index.html，普通 IIFE script、自包含 Blob Worker，无网络依赖。
- 每次计算改动运行 npm run test:run；交付运行构建和 Playwright 离线测试。
- 文档记录实测证据、失败和未测项，不声称 Windows 浏览器已验收。
