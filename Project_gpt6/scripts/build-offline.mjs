import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(resolve(root, 'node_modules/.bin/vite'), ['build'], { cwd: root, stdio: 'inherit' });
const output = resolve(root, 'release/index.html');
const html = readFileSync(output, 'utf8');
const script = readFileSync(resolve(root, 'release/assets/app.js'), 'utf8').replaceAll('</script', '<\\/script');
const style = readFileSync(resolve(root, 'release/assets/style.css'), 'utf8').replaceAll('</style', '<\\/style');
const classic = html.replace('<script type="module" crossorigin src="./assets/app.js"></script>', '').replace('<link rel="stylesheet" crossorigin href="./assets/style.css">', `<style>${style}</style>`).replace('</body>', `<script>${script}</script>\n  </body>`);
if (classic === html) throw new Error('构建脚本未找到预期的模块入口；请核查 Vite 输出');
if (classic.includes('crossorigin') || classic.includes('type="module"')) throw new Error('离线入口仍含跨源或模块属性');
writeFileSync(output, classic);
console.log('Offline entry: self-contained classic script and inline CSS');
