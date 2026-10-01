import { fromProject } from '../paths.mjs';
const dependencyDir=fromProject('tools/node_modules');
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const folders=(await readdir(dependencyDir)).filter(n=>n==='d3'||n.startsWith('d3-')||n==='internmap');
const runtimeFonts=['@fontsource/inter','@fontsource/noto-sans-sc','@fontsource/jetbrains-mono'];
const names=[...folders,...runtimeFonts,'katex','vite','vitest','@playwright/test'];
let output='TensorScope — 第三方资源与许可\n\n原创界面/算法源码采用项目 package.json 中的 ISC 许可；原创 AI 辅助教学句子按 CC0-1.0 提供，非外部真实语料。内置案例模型由本项目源码与这些教学句子生成，采用 ISC；真实语料训练产物不因此取得原始语料的再分发许可。没有外部图片、预训练模型或在线字体。\n开发使用 Codex 进行代码与教学句子辅助；没有伪造其他平台对话。\n\n';
const datasets=JSON.parse(await readFile(fromProject('src/data/dataset-manifest.json'),'utf8'));
output+='离线真实数据：用户提供的ChnSentiCorp酒店评论与weibo_senti_100k微博语料，清洗/平衡子集分别2944、5000条。原始CSV保留在src/datacsv，仅清洗子集进入离线包。数据内容与标注不是本项目生成，不适用源码ISC或原创句子CC0；原文版权归原作者，使用/再分发需确认原数据权利。未将整理仓库的代码许可推定为每条语料的开放许可。\n';
for(const d of datasets)output+=`\n${d.name}\n来源说明：${d.source}\n参考来源：${d.homepage}\n原始文件：${d.input} · SHA-256 ${d.sourceSHA256}\n清洗文件：${d.output} · SHA-256 ${d.outputSHA256}\n处理规则：${d.policy.clean}；${d.policy.dedup}；${d.policy.split}\n许可：${d.license}\n`;
for(const name of names){const base=join(dependencyDir,name),m=JSON.parse(await readFile(join(base,'package.json'),'utf8'));const purpose=runtimeFonts.includes(name)?'本地内嵌界面/代码字体，采用原字形与许可证，不经CDN加载':name==='katex'?'本地打包的公式排版器与原配字体，保留公式原文，不参与算法计算':folders.includes(name)?'本地打包的可视化基础库（部分导出经tree-shaking移除）':'开发/构建/测试工具，不作为离线运行前提';output+=`\n${'='.repeat(72)}\n${name} ${m.version} · ${m.license}\n${m.homepage??m.repository?.url??''}\n用途：${purpose}\n\n`;for(const filename of ['LICENSE','LICENSE.md','NOTICE']){try{output+=await readFile(join(base,filename),'utf8');output+='\n';}catch(error){if(error.code!=='ENOENT')throw error;}}}
await writeFile(fromProject('THIRD_PARTY_NOTICES'),output);console.log(`Third-party notices: ${names.length} packages`);
