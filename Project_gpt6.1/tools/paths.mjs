import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

export const toolsDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(toolsDir, '..');
export const fromProject = (...parts) => resolve(projectRoot, ...parts);
export const evidencePath = (...parts) => fromProject('appendix', 'docs', 'evidence', ...parts);
export const requireTool = createRequire(new URL('./package.json', import.meta.url));
// Application sources live beside tools/, so resolve D3 from the single tools install.
export const applicationAliases = [{ find: /^d3$/, replacement: requireTool.resolve('d3') }];
