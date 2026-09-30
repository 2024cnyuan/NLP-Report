# 验收证据

初次核心测试：npm run test:run，10/10 通过。包含稳定 softmax、CE、余弦、PCA、可播种随机、反向传播、点积/加性注意力、mask、256×256注意力、Logistic 有限差分、三学习率实际日志。

离线构建首次发现 IIFE 不支持 top-level await，已改为异步初始化函数调用，并移除动态 import。后续构建/浏览器结果另行追加。

Windows Chrome/Edge：待用户验证。WSL Chromium 结果不等同 Windows 实测。性能目标与拓展档未跑前不标通过。
