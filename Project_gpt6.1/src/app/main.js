import '../styles/main.css';
import '../styles/responsive.css';
import '../styles/polish.css';
import { modules } from './catalog.js';
import { mountHome } from './home.js';
import { mountAttention } from '../modules/attention.js';
import { mountOptimization } from '../modules/optimization.js';
import { mountEmbeddings } from '../modules/embeddings.js';
import { mountSequence } from '../modules/sequence.js';
import { mountCNN } from '../modules/cnn.js';
import { mountComparison } from '../modules/comparison.js';
import { mountData } from '../modules/data.js';
import { mountNotebook } from '../modules/notebook.js';
import { mountHelp } from '../modules/help.js';
import snapshot from '../data/models.json';
import { store, record, persist } from '../data/store.js';
import { runtime, control, run } from '../runtime/client.js';
import { icon, button, escapeHTML, notify, download, safe } from '../components/ui.js';
import { fingerprint, VERSION } from '../core/math.js';
import '../styles/typography.css';
import '../styles/computation.css';
import { summaryMarkdown } from '../components/computation.js';
import { summarizeResult } from '../algorithms/explanations.js';
import '../styles/dataset.css';
import { datasetReportMarkdown } from '../components/dataset-report.js';
import { initDisplay } from '../components/display.js';
import '../styles/display.css';
import { initNavigation } from './navigation.js';
import '../styles/navigation.css';

const app = document.getElementById('app');
app.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#home"><span class="brand-icon">${icon('scope',24)}</span><span><strong>TensorScope</strong><small>NLP 原理实验室</small></span></a><nav aria-label="主导航"><a class="nav-link" href="#home" data-page="home">${icon('home')} 实验首页</a><div class="nav-caption">EXPLORE THE ALGORITHMS</div>${modules.map(m=>`<a class="nav-link" href="#${m.id}" data-page="${m.id}">${icon(m.id)} ${m.title}<span class="nav-number">${m.num}</span></a>`).join('')}</nav><div class="sidebar-bottom"><a class="nav-link" href="#data" data-page="data">${icon('data')} 数据集管理</a><a class="nav-link" href="#notebook" data-page="notebook">${icon('notebook')} 实验笔记</a><a class="nav-link" href="#help" data-page="help">${icon('help')} 使用说明</a><div class="offline-chip"><i class="status-dot"></i><div><strong>所有计算，留在本地</strong><span>离线可用 · 无需 API</span></div></div></div></aside><div id="resize-sidebar" class="sidebar-resizer" role="separator" aria-label="调整侧栏宽度" aria-orientation="vertical" aria-controls="page-root" tabindex="0" title="拖动调整侧栏宽度；左右方向键调整，Shift加速；双击恢复默认"></div><main class="main"><header class="topbar"><div class="breadcrumb"><button id="mobile-menu" class="icon-btn mobile-menu" aria-label="打开导航">${icon('menu')}</button><span>实验室</span><span>/</span><b id="breadcrumb-name">概览</b></div><div class="topbar-tools"><span class="badge quiet">本地计算引擎</span><div class="mode-switch" aria-label="工作模式"><button data-mode="principle" class="active">原理模式</button><button data-mode="experiment">实验模式</button></div><button type="button" id="display-toggle" class="icon-btn display-toggle" aria-label="字号与显微镜设置" title="字号与显微镜设置" aria-controls="display-panel" aria-expanded="false">Aa</button><button id="presentation" class="icon-btn" aria-label="切换演示视图" title="演示视图">${icon('play',18)}</button><a href="#help" class="icon-btn" aria-label="使用说明">${icon('help',18)}</a></div></header><div class="content"><nav class="navigation-strip" aria-label="页面来路"><button class="btn compact" id="navigation-back" type="button">← 返回</button><button class="btn compact" id="navigation-forward" type="button">前进 →</button><span class="navigation-origin" id="navigation-origin"></span></nav><div id="page-heading"></div><div id="task-bar" class="task-bar" role="status"><p id="task-message"></p>${button('暂停','task-pause','compact','pause')}${button('取消','task-cancel','compact danger','close')}</div><div id="page-root"></div><footer class="footer"><span>TensorScope · 从计算理解语言</span><span>${VERSION} · D3 / JavaScript · <span id="storage-label">${escapeHTML(store.storage)}</span></span></footer></div></main></div><aside id="inspector" class="inspector" aria-label="计算检查器"></aside><div id="toast" class="toast" role="status"></div><div id="modal-root"></div>`;
initDisplay();
const root = document.getElementById('page-root');
store.models = structuredClone(snapshot.models);
const registry = { home: mountHome, attention: mountAttention, optimization:mountOptimization, embeddings:mountEmbeddings, sequence:mountSequence, cnn:mountCNN, comparison:mountComparison, data:mountData, notebook:mountNotebook, help:mountHelp };
const navigation = initNavigation(route => route.startsWith('help') ? '使用说明' : route.startsWith('comparison') ? `多模型对照 · ${route.split('/')[1] === 'dataset' ? '数据集模式' : '案例模式'}` : modules.find(m => m.id === route)?.full ?? ({home:'实验首页',data:'数据集管理',notebook:'实验笔记'}[route] ?? '实验首页'));
let activeExperiment = null, viewGeneration = 0, cleanup = null;
let taskOwner = null, taskRunId = null, inputRevision = 0, taskRevision = 0, taskGeneration = 0;
const statuses = { idle:'尚未运行', running:'运行中', progress:'运行中', paused:'已暂停', cancelling:'正在取消', cancelled:'已取消', completed:'结果已更新', failed:'运行失败', stale:'参数已修改 · 结果过期' };
function setStatus(status) { const el = document.getElementById('result-state'); if (el) { el.textContent = statuses[status] ?? status; el.className = `result-state ${status}`; for(const id of ['freeze','save','export']){const button=document.getElementById(id);if(button)button.disabled=status!=='completed';} } }
const context = {
  setStatus,
  setExperiment(config,result,redraw) { activeExperiment = { config: structuredClone(config), result: structuredClone(result), redraw, page: store.page }; setStatus('completed'); },
  configDiff(a,b) {
    const ignored=['modelSource','tokens','basis','basisVocab','models','dataFingerprint','Q','K','V'];
    const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>!ignored.includes(k));
    const changed=keys.filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
    const describe=(key,value)=>{if(key==='model')return value?.id??'无模型';if(key==='dataset')return value?`${value.name??'数据'} / ${fingerprint(value.samples??null)}`:'未包含数据';if(key==='corpus'||key==='data')return `${key==='corpus'?'语料':'数据'} ${fingerprint(value??null)}`;const s=JSON.stringify(value);return s?.length>100?s.slice(0,97)+'…':s;};
    const items=changed.map(k=>`${k}: ${describe(k,a[k])} → ${describe(k,b[k])}`);
    if(changed.includes('model')&&a.model?.weights&&b.model?.weights){const diffs=[];for(const[k,w]of Object.entries(a.model.weights))if(b.model.weights[k]?.length===w.length)w.forEach((v,i)=>{if(v!==b.model.weights[k][i])diffs.push(`${k}[${i}]: ${Number(v).toFixed(4)} → ${Number(b.model.weights[k][i]).toFixed(4)}`);});if(diffs.length)items.push(`权重变化 ${diffs.length} 项（${diffs.slice(0,2).join('；')}）`);}
    for(const k of ['Q','K','V'])if(JSON.stringify(a[k])!==JSON.stringify(b[k])&&a.source===b.source&&a.target===b.target&&a.dim===b.dim){changed.push(k);items.push(`${k} 矩阵 ${fingerprint(a[k])} → ${fingerprint(b[k])}`);}
    return `${changed.length===1?'单因素对照':changed.length===0?'配置相同':'多因素探索'}：${items.join('；')||'输入、初始化、种子与参数一致'}。种子 A=${a.seed??42} / B=${b.seed??42}；算法 ${VERSION}`;
  },
  current: () => activeExperiment,
};
export function register(id,mount) { registry[id]=mount; }
async function navigate() {
  const navigationView = navigation.visit();
  cleanup?.(); cleanup=null; const generation=++viewGeneration;
  const previousPage=store.page, hash=location.hash.slice(1)||'home';
  const id=hash.startsWith('help/')?'help':hash.startsWith('comparison/')?'comparison':hash; store.page=id; activeExperiment=null;
  if(previousPage==='help'&&id!=='help')window.scrollTo(0,0);
  if(id==='comparison')store.comparisonMode=hash.split('/')[1]==='dataset'?'dataset':'case';
  document.querySelector('[data-page="comparison"]').href=store.comparisonMode==='dataset'?'#comparison/dataset':'#comparison';
  document.querySelector('.sidebar').classList.remove('visible'); document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===id));
  const module=modules.find(m=>m.id===id), title=module?.full??({home:'实验首页',data:'数据集管理',notebook:'实验笔记',help:'使用说明'}[id]??'实验首页');
  document.getElementById('breadcrumb-name').textContent=title;
  document.getElementById('page-heading').innerHTML=module?`<div class="page-heading"><div><span class="eyebrow">LAB ${module.num} / ${module.en}</span><h1>${module.full}</h1><p>${module.summary}</p></div><div class="heading-actions"><span id="result-state" class="result-state">尚未运行</span>${button('固定为 A','freeze','', 'compare')}${button('保存实验','save','', 'notebook')}${button('导出','export','', 'download')}</div></div>`:id==='home'?'':`<div class="page-heading"><div><span class="eyebrow">WORKSPACE / ${id.toUpperCase()}</span><h1>${title}</h1><p>${id==='data'?'使用自己的语料与分类样本。预览、校验后再参与实验。':id==='notebook'?'保存发现、固定基线，把实验带走并重新运行。':'了解实验操作、算法假设和可复现的边界。'}</p></div></div>`;
  if(module){ document.getElementById('freeze').onclick=safe(()=>{if(!activeExperiment)throw new Error('请先运行实验');if(document.getElementById('result-state').classList.contains('stale'))throw new Error('结果已过期，请运行当前配置后固定基线');store.baselines[id]={config:structuredClone(activeExperiment.config),result:structuredClone(activeExperiment.result),fingerprint:fingerprint(activeExperiment.config)};activeExperiment.redraw?.();notify('已固定 A；修改一个因素后运行 B');});document.getElementById('save').onclick=safe(()=>{if(!activeExperiment)throw new Error('请先运行实验');if(document.getElementById('result-state').classList.contains('stale'))throw new Error('结果已过期，请重新运行');const r=record(id,activeExperiment.config,activeExperiment.result);openSaveDialog(r);});document.getElementById('export').onclick=safe(()=>{if(!activeExperiment)throw new Error('请先运行实验');openExport(activeExperiment);});}
  root.innerHTML='<div class="loading">准备实验台…</div>';
  const mount=registry[id]??registry.home;
  const scopedContext={...context,setStatus:s=>{if(generation===viewGeneration)setStatus(s);},setExperiment:(...args)=>{if(generation===viewGeneration){context.setExperiment(...args);if(taskGeneration===generation&&taskRevision!==inputRevision)setStatus('stale');}}};
  try { const dispose=await mount(root,scopedContext); if(generation===viewGeneration&&typeof dispose==='function')cleanup=dispose;else if(typeof dispose==='function')dispose(); }catch(e){if(generation===viewGeneration){setStatus('failed');if(root.querySelector('.controls')){root.insertAdjacentHTML('afterbegin',`<div class="note" role="alert" style="margin-bottom:18px;color:#973627;background:#fff5ee">${escapeHTML(e.message)}。输入已保留，可调整参数或重新训练。</div>`);}else{root.innerHTML=`<section class="panel empty-state"><h3>实验准备失败</h3><p>${escapeHTML(e.message)}</p>${button('重新打开','retry','primary','reset')}</section>`;root.querySelector('#retry').onclick=navigate;}notify(e.message,true);}}
  if(generation===viewGeneration)navigation.restore(navigationView,()=>generation===viewGeneration);
}
function closeModal(){document.getElementById('modal-root').innerHTML='';}
function openSaveDialog(r){const m=document.getElementById('modal-root');m.innerHTML=`<div class="modal"><section class="modal-card" role="dialog" aria-modal="true" aria-label="命名实验"><div class="modal-title"><h2>记录这次发现</h2><button class="icon-btn" id="modal-close" aria-label="关闭">${icon('close')}</button></div><label class="field"><span class="field-label">实验名称</span><input id="record-name" value="${escapeHTML(r.name)}" maxlength="120"></label><label class="field"><span class="field-label">你的观察与备注</span><textarea id="record-notes" rows="4" placeholder="改了什么？数字如何变化？"></textarea></label><p class="small">参数、输入、实际结果及算法版本已一起保存。</p><div class="modal-footer">${button('保存笔记','modal-save','primary','check')}</div></section></div>`;m.querySelector('#modal-close').onclick=closeModal;m.querySelector('#modal-save').onclick=()=>{r.name=m.querySelector('#record-name').value||r.name;r.notes=m.querySelector('#record-notes').value;persist();closeModal();notify('实验已保存到实验笔记');};m.querySelector('input').focus();}
function openExport(exp){const m=document.getElementById('modal-root');m.innerHTML=`<div class="modal"><section class="modal-card" role="dialog" aria-modal="true" aria-label="导出实验"><div class="modal-title"><h2>带走你的实验</h2><button class="icon-btn" id="modal-close" aria-label="关闭">${icon('close')}</button></div><p class="small">JSON 包含输入、配置、权重（如适用）与完整结果；CSV 用于数值分析；Markdown 用于报告。所有导出在本地完成。</p><div class="inline-actions">${button('实验 JSON','export-json','','download')}${button('结果 CSV','export-csv','','download')}${button('报告 Markdown','export-md','','download')}</div></section></div>`;m.querySelector('#modal-close').onclick=closeModal;
  const r={schema:1,module:store.page,algorithmVersion:VERSION,config:exp.config,result:exp.result,dataSource:exp.config.dataset?.source??store.dataset?.source??'内置教学数据',dataFingerprint:exp.result.dataFingerprint??fingerprint(exp.config.dataset?.samples??store.dataset?.samples??exp.config),notes:''};
  r.analysis=summarizeResult(store.page,exp.result,store.baselines[store.page]?.result);
  if(r.analysis&&store.baselines[store.page])r.baseline=structuredClone(store.baselines[store.page]);
  m.querySelector('#export-json').onclick=()=>{download(`${store.page}-experiment.json`,JSON.stringify(r,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,exp.config.experimentMode==='dataset'?undefined:2));closeModal();};
  m.querySelector('#export-md').onclick=()=>{download(`${store.page}-report.md`,`# TensorScope 实验记录\n\n模块：${store.page}\n\n算法版本：${VERSION}\n\n数据指纹：${r.dataFingerprint}\n\n${datasetReportMarkdown(exp.result)}${summaryMarkdown(r.analysis)}\n## 参数\n\n\u0060\u0060\u0060json\n${JSON.stringify(exp.config,null,2)}\n\u0060\u0060\u0060\n\n## 实际结果\n\n\u0060\u0060\u0060json\n${JSON.stringify(exp.result,null,2)}\n\u0060\u0060\u0060\n\n${r.baseline ? `## A 基线（可复算）\n\n\u0060\u0060\u0060json\n${JSON.stringify(r.baseline,null,2)}\n\u0060\u0060\u0060\n\n` : ''}结果仅代表当前数据与模型；教学向量不等于真实语义能力。\n`,'text/markdown');closeModal();};
  m.querySelector('#export-csv').onclick=()=>{const rows=[];const walk=(obj,path='')=>{if(obj&&typeof obj==='object'){for(const[k,v]of Object.entries(obj))walk(v,path?`${path}.${k}`:k);}else rows.push([path,obj]);};walk(exp.result);const cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s)&&!Number.isFinite(Number(s)))s="'"+s;return`"${s.replaceAll('"','""')}"`;};download(`${store.page}-results.csv`,'path,value\r\n'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv');closeModal();};
}
runtime.listeners.add(s=>{if(taskRunId!==s.runId){taskRunId=s.runId;taskOwner=store.page;taskRevision=inputRevision;taskGeneration=viewGeneration;}if(taskOwner===store.page&&taskGeneration===viewGeneration)setStatus(s.status==='completed'&&taskRevision!==inputRevision?'stale':s.status);const bar=document.getElementById('task-bar');const active=['running','progress','paused','cancelling'].includes(s.status);bar.classList.toggle('visible',active);document.querySelectorAll('#page-root .controls button').forEach(b=>b.disabled=active||b.dataset.unavailable==='true');document.getElementById('task-message').innerHTML=`${escapeHTML(statuses[s.status]??s.status)}<small>${s.engine} · ${s.progress?`已处理 ${s.progress.processed??0}${s.progress.total!=null?` / ${s.progress.total}`:''}${s.progress.loss!=null?` · loss ${Number(s.progress.loss).toFixed(5)}`:''}`:'准备实际计算'}</small>`;document.getElementById('task-pause').querySelector('span').textContent=s.status==='paused'?'继续':'暂停';if(s.error&&s.status==='failed')notify(s.error,true);});
document.getElementById('task-pause').onclick=()=>control(runtime.status==='paused'?'resume':'pause');document.getElementById('task-cancel').onclick=()=>control('cancel');
document.getElementById('mobile-menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('visible');
document.getElementById('presentation').onclick=()=>document.body.classList.toggle('presentation');
document.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{store.mode=el.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===el));notify(store.mode==='principle'?'原理模式：默认小尺寸，保留完整计算轨迹。已有输入与模型保留。':'实验模式：Worker 批量执行，大矩阵分块展示。已有输入与模型保留。');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();document.querySelector('.sidebar').classList.remove('visible');}});
window.addEventListener('hashchange',navigate);
document.addEventListener('input',e=>{if(e.target.closest('#page-root .controls'))inputRevision++;},true);
// Module registration imports are static in the final IIFE bundle.
navigate();
export const diagnostics = { runtime, run, control, store, version: VERSION };
