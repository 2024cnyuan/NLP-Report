import { scaleLinear, extent, zoom, select, zoomIdentity } from 'd3';

export function scatter(canvas,artifact,{selected=0,neighbors=[],onSelect=()=>{},onBrush=()=>{},baseline=null,minFrequency=1}={}){
  const context=canvas.getContext('2d');let transform=zoomIdentity,width=700,height=340,brush=null,frame=null;
  const coords=artifact.projection.points,all=baseline?[...coords,...baseline.projection.points]:coords;
  const dx=extent(all,p=>p[0]),dy=extent(all,p=>p[1]),px=(dx[1]-dx[0])*.15||1,py=(dy[1]-dy[0])*.2||1;
  let x,y;
  function render(){
    if(!canvas.isConnected)return;
    width=canvas.clientWidth||700;height=340;const ratio=window.devicePixelRatio||1;canvas.width=width*ratio;canvas.height=height*ratio;context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,width,height);
    x=scaleLinear().domain([dx[0]-px,dx[1]+px]).range([48,width-30]);y=scaleLinear().domain([dy[0]-py,dy[1]+py]).range([height-40,28]);
    const zx=transform.rescaleX(x),zy=transform.rescaleY(y);
    context.font='11px system-ui';context.strokeStyle='#e2ece7';context.fillStyle='#6a8585';context.lineWidth=1;
    for(const t of zx.ticks(5)){const xx=zx(t);context.beginPath();context.moveTo(xx,20);context.lineTo(xx,height-35);context.stroke();context.fillText(t.toFixed(2),xx-12,height-19);}
    for(const t of zy.ticks(4)){const yy=zy(t);context.beginPath();context.moveTo(45,yy);context.lineTo(width-20,yy);context.stroke();context.fillText(t.toFixed(2),6,yy+3);}
    context.fillText('PC1',width-45,height-5);context.fillText('PC2',6,14);
    if(baseline){context.fillStyle='#b4896260';for(const point of baseline.projection.points){const xx=zx(point[0]),yy=zy(point[1]);if(xx>=45&&xx<=width-20&&yy>=20&&yy<=height-35){context.beginPath();context.arc(xx,yy,2.5,0,Math.PI*2);context.fill();}}}
    const neighborIds=new Set(neighbors.map(n=>n.index)),chosen=coords[selected];
    if(chosen){context.strokeStyle='#99c3b799';for(const index of neighborIds){const p=coords[index];context.beginPath();context.moveTo(zx(chosen[0]),zy(chosen[1]));context.lineTo(zx(p[0]),zy(p[1]));context.stroke();}}
    const labels=[];
    coords.forEach((p,i)=>{const xx=zx(p[0]),yy=zy(p[1]),active=i===selected,near=neighborIds.has(i);if((artifact.counts[i]<minFrequency&&!active)||xx<45||xx>width-20||yy<20||yy>height-35)return;context.fillStyle=active?'#ad703b':near?'#238a7b':'#6a9f9977';context.beginPath();context.arc(xx,yy,active?6:near?4:2.5,0,Math.PI*2);context.fill();if(active||near)labels.push({xx,yy,i,active});});
    labels.sort((a,b)=>Number(b.active)-Number(a.active));const boxes=[];
    for(const {xx,yy,i,active}of labels){context.font=active?'bold 12px system-ui':'11px system-ui';const w=context.measureText(artifact.vocab[i]).width;const candidates=[[xx+8,yy-7],[xx-w-8,yy-7],[xx+8,yy+16],[xx-w-8,yy+16]];let found=false;
      for(const [lx,ly]of candidates){const box=[lx-3,ly-12,lx+w+3,ly+3];if(box[0]<45||box[2]>width-20||box[1]<20||box[3]>height-35)continue;if(!active&&boxes.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]))continue;context.fillStyle='#fbfdfcdd';context.fillRect(box[0],box[1],box[2]-box[0],box[3]-box[1]);context.fillStyle=active?'#9b612e':'#3d706c';context.fillText(artifact.vocab[i],lx,ly);boxes.push(box);found=true;break;}
      if(!found&&active){context.fillStyle='#9b612e';context.fillText(artifact.vocab[i],Math.min(xx+8,width-w-21),Math.max(32,yy-7));}
    }
    if(brush){context.strokeStyle='#087f8c';context.fillStyle='#087f8c15';context.fillRect(brush[0],brush[1],brush[2]-brush[0],brush[3]-brush[1]);context.strokeRect(brush[0],brush[1],brush[2]-brush[0],brush[3]-brush[1]);}
  }
  const behavior=zoom().scaleExtent([.5,25]).filter(e=>!e.shiftKey&&(!e.button||e.type==='wheel')).on('zoom',e=>{transform=e.transform;cancelAnimationFrame(frame);frame=requestAnimationFrame(render);});
  select(canvas).call(behavior);
  const events=new AbortController();
  canvas.addEventListener('click',e=>{if(e.shiftKey)return;const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;let best=-1,distance=100;coords.forEach((p,i)=>{const dx=transform.applyX(x(p[0]))-mx,dy=transform.applyY(y(p[1]))-my,dist=dx*dx+dy*dy;if(dist<distance){distance=dist;best=i;}});if(best>=0)onSelect(best);},{signal:events.signal});
  canvas.addEventListener('pointerdown',e=>{if(!e.shiftKey)return;const r=canvas.getBoundingClientRect();brush=[e.clientX-r.left,e.clientY-r.top,e.clientX-r.left,e.clientY-r.top];canvas.setPointerCapture(e.pointerId);},{signal:events.signal});
  canvas.addEventListener('pointermove',e=>{if(!brush)return;const r=canvas.getBoundingClientRect();brush[2]=e.clientX-r.left;brush[3]=e.clientY-r.top;render();},{signal:events.signal});
  canvas.addEventListener('pointerup',()=>{if(!brush)return;const[a,b,c,d]=brush,ids=[];coords.forEach((p,i)=>{const xx=transform.applyX(x(p[0])),yy=transform.applyY(y(p[1]));if(xx>=Math.min(a,c)&&xx<=Math.max(a,c)&&yy>=Math.min(b,d)&&yy<=Math.max(b,d))ids.push(i);});brush=null;onBrush(ids);render();},{signal:events.signal});
  const observer=new ResizeObserver(render);observer.observe(canvas);render();
  return{reset:()=>select(canvas).call(behavior.transform,zoomIdentity),destroy:()=>{observer.disconnect();events.abort();select(canvas).on('.zoom',null);cancelAnimationFrame(frame);}};
}
