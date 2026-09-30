import os from 'node:os';
import { writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { attention, teachingVectors } from '../../src/algorithms/attention.js';
import { trainEmbeddings, neighbors } from '../../src/algorithms/embeddings.js';
import { trainNeural, createNeural } from '../../src/algorithms/neural.js';
import { evaluateBatch } from '../../src/algorithms/classifiers.js';
import { optimize } from '../../src/algorithms/optimization.js';
import { parseFile, makeDataset } from '../../src/data/datasets.js';
import { consume } from '../../src/runtime/tasks.js';
const smoke=process.argv.includes('--smoke');
const reportURL=new URL(`../../appendix/docs/evidence/${smoke?'bench-smoke':'bench'}.json`,import.meta.url);
const report={date:new Date().toISOString(),environment:{node:process.version,platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},scope:'Node CPU 参考实现；不代替浏览器响应性或 Windows 实测。全部性能数据为人工生成压力样本，不报告语义准确率。',results:[]};
const snapshot=JSON.parse(await readFile(new URL('../../src/data/models.json',import.meta.url),'utf8'));
async function measure(name,config,fn,repeats=3){const times=[];let summary;const before=process.memoryUsage().heapUsed;try{for(let i=0;i<repeats;i++){const start=performance.now();summary=await fn();times.push(performance.now()-start);console.log(`${name} ${i+1}/${repeats}: ${times.at(-1).toFixed(1)} ms`);}const sorted=[...times].sort((a,b)=>a-b);report.results.push({name,config,status:'computed',runs:times,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:times.length>=20?sorted[Math.ceil(sorted.length*.95)-1]:null,p95Note:'不足20次，未报告稳定p95',heapBeforeBytes:before,heapAfterBytes:process.memoryUsage().heapUsed,summary});}catch(e){report.results.push({name,config,status:'failed',error:e.message});console.error(`${name}: ${e.message}`);}await writeFile(reportURL,JSON.stringify(report,null,2));}
const csv='text,label\n'+Array.from({length:10000},(_,i)=>`性能样本${i},${i%2}`).join('\n');
report.smoke=smoke;
await measure('分类导入10,000条',{samples:10000,bytes:Buffer.byteLength(csv)},()=>{const d=makeDataset(parseFile(csv,'stress.csv'));return{samples:d.samples.length,duplicates:d.duplicates};});
const v=teachingVectors(Array.from({length:256},(_,i)=>`token${i}`),32);
await measure('注意力256×256 d=32',{rows:256,cols:256,dim:32},()=>{const r=attention({Q:v,K:v,V:v});return{weights:r.weights.length*r.weights[0].length,rowSum:r.weights[0].reduce((a,b)=>a+b,0)};});
if(!smoke){
let embedding;
const corpus=Array.from({length:2000},(_,row)=>Array.from({length:50},(_,j)=>`w${(row*50+j)%5000}`).join(' ')).join('\n');
await measure('Word2Vec Skip-gram100,000Token',{tokens:100000,vocab:5000,dim:32,window:2,negatives:5,epochs:1},async()=>{embedding=await consume(trainEmbeddings({corpus,algorithm:'skipgram',dim:32,window:2,negatives:5,epochs:1}));return{tokens:embedding.tokenCount,vocab:embedding.vocab.length,loss:embedding.history[0].loss,updates:embedding.history[0].updates};},1);
await measure('Word2Vec CBOW100,000Token',{tokens:100000,vocab:5000,dim:32,window:2,negatives:5,epochs:1},async()=>{const a=await consume(trainEmbeddings({corpus,algorithm:'cbow',dim:32,window:2,negatives:5,epochs:1}));return{tokens:a.tokenCount,vocab:a.vocab.length,loss:a.history[0].loss};},1);
await measure('GloVe 非零共现训练',{tokens:100000,vocab:5000,dim:32,window:2,epochs:1},async()=>{const a=await consume(trainEmbeddings({corpus,algorithm:'glove',dim:32,window:2,epochs:1}));return{nonzero:a.cooccurrence,loss:a.history[0].loss};},1);
if(embedding)await measure('5,000向量全词表查询',{vocab:5000,dim:32,queries:20},()=>{for(let i=0;i<20;i++)neighbors(embedding,`w${i}`,10);return{queried:20,fullVocab:embedding.vocab.length};});
const tokens=Array.from({length:128},(_,i)=>snapshot.models.RNN.vocab[1+i%(snapshot.models.RNN.vocab.length-1)]);
const samples=Array.from({length:10000},(_,i)=>({id:`pressure-${i}`,text:'人工压力样本；不用于准确率',tokens,label:null,split:'test'}));
await measure('四模型10,000条×128Token',{samples:10000,length:128,dim:8,hidden:8},async()=>{const r=await consume(evaluateBatch({models:snapshot.models,samples}));return{processed:r.processed,metricsCount:r.metrics.NB.count,elapsedMs:r.elapsedMs};},1);
await measure('优化5,000次真实更新',{steps:5000},async()=>{const r=await consume(optimize({steps:5000,lr:.1}));return{points:r.history.length,loss:r.history.at(-1).loss};});
const vocab=['<UNK>',...Array.from({length:64},(_,i)=>`t${i}`)],trainSamples=Array.from({length:2000},(_,i)=>({tokens:Array.from({length:64},(_,j)=>vocab[1+(i+j)%64]),label:i%2}));
for(const algorithm of ['RNN','CNN'])await measure(`${algorithm}2,000条训练一轮`,{samples:2000,length:64,dim:32,hidden:32,epochs:1,batch:4},async()=>{const m=createNeural({algorithm,vocab,dim:32,hidden:32,widths:[2,3],filters:3});let last=0;const r=await consume(trainNeural(m,trainSamples,{epochs:1,batch:4}),{},p=>{if(p.processed-last>=200){last=p.processed;console.log(`${algorithm} processed ${last}/2000`);}});return{samples:r.model.trainConfig.samples,epochs:1,loss:r.history[0].loss,modelId:r.model.id};},1);
}
console.log(`Benchmark saved to ${reportURL.pathname}; smoke=${smoke}`);
