import {it,expect} from 'vitest';
import {matrixHTML} from '../../src/viz/charts.js';
import {rgb} from 'd3';
const luminance=s=>{const c=rgb(s);return[c.r,c.g,c.b].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);};
it('数值色带文字自动选择黑/白，contrast ≥4.5',()=>{for(const probability of [true,false]){const values=Array.from({length:101},(_,i)=>probability?i/100:(i-50)/50),html=matrixHTML([values],{probability,maxCols:101});for(const match of html.matchAll(/background:([^;]+);color:([^"]+)/g)){const a=luminance(match[1]),b=luminance(match[2]);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);}}});
