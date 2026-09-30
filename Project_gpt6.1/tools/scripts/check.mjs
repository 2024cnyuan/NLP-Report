import { readdir, readFile, access } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fromProject, requireTool } from '../paths.mjs';

async function collect(directory) {
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    if(['node_modules','.vite','.vitest'].includes(entry.name))continue;
    const path=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await collect(path));
    else if(['.js','.mjs'].includes(extname(path)))files.push(path);
  }
  return files;
}
const files=(await Promise.all(['src','tools','appendix/tests'].map(p=>collect(fromProject(p))))).flat();
for(const file of files) {
  const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(checked.status!==0){process.stderr.write(checked.stderr);process.exit(checked.status??1);}
  const source=await readFile(file,'utf8');
  for(const match of source.matchAll(/\b(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    await access(resolve(dirname(file),match[1].split('?')[0]));
  }
}
for(const name of ['d3','vite','vitest','@playwright/test']) {
  const resolved=requireTool.resolve(name);
  if(!resolved.includes('tools/node_modules/'))throw new Error(`${name} resolved outside tools/: ${resolved}`);
  console.log(`${name}: tools/node_modules/`);
}
const html=await readFile(fromProject('release/index.html'),'utf8');
if(!html.includes('<script src="./app.js"></script>'))throw new Error('Offline entry is not an ordinary script');
for(const old of ['node_modules','docs','tests','scripts','index.html','package.json','package-lock.json','vite.config.js','playwright.config.js']) {
  let exists=false;try{await access(fromProject(old));exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(exists)throw new Error(`Old root path still exists: ${old}`);
}
console.log(`Syntax and relative imports passed: ${files.length} files. Offline entry, dependency paths and clean root passed.`);
