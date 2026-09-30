import { rng, shuffle, fingerprint, numericOps, Tape, softmax, crossEntropy, norm, VERSION } from '../core/math.js';
import { validateSequence, PREPROCESSING } from '../data/datasets.js';

export function makeVocab(samples){return ['<UNK>',...[...new Set(samples.flatMap(s=>s.tokens))].filter(t=>t!=='<UNK>').sort()];}
export function createNeural({algorithm='RNN',vocab=['<UNK>','我','喜欢','语言'],dim=4,hidden=4,widths=[2,3],filters=2,seed=42,embedding=null,embeddingRemap=false,classes=['负向','正向'],method='character'}={}){
  if(!['RNN','LSTM','GRU','CNN'].includes(algorithm)||!Number.isInteger(dim)||dim<1||dim>64||!Number.isInteger(hidden)||hidden<1||hidden>64||vocab.length>20000||!widths.length||widths.some(w=>!Number.isInteger(w)||w<1||w>8)||!Number.isInteger(filters)||filters<1||filters>16)throw new Error('神经模型结构超出有效预算');
  if(embedding&&(embedding.dim!==dim||embedding.preprocessing!==PREPROCESSING))throw new Error('词向量维度或预处理版本不兼容，需要显式重映射/重新初始化');
  if(embedding&&embedding.method!==method&&!embeddingRemap)throw new Error('词向量分词方式不兼容，请显式确认按 Token 交集重映射，或使用相同分词重新训练');
  const random=rng(seed),weights={},shapes={};
  function param(name,shape,scale=.3,bias=0){shapes[name]=shape;weights[name]=Array.from({length:shape.reduce((a,b)=>a*b,1)},()=>bias||((random()*2-1)*scale));}
  param('E',[vocab.length,dim],.3);
  if(embedding){const map=new Map(embedding.vocab.map((t,i)=>[t,i]));vocab.forEach((t,i)=>{const index=map.get(t);if(index!=null)for(let j=0;j<dim;j++)weights.E[i*dim+j]=embedding.vectors[index][j];});}
  const gates=algorithm==='LSTM'?['i','f','o','g']:algorithm==='GRU'?['z','r','n']:['h'];
  if(algorithm==='CNN'){for(let k=0;k<widths.length;k++)for(let f=0;f<filters;f++){param(`K${k}_${f}`,[widths[k],dim],.4);param(`bK${k}_${f}`,[1],0,.05);}}
  else for(const gate of gates){param(`W${gate}`,[hidden,dim],1/Math.sqrt(dim));param(`U${gate}`,[hidden,hidden],1/Math.sqrt(hidden));param(`b${gate}`,[hidden],0,gate==='f'?1:0);}
  const features=algorithm==='CNN'?widths.length*filters:hidden;
  param('C',[2,features],1/Math.sqrt(features));param('bC',[2],0);
  return {schema:1,algorithm,structure:{dim,hidden,widths,filters},vocab,classes,weights,shapes,preprocessing:PREPROCESSING,method,version:VERSION,source:'可播种教学初始化（未经训练）',seed,embeddingId:embedding?.id??null,id:`teaching-${fingerprint({algorithm,seed,dim,hidden,widths,filters})}`,trained:false};
}
export function validateModel(m){
  if(!m||m.schema!==1||m.version!==VERSION||m.preprocessing!==PREPROCESSING||!['RNN','LSTM','GRU','CNN'].includes(m.algorithm)||!Array.isArray(m.vocab)||m.vocab[0]!=='<UNK>'||new Set(m.vocab).size!==m.vocab.length||m.vocab.some(t=>typeof t!=='string')||!Array.isArray(m.classes)||m.classes.length!==2)throw new Error('模型 schema、版本、词表或类别顺序无效');
  const ref=createNeural({...m.structure,algorithm:m.algorithm,vocab:m.vocab,classes:m.classes});
  for(const[k,shape]of Object.entries(ref.shapes)){if(!Array.isArray(m.weights?.[k])||m.weights[k].length!==shape.reduce((a,b)=>a*b,1)||m.weights[k].some(v=>!Number.isFinite(v)))throw new Error(`模型权重 ${k} 形状或数值无效`);}
  return m;
}
/** Numeric and differentiable modes use exactly the same forward equations. */
export function neuralForward(model,tokens,{gradient=false,target=0,trace=true}={}){
  validateSequence(tokens,1024);
  const ops=gradient?new Tape():numericOps, {dim:d,hidden:h,widths,filters}=model.structure;
  const P=gradient?Object.fromEntries(Object.entries(model.weights).map(([k,v])=>[k,v.map(x=>ops.v(x))])):model.weights;
  const map=new Map(model.vocab.map((t,i)=>[t,i])),ids=tokens.map(t=>map.get(t)??0),X=ids.map(i=>P.E.slice(i*d,(i+1)*d)),zero=()=>ops.v(0),one=()=>ops.v(1),states=[],features=[],stateRefs=[];
  const total=terms=>terms.reduce((s,t)=>ops.add(s,t),zero());
  const affine=(gate,x,previous)=>Array.from({length:h},(_,i)=>total([P[`b${gate}`][i],...x.map((v,j)=>ops.mul(P[`W${gate}`][i*d+j],v)),...previous.map((v,j)=>ops.mul(P[`U${gate}`][i*h+j],v))]));
  const nums=a=>a.map(x=>ops.val(x));
  let pooled=[];
  if(model.algorithm==='CNN'){
    for(let k=0;k<widths.length;k++)for(let f=0;f<filters;f++){
      const width=widths[k],K=P[`K${k}_${f}`],b=P[`bK${k}_${f}`][0],featureMap=[],raw=[],positions=Math.max(1,X.length-width+1);
      for(let t=0;t<positions;t++){
        const terms=[];for(let j=0;j<width;j++)for(let q=0;q<d;q++)terms.push(ops.mul(K[j*d+q],X[t+j]?.[q]??zero()));
        const score=total([b,...terms]);raw.push(score);featureMap.push(ops.relu(score));
      }
      let winner=0;for(let t=1;t<featureMap.length;t++)if(ops.val(featureMap[t])>ops.val(featureMap[winner]))winner=t;
      pooled.push(featureMap[winner]);
      if(trace)features.push({kernel:k,filter:f,width,weights:nums(K),bias:ops.val(b),raw:nums(raw),activations:nums(featureMap),winner,value:ops.val(featureMap[winner])});
    }
  }else{
    let previous=Array.from({length:h},zero),cell=Array.from({length:h},zero);
    X.forEach((x,t)=>{
      const old=previous,oldCell=cell,gates={};
      if(model.algorithm==='RNN'){previous=affine('h',x,old).map(v=>ops.tanh(v));}
      if(model.algorithm==='LSTM'){
        for(const gate of ['i','f','o'])gates[gate]=affine(gate,x,old).map(v=>ops.sigmoid(v));gates.g=affine('g',x,old).map(v=>ops.tanh(v));
        cell=cell.map((v,i)=>ops.add(ops.mul(gates.f[i],v),ops.mul(gates.i[i],gates.g[i])));
        previous=cell.map((v,i)=>ops.mul(gates.o[i],ops.tanh(v)));
      }
      if(model.algorithm==='GRU'){
        gates.z=affine('z',x,old).map(v=>ops.sigmoid(v));gates.r=affine('r',x,old).map(v=>ops.sigmoid(v));
        gates.n=affine('n',x,old.map((v,i)=>ops.mul(gates.r[i],v))).map(v=>ops.tanh(v));
        previous=old.map((v,i)=>ops.add(ops.mul(gates.z[i],v),ops.mul(ops.add(one(),ops.mul(ops.v(-1),gates.z[i])),gates.n[i])));
      }
      stateRefs.push(previous);
      if(trace)states.push({step:t,token:tokens[t],x:nums(x),previous:nums(old),hidden:nums(previous),cell:model.algorithm==='LSTM'?nums(cell):null,previousCell:model.algorithm==='LSTM'?nums(oldCell):null,gates:Object.fromEntries(Object.entries(gates).map(([k,v])=>[k,nums(v)]))});
    });
    pooled=previous;
  }
  const logits=Array.from({length:2},(_,c)=>total([P.bC[c],...pooled.map((v,j)=>ops.mul(P.C[c*pooled.length+j],v))]));
  const scores=nums(logits),probabilities=softmax(scores),prediction=probabilities[1]>probabilities[0]?1:0;
  const result={logits:scores,probabilities,prediction,modelId:model.id,oov:ids.filter(i=>i===0).length,embedding:trace?X.map(nums):[],states,features,pooled:nums(pooled),loss:crossEntropy(scores,target),lossTarget:target};
  if(gradient){const loss=ops.ce(logits,target);ops.backward(loss);result.gradients=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,v.map(n=>n.grad)]));result.stateGradients=stateRefs.map(s=>s.map(v=>v.grad));result.gradientNorm=norm(Object.values(result.gradients).flat());}
  return result;
}
export async function* trainNeural(model,samples,{epochs=20,lr=.03,batch=4,seed=42,clip=5}={}){
  if(!samples.length||samples.some(s=>s.label!==0&&s.label!==1))throw new Error('神经模型训练需要已标注二分类训练样本');
  if(!(lr>0&&lr<=1)||epochs<1||epochs>100||batch<1||batch>64)throw new Error('训练预算无效');
  if(samples.some(s=>s.tokens.length>128))throw new Error('浏览器训练长度上限128 Token；请显式预处理/分段');
  model=structuredClone(model);const random=rng(seed),history=[];let updates=0,lastYield=performance.now();
  for(let epoch=0;epoch<epochs;epoch++){
    const order=shuffle(samples,random);let loss=0,preClip=0,postClip=0;
    for(let offset=0;offset<order.length;offset+=batch){
      const chunk=order.slice(offset,offset+batch),grad=Object.fromEntries(Object.entries(model.weights).map(([k,w])=>[k,new Float64Array(w.length)]));
      for(const sample of chunk){const r=neuralForward(model,sample.tokens,{gradient:true,target:sample.label,trace:false});loss+=r.loss;for(const[k,g]of Object.entries(r.gradients))g.forEach((v,i)=>grad[k][i]+=v/chunk.length);}
      const n=Math.sqrt(Object.values(grad).reduce((s,g)=>s+g.reduce((a,b)=>a+b*b,0),0)),factor=clip&&n>clip?clip/n:1;preClip=n;postClip=n*factor;
      for(const[k,w]of Object.entries(model.weights))w.forEach((v,i)=>{w[i]=v-lr*grad[k][i]*factor;if(!Number.isFinite(w[i]))throw new Error(`第 ${updates} 步权重 ${k} 非有限`);});
      updates++;if(updates%4===0||performance.now()-lastYield>=50){lastYield=performance.now();yield{processed:epoch*samples.length+Math.min(offset+batch,order.length),total:epochs*samples.length,loss:loss/Math.min(offset+batch,order.length),epoch:epoch+1,updates};}
    }
    history.push({epoch:epoch+1,loss:loss/samples.length,preClip,postClip,updates});yield{processed:(epoch+1)*samples.length,total:epochs*samples.length,loss:loss/samples.length,epoch:epoch+1};
  }
  model.trained=true;model.source='本项目 CPU 参考实现训练；未做概率校准';model.trainConfig={epochs,lr,batch,seed,clip,samples:samples.length,dataFingerprint:fingerprint(samples)};model.lastGradient={before:history.at(-1).preClip,after:history.at(-1).postClip,threshold:clip,scope:'最后一个真实训练批次的全参数梯度'};model.id=`${model.algorithm}-${fingerprint(model.weights)}`;
  return{model,history,checkpoint:{weights:model.weights,optimizer:'SGD',randomState:random.state(),dataPosition:0,version:VERSION}};
}
