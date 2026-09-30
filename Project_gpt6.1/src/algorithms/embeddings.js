import { rng, sigmoid, dot, fingerprint, pca, cosine, norm, VERSION } from '../core/math.js';
import { tokenize, PREPROCESSING } from '../data/datasets.js';

export function* windows(tokens,size=2){for(let i=0;i<tokens.length;i++){const context=[];for(let j=Math.max(0,i-size);j<=Math.min(tokens.length-1,i+size);j++)if(j!==i)context.push(tokens[j]);if(context.length)yield{center:tokens[i],context,index:i};}}
export function negativeSampler(counts,random){const weights=counts.map(c=>c**.75),total=weights.reduce((a,b)=>a+b,0);let s=0;const cumulative=weights.map(v=>(s+=v)/total);return positive=>{let selected;for(let tries=0;tries<30;tries++){const r=random();let lo=0,hi=cumulative.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(r>cumulative[mid])lo=mid+1;else hi=mid;}selected=lo;if(selected!==positive)return selected;}return(positive+1)%counts.length;};}
export function nsObjective(input,outputs,labels){
  const scores=outputs.map(o=>dot(input,o)),gradient=Array(input.length).fill(0),outputGradients=[];let loss=0;
  scores.forEach((z,i)=>{const g=sigmoid(z)-labels[i];loss+=Math.max(z,0)-labels[i]*z+Math.log1p(Math.exp(-Math.abs(z)));outputs[i].forEach((v,j)=>gradient[j]+=g*v);outputGradients.push(input.map(v=>g*v));});
  return{scores,loss,gradient,outputGradients};
}
export function gloveObjective(w,c,bi,bj,count,xmax=100,alpha=.75){const residual=dot(w,c)+bi+bj-Math.log(count),weight=Math.min(1,(count/xmax)**alpha);return{loss:weight*residual**2,residual,weight,gradientW:c.map(v=>2*weight*residual*v),gradientC:w.map(v=>2*weight*residual*v),gradientBias:2*weight*residual};}
export async function* trainEmbeddings(config){
  const {corpus,method='space',algorithm='skipgram',dim=8,window=2,negatives=5,epochs=10,lr=.03,seed=42,basis=null}=config;
  if(!['skipgram','cbow','glove'].includes(algorithm)||dim<2||dim>64||window<1||window>10||epochs<1||epochs>100||!(lr>0&&lr<=.2)||negatives<1||negatives>20)throw new Error('词向量参数超出预算');
  const sentences=corpus.split(/\r?\n/).map(s=>tokenize(s,method)).filter(s=>s.length),tokens=sentences.flat();
  if(tokens.length>1000000)throw new Error('词向量训练上限 1,000,000 Token，请分批');
  const countsMap=new Map();tokens.forEach(t=>countsMap.set(t,(countsMap.get(t)??0)+1));
  const vocab=[...countsMap.keys()].sort();if(vocab.length<2||vocab.length>20000)throw new Error('词表需要 2–20,000 个不同 Token');
  const index=new Map(vocab.map((t,i)=>[t,i])),counts=vocab.map(t=>countsMap.get(t)),encoded=sentences.map(s=>s.map(t=>index.get(t))),random=rng(seed),sample=negativeSampler(counts,random);
  const E=Array.from({length:vocab.length},()=>Float64Array.from({length:dim},()=>((random()*2-1)/dim))),O=Array.from({length:vocab.length},()=>Float64Array.from({length:dim},()=>((random()*2-1)/dim)));
  const bi=new Float64Array(vocab.length),bj=new Float64Array(vocab.length),history=[],coocc=new Map();let lastTrace=null,updates=0;
  if(algorithm==='glove'){
    for(let s=0;s<encoded.length;s++){
      const sentence=encoded[s];for(let i=0;i<sentence.length;i++)for(let j=Math.max(0,i-window);j<=Math.min(sentence.length-1,i+window);j++)if(i!==j){const key=sentence[i]*vocab.length+sentence[j];coocc.set(key,(coocc.get(key)??0)+1/Math.abs(i-j));}
      if(s%32===0)yield{processed:s,total:encoded.length,stage:'共现统计'};
    }
    if(coocc.size>2000000)throw new Error('非零共现超出 2,000,000 条预算');
  }
  for(let epoch=0;epoch<epochs;epoch++){
    let loss=0,events=0;
    if(algorithm==='glove'){
      for(const[key,count]of coocc){
        const i=Math.floor(key/vocab.length),j=key%vocab.length,r=gloveObjective([...E[i]],[...O[j]],bi[i],bj[j],count),before=[...E[i]],contextBefore=[...O[j]],biasBefore=[bi[i],bj[j]],predictedBefore=dot(before,contextBefore)+bi[i]+bj[j];
        for(let d=0;d<dim;d++){E[i][d]-=lr*r.gradientW[d];O[j][d]-=lr*r.gradientC[d];}bi[i]-=lr*r.gradientBias;bj[j]-=lr*r.gradientBias;
        loss+=r.loss;events++;updates++;lastTrace={center:vocab[i],contexts:[vocab[j]],count,contextBefore,biasBefore,predictedBefore,predictedAfter:dot([...E[i]],[...O[j]])+bi[i]+bj[j],before,after:[...E[i]],...r};
        if(events%256===0)yield{processed:epoch*coocc.size+events,total:epochs*coocc.size,loss:loss/events,epoch:epoch+1};
      }
    }else{
      for(const sentence of encoded)for(const{center,context}of windows(sentence,window)){
        const tasks=algorithm==='cbow'?[{sources:context,target:center}]:context.map(target=>({sources:[center],target}));
        for(const{sources,target}of tasks){
          const input=Array.from({length:dim},(_,d)=>sources.reduce((s,i)=>s+E[i][d],0)/sources.length),targets=[target,...Array.from({length:negatives},()=>sample(target))],labels=targets.map((_,i)=>Number(i===0));
          const result=nsObjective(input,targets.map(i=>[...O[i]]),labels),before=[...E[sources[0]]];
          for(let d=0;d<dim;d++)for(const i of sources)E[i][d]-=lr*result.gradient[d]/sources.length;
          targets.forEach((i,k)=>{for(let d=0;d<dim;d++)O[i][d]-=lr*result.outputGradients[k][d];});
          loss+=result.loss;events++;updates++;lastTrace={center:vocab[center],updatedWord:vocab[sources[0]],contexts:context.map(i=>vocab[i]),sources:sources.map(i=>vocab[i]),positive:vocab[target],negatives:targets.slice(1).map(i=>vocab[i]),before,after:[...E[sources[0]]],input,...result};
          if(updates%512===0)yield{processed:updates,total:null,loss:loss/events,epoch:epoch+1};
        }
      }
    }
    if(!events)throw new Error('语料没有可训练上下文；请至少在一行输入两个词');
    const value=loss/events;if(!Number.isFinite(value))throw new Error(`第 ${epoch+1} 轮损失非有限，停止训练`);
    history.push({epoch:epoch+1,loss:value,updates,events});yield{processed:epoch+1,total:epochs,loss:value,epoch:epoch+1};
  }
  const vectors=E.map((v,i)=>algorithm==='glove'?[...v].map((x,d)=>x+O[i][d]):[...v]), projection=pca(vectors,basis?.center.length===dim&&(!config.basisVocab||JSON.stringify(config.basisVocab)===JSON.stringify(vocab))?basis:null);
  const artifact={schema:1,id:`${algorithm}-${fingerprint(vectors)}`,algorithm,dim,vocab,vectors,outputVectors:O.map(v=>[...v]),counts,preprocessing:PREPROCESSING,method,version:VERSION,source:'用户语料或项目原创教学语料；本地 SGD 训练',config:structuredClone(config),history,projection,lastTrace,cooccurrence:coocc.size,tokenCount:tokens.length,checkpoint:{weights:{input:E.map(v=>[...v]),output:O.map(v=>[...v]),bi:[...bi],bj:[...bj]},optimizer:'SGD',randomState:random.state(),dataPosition:0,version:VERSION}};
  return artifact;
}
export function neighbors(artifact,query,k=10,exclude=[]){const vector=typeof query==='string'?artifact.vectors[artifact.vocab.indexOf(query)]:query;if(!vector)throw new Error('查询词不在词表中（OOV）');if(!norm(vector))throw new Error('查询向量为零，余弦未定义');return artifact.vocab.map((word,i)=>({word,index:i,similarity:cosine(vector,artifact.vectors[i])})).filter(r=>!exclude.includes(r.word)&&r.word!==query).sort((a,b)=>b.similarity-a.similarity).slice(0,k);}
export function analogy(artifact,a,b,c,k=5){const ids=[a,b,c].map(t=>artifact.vocab.indexOf(t));if(ids.some(i=>i<0))throw new Error('类比输入包含 OOV');const vector=artifact.vectors[ids[0]].map((v,j)=>artifact.vectors[ids[1]][j]-v+artifact.vectors[ids[2]][j]);return neighbors(artifact,vector,k,[a,b,c]);}
