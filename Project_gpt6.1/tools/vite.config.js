import { defineConfig } from 'vite';
import { projectRoot, toolsDir, fromProject, applicationAliases } from './paths.mjs';

export default defineConfig({
  root: projectRoot,
  cacheDir: `${toolsDir}/node_modules/.vite`,
  resolve: { alias: applicationAliases },
  base: './',
  worker: { format: 'iife' },
  build: {
    outDir: fromProject('release'),
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: fromProject('src/app/main.js'), name: 'TensorScope', formats: ['iife'], fileName: () => 'app.js', cssFileName: 'style' },
  },
  plugins: [{
    name: 'offline-html',
    configureServer(server) {
      // Keep the localhost homepage working without a root-level development HTML.
      server.middlewares.use((request, _response, next) => {
        if (/^\/(?:index\.html)?(?:\?|$)/.test(request.url ?? '')) {
          request.url = request.url.replace(/^\/(?:index\.html)?/, '/tools/index.html');
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'index.html', source: '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#087f8c"><title>TensorScope · NLP 原理实验室</title><link rel="icon" href="data:,"><link rel="stylesheet" href="./style.css"></head><body><div id="app"></div><script src="./app.js"></script></body></html>' });
    },
  }],
});
