import { softmax, rng, shuffle, fingerprint, sigmoid, VERSION } from '../core/math.js';
import { metrics } from '../core/metrics.js';
import { makeVocab, createNeural, trainNeural, neuralForward } from './neural.js';
import { PREPROCESSING } from '../data/datasets.js';
import { diagnose } from './diagnosis.js';

export const names=['NB','SVM','RNN','CNN'];
export function bow(tokens,vocab){const map=new Map(vocab.map((t,i)=>[t,i])),counts=new Map();tokens.forEach(t=>{const i=map.get(t)??0;counts.set(i,(counts.get(i)??0)+1);});return counts;}
export function trainNB(samples,vocab,classes=['负向','正向'],alpha=1){
  const counts=Array.from({length:2},()=>new Float64Array(vocab.length)),docs=[0,0],totals=[0,0];
  samples.forEach(s=>{docs[s.label]++;for(const[i,c]of bow(s.tokens,vocab)){counts[s.label][i]+=c;totals[s.label]+=c;}});
  if(docs.some(n=>!n))throw new Error('训练集必须包含两个类别');
  const logLikelihood=counts.map((r,c)=>[...r].map(x=>Math.log((x+alpha)/(totals[c]+alpha*vocab.length)))),logPrior=docs.map(n=>Math.log(n/samples.length));
  return{schema:1,algorithm:'NB',id:`NB-${fingerprint({counts:counts.map(r=>[...r]),vocab})}`,vocab,classes,logLikelihood,logPrior,alpha,preprocessing:PREPROCESSING,version:VERSION,source:'多项式朴素贝叶斯；训练词计数与Laplace平滑，概率未经校准'};
}
export function predictNB(model,tokens,{trace=true}={}){const counts=bow(tokens,model.vocab),scores=model.logPrior.map((p,c)=>p+[...counts].reduce((s,[i,n])=>s+n*model.logLikelihood[c][i],0)),p=softmax(scores);return{prediction:p[1]>p[0]?1:0,probabilities:p,logits:scores,modelId:model.id,oov:counts.get(0)??0,terms:trace?[...counts].map(([i,count])=>({word:model.vocab[i],count,contribution:model.logLikelihood.map(r=>count*r[i])})):[]};}
export function hingeObjective(weights,bias,features,y,lambda=.01){const score=[...features].reduce((s,[i,n])=>s+weights[i]*n,bias),margin=y*score,loss=Math.max(0,1-margin)+lambda/2*weights.reduce((s,w)=>s+w*w,0),gradient=weights.map(w=>lambda*w);if(margin<1)for(const[i,n]of features)gradient[i]-=y*n;return{loss,score,gradient,gradientBias:margin<1?-y:0};}
export async function* trainSVM(samples,vocab,{epochs=30,lr=.03,lambda=.01,seed=42,classes=['负向','正向']}={}){
  const weights=Array(vocab.length).fill(0),random=rng(seed);let bias=0,updates=0;const history=[],features=samples.map(s=>({x:bow(s.tokens,vocab),y:s.label===1?1:-1}));
  for(let e=0;e<epochs;e++){let loss=0;for(const{x,y}of shuffle(features,random)){const result=hingeObjective(weights,bias,x,y,lambda);const rate=lr/(1+updates*.001);weights.forEach((w,i)=>weights[i]=w-rate*result.gradient[i]);bias-=rate*result.gradientBias;loss+=result.loss;updates++;if(updates%128===0)yield{processed:e*samples.length+(updates%samples.length),total:epochs*samples.length,loss:result.loss,model:'SVM'};}history.push({epoch:e+1,loss:loss/samples.length});}
  return{schema:1,algorithm:'SVM',vocab,classes,weights,bias,id:`SVM-${fingerprint({weights,bias,vocab})}`,history,preprocessing:PREPROCESSING,version:VERSION,source:'线性 SVM · hinge+L2 · 原始决策分数，未校准',trainConfig:{epochs,lr,lambda,seed}};
}
export function predictSVM(model,tokens,{trace=true}={}){const x=bow(tokens,model.vocab),score=[...x].reduce((s,[i,n])=>s+model.weights[i]*n,model.bias);return{prediction:score>0?1:0,score,probabilities:null,logits:[-score,score],modelId:model.id,oov:x.get(0)??0,terms:trace?[...x].map(([i,n])=>({word:model.vocab[i],count:n,contribution:n*model.weights[i]})):[]};}
export function predict(model,tokens,{trace=false,target=0}={}){if(model.algorithm==='NB')return predictNB(model,tokens,{trace});if(model.algorithm==='SVM')return predictSVM(model,tokens,{trace});return neuralForward(model,tokens,{trace,target});}
export async function* trainComparison({dataset,epochs=20,lr=.03,dim=8,hidden=8,seed=42,batch=4,embedding=null,embeddingRemap=false,modelNames=names}){
  if(!Array.isArray(modelNames)||!modelNames.length||new Set(modelNames).size!==modelNames.length||modelNames.some(n=>!names.includes(n)))throw new Error('请选择 NB/SVM/RNN/CNN 中至少一个模型');
  if(!Number.isInteger(epochs)||epochs<1||epochs>100||!(lr>0&&lr<=1)||!Number.isInteger(batch)||batch<1||batch>64)throw new Error('训练参数超出预算');
  const samples=dataset.samples.filter(s=>s.split==='train'&&s.label!=null);if(!samples.length)throw new Error('没有已标注训练样本');if(!samples.some(s=>s.label===0)||!samples.some(s=>s.label===1))throw new Error('训练集需要两个类别');
  const vocab=makeVocab(samples),models={},histories={};
  if(vocab.length>20000)throw new Error('训练词表超过20,000词预算');
  if(modelNames.includes('NB')){models.NB=trainNB(samples,vocab,dataset.classes);models.NB.method=dataset.method;}
  if(modelNames.includes('SVM')){models.SVM=yield* trainSVM(samples,vocab,{epochs,lr,seed,classes:dataset.classes});models.SVM.method=dataset.method;}
  for(const algorithm of ['RNN','CNN'].filter(n=>modelNames.includes(n))){
    yield{processed:0,total:epochs*samples.length,stage:`训练 ${algorithm}`};
    const m=createNeural({algorithm,vocab,dim,hidden,widths:[2,3],filters:3,seed,embedding,embeddingRemap,classes:dataset.classes,method:dataset.method});
    const result=yield* trainNeural(m,samples,{epochs,lr,seed,batch});models[algorithm]=result.model;histories[algorithm]=result.history;
  }
  const evaluated=yield* evaluateBatch({models,samples:dataset.samples.filter(s=>s.split==='test'),classes:dataset.classes,modelNames});
  return{models,histories,...evaluated,dataFingerprint:fingerprint(dataset.samples),config:{epochs,lr,dim,hidden,seed,batch,embeddingId:embedding?.id??null},modelId:Object.values(models).map(m=>m.id).join(' / ')};
}
export async function* evaluateBatch({models,samples,classes=['负向','正向'],modelNames=names}){
  if(!Array.isArray(modelNames)||!modelNames.length||new Set(modelNames).size!==modelNames.length||modelNames.some(n=>!names.includes(n)||!models[n]))throw new Error('待评测模型缺失或无效');
  if(!samples.length)throw new Error('没有待预测样本');if(samples.length>50000)throw new Error('最多50,000条批量样本');if(samples.some(s=>s.tokens.length>128))throw new Error('批量推理上限128 Token；请显式选择分段，未处理超限样本');
  const rows=[];const started=performance.now();
  for(let i=0;i<samples.length;i++){
    const predictions=Object.fromEntries(modelNames.map(name=>[name,predict(models[name],samples[i].tokens,{target:samples[i].label??0})]));
    rows.push({...samples[i],predictions});if(i%64===0)yield{processed:i+1,total:samples.length,stage:'四模型推理'};
  }
  const results=Object.fromEntries(modelNames.map(name=>[name,metrics(rows.map(r=>r.label),rows.map(r=>r.predictions[name].prediction))]));
  return{rows,metrics:results,classes,modelNames,diagnostics:Object.fromEntries(modelNames.map(name=>[name,diagnose(rows,name)])),processed:samples.length,elapsedMs:performance.now()-started};
}
/** Held-out Platt calibration; optional and explicit, never fit on test labels. */
export function calibrate(scores,labels,steps=300,lr=.05){let a=0,b=0;for(let t=0;t<steps;t++){let ga=0,gb=0;scores.forEach((s,i)=>{const e=sigmoid(a*s+b)-labels[i];ga+=e*s/scores.length;gb+=e/scores.length;});a-=lr*ga;b-=lr*gb;}return{method:'Platt logistic',a,b,samples:scores.length};}
