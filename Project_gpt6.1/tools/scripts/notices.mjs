import { fromProject } from '../paths.mjs';
const dependencyDir=fromProject('tools/node_modules');
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const folders=(await readdir(dependencyDir)).filter(n=>n==='d3'||n.startsWith('d3-')||n==='internmap');
const names=[...folders,'vite','vitest','@playwright/test'];
let output='TensorScope — 第三方资源与许可\n\n原创界面/算法源码采用项目 package.json 中的 ISC 许可；原创 AI 辅助教学句子按 CC0-1.0 提供，非外部真实语料。训练模型由本项目源码与这些句子生成，采用 ISC。没有外部图片、预训练模型或在线字体。\n开发使用 Codex 进行代码与教学句子辅助；没有伪造其他平台对话。\n\n';
for(const name of names){const base=join(dependencyDir,name),m=JSON.parse(await readFile(join(base,'package.json'),'utf8'));output+=`\n${'='.repeat(72)}\n${name} ${m.version} · ${m.license}\n${m.homepage??m.repository?.url??''}\n用途：${folders.includes(name)?'本地打包的可视化基础库（部分导出经tree-shaking移除）':'开发/构建/测试工具，不作为离线运行前提'}\n\n`;for(const filename of ['LICENSE','LICENSE.md','NOTICE']){try{output+=await readFile(join(base,filename),'utf8');output+='\n';}catch(error){if(error.code!=='ENOENT')throw error;}}}
await writeFile(fromProject('THIRD_PARTY_NOTICES'),output);console.log(`Third-party notices: ${names.length} packages`);
