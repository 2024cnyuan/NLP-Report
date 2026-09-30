export function metrics(truth,predictions,classes=2) {
  if(truth.length!==predictions.length)throw new Error('标签与预测长度不匹配');
  const cm=Array.from({length:classes},()=>Array(classes).fill(0));let n=0;
  truth.forEach((y,i)=>{if(y==null)return;if(!Number.isInteger(y)||y<0||y>=classes||!Number.isInteger(predictions[i])||predictions[i]<0||predictions[i]>=classes)throw new Error('类别索引无效');cm[y][predictions[i]]++;n++;});
  if(!n)return {count:0,accuracy:null,macroF1:null,confusion:cm,perClass:[]};
  const perClass=cm.map((row,c)=>{const tp=row[c],fp=cm.reduce((s,r)=>s+r[c],0)-tp,fn=row.reduce((s,x)=>s+x,0)-tp;const precision=tp+fp?tp/(tp+fp):0,recall=tp+fn?tp/(tp+fn):0;return {precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,support:tp+fn};});
  return {count:n,accuracy:cm.reduce((s,r,c)=>s+r[c],0)/n,macroF1:perClass.reduce((s,c)=>s+c.f1,0)/classes,confusion:cm,perClass};
}
