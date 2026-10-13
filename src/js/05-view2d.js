

/* ---------------- 2D view ---------------- */
const sag=$('sag'),sctx=sag.getContext('2d'); const imgCv=document.createElement('canvas'),ictx=imgCv.getContext('2d');
const CK=Math.max(1,Math.min(window.__CK||window.devicePixelRatio||1,4)); const cssW=()=>sag.width/CK,cssH=()=>sag.height/CK;
let dirtyImg=true,pending=false;
function requestDraw(){ if(pending)return; pending=true; requestAnimationFrame(()=>{ pending=false; draw2D(); }); }
function renderImage(){
  const v=S.vol; const W=imgCv.width,H=imgCv.height; if(!W||!H) return;
  const id=ictx.createImageData(W,H),d=id.data,B=basis(),c=B.c,{uc,vc}=S.view,s=S.view.s*CK;
  const lo=S.win.l-S.win.w/2,k=255/S.win.w,slab=S.slab,nS=slab>0?Math.max(2,Math.round(slab/0.5)+1):1;
  for(let py=0;py<H;py++){ const vv=vc-(py-H/2)/s;
    for(let px=0;px<W;px++){ const uu=uc+(px-W/2)/s;
      const bx=c[0]+uu*B.u[0]+vv*B.v[0],by=c[1]+uu*B.u[1]+vv*B.v[1],bz=c[2]+uu*B.u[2]+vv*B.v[2];
      let acc=0; if(nS===1) acc=sampleVol(v,bx,by,bz); else { for(let m=0;m<nS;m++){ const o=-slab/2+slab*m/(nS-1); acc+=sampleVol(v,bx+o*B.n[0],by+o*B.n[1],bz+o*B.n[2]); } acc/=nS; }
      let g=(acc-lo)*k; g=g<0?0:g>255?255:g; const q=(py*W+px)*4; d[q]=d[q+1]=d[q+2]=g; const fx=(bx-v.ox)/v.sx,fy=(by-v.oy)/v.sy,fz=(bz-v.oz)/v.sz; d[q+3]=(fx<0||fy<0||fz<0||fx>v.nx-1||fy>v.ny-1||fz>v.nz-1||acc<-400)?0:255; } }
  ictx.putImageData(id,0,0); updatePlane3D();
}
const uvToPx=(u,v)=>[cssW()/2+(u-S.view.uc)*S.view.s,cssH()/2-(v-S.view.vc)*S.view.s];
const pxToUV=(x,y)=>[S.view.uc+(x-cssW()/2)/S.view.s,S.view.vc-(y-cssH()/2)/S.view.s];
function ptPx(P,B){ const uv=toUV(P,B); return uvToPx(uv[0],uv[1]); }
let hatchP=null;
function hatchPattern(){ if(hatchP) return hatchP; const c=document.createElement('canvas'); c.width=c.height=8; const x=c.getContext('2d'); x.fillStyle='rgba(255,255,255,.5)'; x.fillRect(0,0,8,8); x.strokeStyle='#000'; x.lineWidth=1.3; x.beginPath(); x.moveTo(-1,9); x.lineTo(9,-1); x.moveTo(-1,1); x.lineTo(1,-1); x.moveTo(7,9); x.lineTo(9,7); x.stroke(); hatchP=sctx.createPattern(c,'repeat'); return hatchP; }
function marker(ctx,k,q,r){ ctx.beginPath(); if(k==='K'){ ctx.rect(q[0]-r,q[1]-r,2*r,2*r); } else if(k==='ASA'){ ctx.moveTo(q[0],q[1]-r*1.2); ctx.lineTo(q[0]+r*1.1,q[1]+r*0.9); ctx.lineTo(q[0]-r*1.1,q[1]+r*0.9); ctx.closePath(); } else ctx.arc(q[0],q[1],r,0,7); }
function draw2D(){
  const W=cssW(),H=cssH(); if(!W||!H) return;
  sctx.setTransform(1,0,0,1,0,0); sctx.clearRect(0,0,sag.width,sag.height); sctx.setTransform(CK,0,0,CK,0,0);
  const schem=S.tab==='teach'||!S.vol;
  $('paneTitle').textContent=schem?'Schematic (sagittal)':'Midsagittal reformat';
  $('paneHint').textContent=schem?(S.vol?'':'Load a scan in the Patient tab'):'Anterior left · scroll to zoom';
  if(schem){ drawSchematic(); return; }
  if(dirtyImg){ renderImage(); dirtyImg=false; }
  sctx.drawImage(imgCv,0,0,W,H);
  const B=basis(),ctx=sctx;
  const lcol={K:'#ff6b6b',ASA:'#ffd166',ANS:'#6bc5ff'};
  /* harvestable region + strut lines */
  if(S.an&&S.snap&&S.an.poly.length>=3){
    ctx.beginPath(); S.an.poly.forEach((p,i)=>{ const q=ptPx(fromUV(p[0],p[1],S.snap),B); i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); ctx.closePath();
    if(S.bw){ ctx.fillStyle=hatchPattern(); ctx.fill(); ctx.lineJoin='round'; ctx.strokeStyle='#fff'; ctx.lineWidth=3.6; ctx.stroke(); ctx.strokeStyle='#000'; ctx.lineWidth=1.4; ctx.stroke(); }
    else { ctx.fillStyle='rgba(47,158,107,.38)'; ctx.fill(); ctx.strokeStyle='#2f9e6b'; ctx.lineWidth=1.5; ctx.stroke(); }
  }
  if(S.tab==='plan'&&S.sel&&S.snap){
    ctx.font='700 11px "Public Sans",system-ui,sans-serif';
    S.sel.placed.forEach(pl=>{ const c=Math.cos(pl.th*D2R),s_=Math.sin(pl.th*D2R); const cor=[[-pl.L/2,-pl.W/2],[pl.L/2,-pl.W/2],[pl.L/2,pl.W/2],[-pl.L/2,pl.W/2]].map(q=>ptPx(fromUV(pl.cx+q[0]*c-q[1]*s_,pl.cy+q[0]*s_+q[1]*c,S.snap),B));
      ctx.beginPath(); cor.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath(); ctx.fillStyle='rgba(255,255,255,.62)'; ctx.fill(); ctx.lineJoin='round'; ctx.strokeStyle='#fff'; ctx.lineWidth=3.4; ctx.stroke(); ctx.strokeStyle='#000'; ctx.lineWidth=1.4; ctx.stroke();
      const q0=ptPx(fromUV(pl.cx,pl.cy,S.snap),B); ctx.textAlign='center'; ctx.lineWidth=3; ctx.strokeStyle='#fff'; ctx.strokeText(pl.label,q0[0],q0[1]+4); ctx.fillStyle='#000'; ctx.fillText(pl.label,q0[0],q0[1]+4); ctx.textAlign='left'; });
  }
  if(S.an&&S.snap){ const A=S.an;
    [[A.K,A.ASA,A.nD],[A.ASA,A.ANS,A.nC]].forEach(([a,b,n])=>{ const p1=ptPx(fromUV(a[0]+n[0]*A.w,a[1]+n[1]*A.w,S.snap),B),p2=ptPx(fromUV(b[0]+n[0]*A.w,b[1]+n[1]*A.w,S.snap),B);
      if(S.bw){ ctx.setLineDash([]); ctx.strokeStyle='#fff'; ctx.lineWidth=3.6; ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke(); }
      ctx.setLineDash([6,4]); ctx.strokeStyle=S.bw?'#000':'#ff7a4d'; ctx.lineWidth=S.bw?1.5:1.3; ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.stroke(); });
    ctx.setLineDash([]); }
  /* outline */
  if(S.pts.length){
    ctx.beginPath(); S.pts.forEach((P,i)=>{ const q=ptPx(P,B); i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); }); if(S.closed)ctx.closePath();
    if(S.bw){ ctx.lineJoin='round'; ctx.strokeStyle='#fff'; ctx.lineWidth=4; ctx.stroke(); ctx.strokeStyle='#000'; ctx.lineWidth=1.6; ctx.stroke(); } else { ctx.strokeStyle='#e0a030'; ctx.lineWidth=1.8; ctx.stroke(); }
    S.pts.forEach((P,i)=>{ const q=ptPx(P,B),far=Math.abs(offPlane(P,B))>1.5; ctx.globalAlpha=far?.4:1; ctx.beginPath(); ctx.arc(q[0],q[1],i===0?5:3.5,0,7); ctx.fillStyle=(i===0||S.bw)?'#fff':'#e0a030'; ctx.fill(); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke(); ctx.globalAlpha=1; });
  }
  /* landmarks */
  ctx.font='600 12px "Public Sans",system-ui,sans-serif';
  Object.keys(S.lm).forEach(k=>{ const P=S.lm[k]; if(!P)return; const q=ptPx(P,B);
    if(S.bw){ marker(ctx,k,q,6); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#000'; ctx.lineWidth=1.6; ctx.stroke(); ctx.lineWidth=3; ctx.strokeStyle='#000'; ctx.strokeText(k,q[0]+9,q[1]-7); ctx.fillStyle='#fff'; ctx.fillText(k,q[0]+9,q[1]-7); }
    else { ctx.beginPath(); ctx.arc(q[0],q[1],5,0,7); ctx.fillStyle=lcol[k]; ctx.fill(); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle=lcol[k]; ctx.fillText(k,q[0]+8,q[1]-6); } });
  /* ruler */
  if(S.ruler.length){ const p=S.ruler.map(P=>ptPx(P,B)); ctx.strokeStyle='#fff'; ctx.lineWidth=1.3; ctx.beginPath(); p.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.stroke();
    p.forEach(q=>{ctx.beginPath();ctx.arc(q[0],q[1],3,0,7);ctx.fillStyle='#fff';ctx.fill();});
    if(S.ruler.length===2){ const d=Math.hypot(S.ruler[0][0]-S.ruler[1][0],S.ruler[0][1]-S.ruler[1][1],S.ruler[0][2]-S.ruler[1][2]); ctx.fillStyle='#fff'; ctx.fillText(f1(d)+' mm',(p[0][0]+p[1][0])/2+6,(p[0][1]+p[1][1])/2-6); } }
  /* annotations */
  { ctx.font='600 12px "Public Sans",system-ui,sans-serif'; const lab=(t,x,y)=>{ ctx.lineWidth=3; ctx.strokeStyle='#000'; ctx.strokeText(t,x,y); ctx.fillStyle='#fff'; ctx.fillText(t,x,y); };
    S.annos.forEach(a=>{ const q=a.pts.map(P=>ptPx(P,B)); ctx.strokeStyle='#fff'; ctx.lineWidth=1.4;
      if(a.type==='angle'){ ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]); ctx.lineTo(q[1][0],q[1][1]); ctx.lineTo(q[2][0],q[2][1]); ctx.stroke(); lab(a.txt,q[1][0]+8,q[1][1]-8); }
      else if(a.type==='hu'){ ctx.beginPath(); ctx.arc(q[0][0],q[0][1],a.rad*S.view.s,0,7); ctx.stroke(); lab(a.txt,q[0][0]+a.rad*S.view.s+4,q[0][1]+4); }
      else { ctx.beginPath(); ctx.arc(q[0][0],q[0][1],3.5,0,7); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#000'; ctx.stroke(); lab(a.txt,q[0][0]+8,q[0][1]-6); } });
    S.pending.forEach(P=>{ const q=ptPx(P,B); ctx.beginPath(); ctx.arc(q[0],q[1],3,0,7); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke(); }); }
  /* scale bar + orientation */
  const bar=10*S.view.s; ctx.fillStyle='#fff'; ctx.fillRect(14,H-22,bar,3); ctx.fillText('10 mm',14,H-28);
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.fillText('A',8,H/2); ctx.fillText('P',W-16,H/2); ctx.fillText('S',W/2,16); ctx.fillText('I',W/2,H-6);
}
function callout(ctx,text,tx,ty,lx,ly,align){
  ctx.strokeStyle='rgba(219,230,236,.6)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(tx,ty); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx,ty,2.5,0,7); ctx.fillStyle='#dbe6ec'; ctx.fill();
  const w=ctx.measureText(text).width, x=align==='left'?lx+4:lx-4-w; ctx.fillStyle='rgba(13,19,23,.82)'; ctx.fillRect(x-3,ly-9,w+6,18);
  ctx.fillStyle='#dbe6ec'; ctx.fillText(text,x,ly+4);
}
function drawSchematic(){
  const W=cssW(),H=cssH(),ctx=sctx; ctx.fillStyle='#0d1317'; ctx.fillRect(0,0,W,H);
  const sc=Math.min(W*0.74/98,H*0.7/60); const cx=27.6,cy=26; const P=p=>[W/2+(p[0]-cx)*sc,H/2-(p[1]-cy)*sc];
  const path=poly=>{ ctx.beginPath(); poly.forEach((p,i)=>{const q=P(p); i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);}); ctx.closePath(); };
  ctx.font='600 12.5px "Public Sans",system-ui,sans-serif';
  if(S.ly.bone){ path(SCH.ppe); ctx.fillStyle='#d9d2bd'; ctx.fill(); path(SCH.vomer); ctx.fillStyle='#bfb8a5'; ctx.fill(); }
  if(S.ly.cart){ path(SCH.cart); ctx.fillStyle='#7cc3dc'; ctx.fill(); }
  const a=schAnalysis();
  if(S.ly.harv&&a.poly.length>=3){ path(a.poly); ctx.fillStyle='#2f9e6b'; ctx.fill(); }
  if(S.ly.strut){ ctx.setLineDash([6,4]); ctx.strokeStyle='#ff7a4d'; ctx.lineWidth=1.6;
    [[SCH.K,SCH.ASA,a.nD],[SCH.ASA,SCH.ANS,a.nC]].forEach(([p,q,n])=>{ const A=P([p[0]+n[0]*S.strutW,p[1]+n[1]*S.strutW]),Bq=P([q[0]+n[0]*S.strutW,q[1]+n[1]*S.strutW]); ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(Bq[0],Bq[1]); ctx.stroke(); }); ctx.setLineDash([]); }
  path(SCH.cart); ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=1; ctx.stroke();
  [['K',SCH.K,'#ff6b6b'],['ASA',SCH.ASA,'#ffd166'],['ANS',SCH.ANS,'#6bc5ff']].forEach(([n,p,c])=>{ const q=P(p); ctx.beginPath(); ctx.arc(q[0],q[1],4.5,0,7); ctx.fillStyle=c; ctx.fill(); });
  /* callouts at the margins */
  const fs=W<520?11:12.5; ctx.font='600 '+fs+'px "Public Sans",system-ui,sans-serif';
  const lx=W*0.03,rx=W*0.97;
  callout(ctx,'K, start of dorsal strut',P(SCH.K)[0],P(SCH.K)[1],lx,H*0.22,'left');
  callout(ctx,'ASA, anterior septal angle',P(SCH.ASA)[0],P(SCH.ASA)[1],lx,H*0.40,'left');
  const cc=polyCentroid(SCH.cart); callout(ctx,'Quadrilateral cartilage',P(cc)[0],P(cc)[1],lx,H*0.66,'left');
  callout(ctx,'ANS, anterior nasal spine',P(SCH.ANS)[0],P(SCH.ANS)[1],lx,H*0.80,'left');
  const pc=polyCentroid(SCH.ppe); callout(ctx,'Perpendicular plate',P(pc)[0],P(pc)[1],rx,H*0.22,'right');
  const vc=polyCentroid(SCH.vomer); callout(ctx,'Vomer',P(vc)[0],P(vc)[1],rx,H*0.78,'right');
  ctx.fillStyle='rgba(255,255,255,.55)'; ctx.fillText('Anterior',lx,H-10); ctx.textAlign='right'; ctx.fillText('Posterior',rx,H-10); ctx.textAlign='left';
  ctx.fillText('Schematic, not to scale',lx,18);
}
function drawMini(cv,mode){
  const v=S.vol,ctx=cv.getContext('2d'); if(!v){ctx.fillStyle='#0d1317';ctx.fillRect(0,0,cv.width,cv.height);return;}
  const B=basis(); const ex=v.nx*v.sx,ey=v.ny*v.sy,ez=v.nz*v.sz;
  const BW=Math.round(360*CK); if(cv.width!==BW) cv.width=BW; const W=cv.width; let wm,hm; if(mode==='ax'){wm=ex;hm=ey;} else {wm=ex;hm=ez;}
  const H=Math.min(300*CK,Math.round(W*hm/wm)); if(cv.height!==H) cv.height=H;
  const scl=W/wm; const id=ctx.createImageData(W,H),d=id.data; const lo=S.win.l-S.win.w/2,kk=255/S.win.w;
  const z0=B.c[2]+S.view.vc*B.v[2], y0=B.c[1]+S.view.uc*B.u[1];
  const k0=Math.max(0,Math.min(v.nz-1,Math.round((z0-v.oz)/v.sz))), j0=Math.max(0,Math.min(v.ny-1,Math.round((y0-v.oy)/v.sy)));
  for(let py=0;py<H;py++)for(let px=0;px<W;px++){
    const i=Math.min(v.nx-1,Math.floor(px/scl/v.sx));
    let j,k; if(mode==='ax'){ j=Math.min(v.ny-1,Math.floor(py/scl/v.sy)); k=k0; } else { k=Math.min(v.nz-1,Math.floor((H-1-py)/scl/v.sz)); j=j0; }
    let g=(v.data[i+v.nx*(j+v.ny*k)]-lo)*kk; g=g<0?0:g>255?255:g; const q=(py*W+px)*4; d[q]=d[q+1]=d[q+2]=g; d[q+3]=255; }
  ctx.putImageData(id,0,0);
  /* plane line: n.(P-c)=0 */
  const n=B.n,c=B.c; ctx.strokeStyle='#e0a030'; ctx.lineWidth=1.5*CK; ctx.beginPath();
  if(mode==='ax'){ const y1=v.oy,y2=v.oy+ey; const xa=y=>c[0]-(n[1]*(y-c[1])+n[2]*(z0-c[2]))/n[0]; ctx.moveTo((xa(y1)-v.ox)*scl,(y1-v.oy)*scl); ctx.lineTo((xa(y2)-v.ox)*scl,(y2-v.oy)*scl); }
  else { const z1=v.oz,z2=v.oz+ez; const xa=z=>c[0]-(n[2]*(z-c[2])+n[1]*(y0-c[1]))/n[0]; ctx.moveTo((xa(z1)-v.ox)*scl,H-(z1-v.oz)*scl); ctx.lineTo((xa(z2)-v.ox)*scl,H-(z2-v.oz)*scl); }
  ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.font=(11*CK)+'px system-ui'; ctx.fillText(mode==='ax'?'Axial · L right':'Coronal · L right',6*CK,14*CK);
}
function miniClick(e,mode){
  const v=S.vol; if(!v)return; const cv=e.currentTarget,r=cv.getBoundingClientRect(),px=(e.clientX-r.left)*cv.width/r.width,py=(e.clientY-r.top)*cv.height/r.height;
  const scl=cv.width/(v.nx*v.sx),B=basis(),n=B.n,c=B.c,z0=c[2]+S.view.vc*B.v[2],y0=c[1]+S.view.uc*B.u[1];
  const x=v.ox+px/scl; let P;
  if(mode==='ax'){ const y=v.oy+py/scl; S.plane.x0=x+(n[1]*(y-c[1])+n[2]*(z0-c[2]))/n[0]; }
  else { const z=v.oz+(cv.height-py)/scl; S.plane.x0=x+(n[2]*(z-c[2])+n[1]*(y0-c[1]))/n[0]; }
  $('pShift').value=Math.max(-30,Math.min(30,S.plane.x0-S.plane.x0auto)); syncPlaneOut(); dirtyImg=true; requestDraw(); drawMinis(); updateOverlays3D();
}
function drawMinis(){ drawMini($('ax'),'ax'); drawMini($('co'),'co'); }

/* ---------------- pointer interaction on the reformat ---------------- */
let drag=null;
function evPx(e){ const r=sag.getBoundingClientRect(); return [(e.clientX-r.left)*cssW()/r.width,(e.clientY-r.top)*cssH()/r.height]; }
function worldAt(px,py){ const B=basis(),uv=pxToUV(px,py); return fromUV(uv[0],uv[1],B); }
function ensureSnap(){ if(!S.snap) S.snap=basis(); }
function nearPt(list,px,py,B,r){ let best=-1,bd=r; list.forEach((P,i)=>{ if(!P)return; const q=ptPx(P,B),d=Math.hypot(q[0]-px,q[1]-py); if(d<bd){bd=d;best=i;} }); return best; }
sag.addEventListener('pointerdown',e=>{
  if(!S.vol||S.tab==='teach')return; sag.setPointerCapture(e.pointerId); const [px,py]=evPx(e),B=basis();
  if(e.button===1||e.button===2||S.tool==='pan'){ drag={type:'pan',x:px,y:py,uc:S.view.uc,vc:S.view.vc}; return; }
  if(S.tool==='trace'){
    const hit=nearPt(S.pts,px,py,B,9);
    if(hit===0&&!S.closed&&S.pts.length>=3){ S.closed=true; update(); return; }
    if(hit>=0){ drag={type:'pt',i:hit}; return; }
    if(S.closed) return; ensureSnap(); S.pts.push(worldAt(px,py)); update(); return;
  }
  if(S.tool==='lm'){
    const keys=['K','ASA','ANS']; const hit=nearPt(keys.map(k=>S.lm[k]),px,py,B,10);
    if(hit>=0){ drag={type:'lm',k:keys[hit]}; return; }
    ensureSnap(); S.lm[S.lmSel]=worldAt(px,py); const nx=keys[(keys.indexOf(S.lmSel)+1)%3]; if(!S.lm[nx]) setLm(nx); update(); return;
  }
  if(S.tool==='ruler'){ if(S.ruler.length>=2) S.ruler=[]; S.ruler.push(worldAt(px,py)); update(); return; }
  if(S.tool==='angle'){ S.pending.push(worldAt(px,py)); if(S.pending.length===3){ const [a,b,c]=S.pending,v1=[a[0]-b[0],a[1]-b[1],a[2]-b[2]],v2=[c[0]-b[0],c[1]-b[1],c[2]-b[2]]; const ang=Math.acos(Math.max(-1,Math.min(1,dot(v1,v2)/(Math.hypot(...v1)*Math.hypot(...v2)||1))))/D2R; S.annos.push({type:'angle',pts:[a,b,c],txt:f1(ang)+'°'}); S.pending=[]; } update(true); return; }
  if(S.tool==='hu'){ const P=worldAt(px,py),r=roiHU(P,2); S.annos.push({type:'hu',pts:[P],rad:2,txt:`${f0(r.mean)} ± ${f0(r.sd)} HU`}); update(true); return; }
  if(S.tool==='thick'){ const P=worldAt(px,py),r=thickAt(P); S.annos.push({type:'thick',pts:[P],txt:r?`${f1(r.len)} mm, peak ${f0(r.mx)} HU`:'no septum here'}); update(true); return; }
});
sag.addEventListener('pointermove',e=>{
  if(!drag)return; const [px,py]=evPx(e);
  if(drag.type==='pan'){ S.view.uc=drag.uc-(px-drag.x)/S.view.s; S.view.vc=drag.vc+(py-drag.y)/S.view.s; dirtyImg=true; requestDraw(); return; }
  const P=worldAt(px,py); if(drag.type==='pt') S.pts[drag.i]=P; if(drag.type==='lm') S.lm[drag.k]=P; update(true);
});
sag.addEventListener('pointerup',()=>{ if(drag&&drag.type==='pan'){drawMinis();updatePlane3D();} if(drag&&(drag.type==='pt'||drag.type==='lm')) schedulePlan(); drag=null; });
sag.addEventListener('contextmenu',e=>e.preventDefault());
sag.addEventListener('wheel',e=>{
  if(!S.vol||S.tab==='teach')return; e.preventDefault(); const [px,py]=evPx(e); const b=pxToUV(px,py);
  S.view.s=Math.max(1.5,Math.min(40,S.view.s*(e.deltaY<0?1.15:1/1.15))); const a=pxToUV(px,py); S.view.uc+=b[0]-a[0]; S.view.vc+=b[1]-a[1]; dirtyImg=true; requestDraw();
},{passive:false});
function update(light){ computeAnalysis(); updateOverlays3D(); updateResults(); renderSepRes(); requestDraw(); if(!light) schedulePlan(); }