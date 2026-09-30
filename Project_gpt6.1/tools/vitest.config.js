import { defineConfig } from 'vitest/config';
import { projectRoot, toolsDir, evidencePath, applicationAliases } from './paths.mjs';

export default defineConfig({
  root: projectRoot,
  cacheDir: `${toolsDir}/node_modules/.vitest`,
  resolve: { alias: applicationAliases },
  test: {
    include: ['appendix/tests/unit/**/*.test.js'],
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: evidencePath('unit-results.json'),
    coverage: { reportsDirectory: `${projectRoot}/appendix/coverage` },
  },
});
