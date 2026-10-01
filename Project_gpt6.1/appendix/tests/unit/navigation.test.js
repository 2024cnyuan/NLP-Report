import { describe, it, expect } from '../../../tools/testing/vitest.js';
import { createNavigationJournal } from '../../../src/app/navigation.js';

describe('项目内连续导航', () => {
  it('起点没有返回，不包含项目外历史', () => {
    const n=createNavigationJournal('comparison/dataset','test');
    expect(n.back).toBeNull(); expect(n.forward).toBeNull();
    expect(n.visit('comparison/dataset',{session:'external',index:99,route:'comparison/dataset'}).index).toBe(0);
  });
  it('原生 hash 拷贝旧 marker 时追加，连续返回保留精确模式与位置', () => {
    const n=createNavigationJournal('home','test'), home=n.marker();
    n.saveScroll(100); const data=n.visit('comparison/dataset',home);
    expect(data.traversal).toBe(false); n.saveScroll(900);
    n.visit('sequence',n.marker()); expect(n.back).toBe('comparison/dataset');
    expect(n.visit('comparison/dataset',data)).toMatchObject({traversal:true,scroll:900,index:1});
    expect(n.forward).toBe('sequence');
    expect(n.visit('home',home)).toMatchObject({traversal:true,scroll:100,index:0});
    expect(n.back).toBeNull(); expect(n.forward).toBe('comparison/dataset');
  });
  it('返回后开新页面会截断前进分支，原路前进不增加记录', () => {
    const n=createNavigationJournal('home','test'),home=n.marker();
    n.visit('help/learning',home); const help=n.marker();
    n.visit('attention',help); const attention=n.marker();
    n.visit('help/learning',help); n.visit('attention',attention);
    expect(n.marker().index).toBe(2);
    n.visit('help/learning',help); n.visit('notebook',help);
    expect(n.forward).toBeNull(); expect(n.back).toBe('help/learning');
  });
  it('无效索引、不同会话或 route 不匹配不伪装成原生回退', () => {
    for(const marker of [{session:'test',index:-1,route:'data'},{session:'other',index:0,route:'data'},{session:'test',index:0,route:'home'}]) {
      const n=createNavigationJournal('home','test');
      expect(n.visit('data',marker)).toMatchObject({traversal:false,index:1});
    }
  });
});
