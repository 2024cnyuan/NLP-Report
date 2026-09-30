import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'release',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'index.html',
      output: {
        format: 'iife',
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
