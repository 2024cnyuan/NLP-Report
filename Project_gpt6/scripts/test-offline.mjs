import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'release/index.html'), 'utf8');
if (/type=["']module|crossorigin|https?:\/\/|<script[^>]+src=["']\//i.test(html)) throw new Error('离线入口包含模块脚本、跨源属性、网络链接或绝对脚本路径');
for (const asset of ['assets/app.js', 'assets/style.css']) if (!existsSync(resolve(root, 'release', asset))) throw new Error(`缺少 ${asset}`);
if (!html.includes('<style>') || !html.includes('<script>(function()')) throw new Error('离线入口没有内联样式或 IIFE');
const script = readFileSync(resolve(root, 'release/assets/app.js'), 'utf8');
if (!script.startsWith('(function()') || /import\s*\(|\bfetch\s*\(/.test(script)) throw new Error('脚本并非自包含 IIFE 或存在运行时网络/动态导入');
console.log('Static offline package audit passed. Browser file:// check remains separate.');
