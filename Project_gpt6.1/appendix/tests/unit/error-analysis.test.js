import { describe, it, expect } from '../../../tools/testing/vitest.js';
import { diagnose } from '../../../src/algorithms/diagnosis.js';
import { analyzeError } from '../../../src/algorithms/error-analysis.js';
import { trainNB, predict } from '../../../src/algorithms/classifiers.js';
import { createNeural } from '../../../src/algorithms/neural.js';

describe('错误分析基于实际计算', () => {
  it('切片与补集分母、类别分布和小样本风险可核对', () => {
    const row=(id,label,prediction,oov,text)=>({id,label,text,tokens:['a'],predictions:{NB:{prediction,oov,probabilities:[.95,.05]}}});
    const rows=[row('a',1,0,1,'不好🙂'),row('b',0,0,0,'好'),row('c',null,0,1,'不明')];
    const d=diagnose(rows,'NB',{dataset:{samples:[{split:'train',label:0},{split:'train',label:1}]}});
    expect(d.distribution).toEqual([{label:0,actual:1,predicted:2,train:1},{label:1,actual:1,predicted:0,train:1}]);
    expect(d.findings.find(f=>f.id==='oov').observed).toContain('错 1/1；无 OOV：错 0/1');
    expect(d.findings.find(f=>f.id==='oov').observed).toContain('100.0 个百分点');
    expect(d.findings.find(f=>f.id==='oov').caution).toContain('不足10条');
    expect(d.findings[0].hypothesis).toContain('全部预测为同一类');
    expect(d.certainty.highConfidenceErrors).toBe(1);
    expect(d.slices.find(s=>s.id==='emoji').errors).toBe(1);
  });
  it('SVM certainty 是绝对margin，未标注不入诊断；没有两组不编造差异', () => {
    const r={id:'a',label:1,text:'好',tokens:['好'],predictions:{SVM:{prediction:0,score:-2,oov:0}}};
    const d=diagnose([r,{...r,label:null}],'SVM');
    expect(d.certainty).toEqual({correct:null,wrong:2,highConfidenceErrors:null});
    expect(d.findings.map(f=>f.id)).toEqual(['class-bias']);
    expect(diagnose([],'NB').findings).toEqual([]);
  });
  it('训练日志只描述观测，不声称验证集过拟合', () => {
    const d=diagnose([],'RNN',{histories:{RNN:[{loss:.8},{loss:.2}]}});
    expect(d.findings[0].observed).toContain('0.80000，末轮 0.20000');
    expect(d.findings[0].caution).toContain('缺少逐轮验证损失');
  });
  const vocab=['<UNK>','bad','good'],tokens=['good','mystery','bad','good'];
  const models={NB:trainNB([{label:0,tokens:['bad','bad']},{label:1,tokens:['good','good']}],vocab),
    SVM:{algorithm:'SVM',id:'fixture-svm',vocab,classes:['负向','正向'],weights:[.2,-.4,.7],bias:-.1},
    RNN:createNeural({algorithm:'RNN',vocab,dim:2,hidden:2}),CNN:createNeural({algorithm:'CNN',vocab,dim:2,hidden:2})};
  for(const [name,model] of Object.entries(models)) it(`${name} 全贡献加和、原预测复算、删除复算独立一致，输入权重不变`,()=>{
    const prediction=predict(model,tokens),row={id:'fixture-error',tokens,text:tokens.join(' '),label:1-prediction.prediction,predictions:{[name]:prediction}};
    const before=JSON.stringify({model,row}),a=analyzeError(model,row);
    expect(a.decisionGap).toBeGreaterThanOrEqual(0);
    expect(a.contributionSum).toBeCloseTo(a.decisionGap,12); expect(Math.abs(a.residual)).toBeLessThan(1e-12);
    expect(a.unknown).toEqual([{token:'mystery',position:1}]);
    expect(a.probes.length).toBeGreaterThan(0); expect(a.probes.length).toBeLessThanOrEqual(3);
    for(const probe of a.probes){const r=predict(model,tokens.filter((_,i)=>i!==probe.position));
      const gap=name==='SVM'?(a.predicted===1?1:-1)*r.score:r.logits[a.predicted]-r.logits[a.target];
      expect(probe.prediction).toBe(r.prediction); expect(probe.gap).toBeCloseTo(gap,12); expect(probe.delta).toBeCloseTo(gap-a.decisionGap,12);
    }
    if(name==='CNN'){const r=predict(model,tokens,{trace:true}); for(const t of a.terms){expect(r.features.some(f=>f.winner===t.position&&tokens.slice(f.winner,f.winner+f.width).join(' / ')===t.context)).toBe(true);}}
    expect(JSON.stringify({model,row})).toBe(before);
  });
  it('拒绝未标注和不是同一原模型的解释',()=>{
    const model=models.RNN,r=predict(model,tokens),row={id:'test',tokens,label:1-r.prediction,predictions:{RNN:{...r,modelId:'wrong'}}};
    expect(()=>analyzeError(model,row)).toThrow('不一致'); expect(()=>analyzeError(model,{...row,label:null})).toThrow('真实标签');
  });
  it('单Token不生成空序列扰动',()=>{
    const model=models.NB,tokens=['good'],r=predict(model,tokens);
    expect(analyzeError(model,{id:'one',tokens,label:1-r.prediction,predictions:{NB:r}}).probes).toEqual([]);
  });
});
