import {it,expect} from '../../../tools/testing/vitest.js';
import {attention,attentionBatched,teachingVectors} from '../../../src/algorithms/attention.js';
import {consume} from '../../../src/runtime/tasks.js';
it('分块注意力与完整参考精确一致，暂停/取消调度',async()=>{const v=teachingVectors(Array.from({length:33},(_,i)=>'t'+i)),c={Q:v,K:v,V:v,mask:v.map((_,i)=>v.map((_,j)=>j>i))};const expected=attention(c),progress=[];const actual=await consume(attentionBatched(c),{},p=>progress.push(p));expect(actual.weights).toEqual(expected.weights);expect(actual.output).toEqual(expected.output);expect(progress).toHaveLength(3);expect(progress.at(-1).processed).toBe(33);await expect(consume(attentionBatched(c),{cancelled:true})).rejects.toThrow('取消');});
