import { predict } from './classifiers.js';

// Explanations and interventions use the exact evaluated weights and Token sequence.
// Contributions explain the score, not why the human label should be different.
export function analyzeError(model, row, { probeLimit = 3 } = {}) {
  if (![0,1].includes(row.label)) throw new Error('深入诊断需要二分类真实标签');
  const result = predict(model, row.tokens, { trace: true, target: row.label });
  const cached = row.predictions?.[model.algorithm];
  if (cached && (cached.modelId !== model.id || cached.prediction !== result.prediction || cached.logits.some((x,i)=>Math.abs(x-result.logits[i])>1e-9))) throw new Error('原模型复算与记录不一致；请重新评测后再诊断');
  const predicted = result.prediction, target = row.label, direction = predicted === 1 ? 1 : -1;
  const gap = r => model.algorithm === 'SVM' ? direction * r.score : r.logits[predicted] - r.logits[target];
  let bias, terms, mechanism;
  if (model.algorithm === 'NB') {
    bias = model.logPrior[predicted] - model.logPrior[target];
    terms = result.terms.map(t=>({feature:t.word,count:t.count,value:t.contribution[predicted]-t.contribution[target]}));
    mechanism = '词计数×两类条件对数概率差，再加先验差。词袋忽略顺序，同词计数的句子打分相同。';
  } else if (model.algorithm === 'SVM') {
    bias = direction * model.bias;
    terms = result.terms.map(t=>({feature:t.word,count:t.count,value:direction*t.contribution}));
    mechanism = '每项词计数×线性权重，加偏置；本表按预测类别方向表示分数，正值支持当前预测。margin 不是概率。';
  } else {
    bias = model.weights.bC[predicted]-model.weights.bC[target];
    terms = result.pooled.map((v,i)=>({feature:model.algorithm==='CNN'?`核 ${result.features[i].kernel+1} / 通道 ${result.features[i].filter+1}`:`末态维度 ${i+1}`,
      value:(model.weights.C[predicted*result.pooled.length+i]-model.weights.C[target*result.pooled.length+i])*v,
      activation:v, context:model.algorithm==='CNN'?row.tokens.slice(result.features[i].winner,result.features[i].winner+result.features[i].width).join(' / '):null,
      position:model.algorithm==='CNN'?result.features[i].winner:null}));
    mechanism = model.algorithm==='CNN' ? '核窗口乘加→ReLU→最大池化→分类。表中窗口是该核真实 argmax；零激活时窗口不代表语义关注。' : '逐 Token 递推到末态，再用分类权重得到 logits。末态维度贡献不是逐词归因，不能把隐藏维度直接命名为某种情感。';
  }
  const contributionSum = bias + terms.reduce((s,t)=>s+t.value,0), decisionGap = gap(result);
  terms.sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
  const vocab = new Set(model.vocab);
  const unknown = row.tokens.flatMap((token,position)=>!vocab.has(token)?[{token,position}]:[]);
  const candidatePositions = ['NB','SVM'].includes(model.algorithm)
    ? terms.flatMap(t=>row.tokens.flatMap((token,i)=>(vocab.has(token)?token:'<UNK>')===t.feature?[i]:[]))
    : model.algorithm==='CNN' ? terms.flatMap(t=>t.position==null?[]:[t.position]) : [0,Math.floor(row.tokens.length/2),row.tokens.length-1];
  const positions = [...new Set(candidatePositions)].filter(i=>i>=0&&i<row.tokens.length).slice(0,Math.max(0,Math.min(3,probeLimit)));
  const probes = row.tokens.length < 2 ? [] : positions.map(position=>{
    const tokens=row.tokens.filter((_,i)=>i!==position), next=predict(model,tokens,{target:row.label});
    return {position,token:row.tokens[position],prediction:next.prediction,gap:gap(next),delta:gap(next)-decisionGap,oov:next.oov};
  });
  return {modelId:model.id,sampleId:row.id,predicted,target,decisionGap,bias,terms,contributionSum,
    residual:contributionSum-decisionGap,unknown,mechanism,probes,states:(result.states??[]).map(s=>({step:s.step,token:s.token,norm:Math.hypot(...s.hidden)})),
    probePolicy:model.algorithm==='RNN'?'删除首 / 中 / 末位置 Token，最多3次':'按贡献绝对值较大的词项或池化窗口起点删除一个 Token，最多3次',
    limits:'删除实验固定原权重和其余 Token，不训练、不替换原结果；新序列可能不自然。分数变化是此模型对扰动的敏感性，不证明该词造成原文本语义错判。'};
}
