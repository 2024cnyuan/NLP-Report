# 开发附录

这里存放不参与网页运行的验证与报告材料；移到附录不代表删除功能或放弃测试。

- tests/unit：数学、梯度、数据、安全、状态和可访问性测试。
- tests/e2e：真实离线与Vite开发入口交互测试。
- docs/evidence：实际运行的JSON报告和截图。
- docs：架构、公式、需求、性能、验收、课程报告素材、演示脚本和参考来源。
- playwright-report/offline、playwright-report/development：两种浏览器测试各自生成的HTML报告。
- test-results/offline、test-results/development：自动生成的运行轨迹和失败诊断，分开避免互相覆盖。
- prompt.md：原始任务要求，作为历史材料保留，不改写其中的旧目录示例。

工具及依赖在 [tools](../tools/README.md)。从项目根目录执行 npm --prefix tools run test:run 或 npm --prefix tools run test:offline；不在appendix安装依赖。

tests/package.json只用于明确ESM文件格式；不含依赖、锁文件或安装命令。测试通过tools/testing的桥接模块使用tools内唯一安装的Vitest/Playwright。

当前功能与证据见 [验收记录](docs/acceptance.md)；本次目录调整见 [迁移记录](docs/structure-migration.md)。Windows与未测拓展档的限制继续保留。
