import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  worker: { format: 'iife' },
  build: {
    outDir: 'release',
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: 'src/app/main.js', name: 'TensorScope', formats: ['iife'], fileName: () => 'app.js', cssFileName: 'style' },
  },
  plugins: [{
    name: 'offline-html',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'index.html', source: '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#087f8c"><title>TensorScope · NLP 原理实验室</title><link rel="icon" href="data:,"><link rel="stylesheet" href="./style.css"></head><body><div id="app"></div><script src="./app.js"></script></body></html>' });
    },
  }],
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node' },
});
