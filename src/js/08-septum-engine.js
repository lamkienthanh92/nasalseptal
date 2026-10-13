

/* ================= septum engine ================= */
const AIRHU=-450, SOFTMAX=230;
const smBox={};
function columnSeptum(P0,n,prof,nT,t0,dt,gate){
  const v=S.vol;
  for(let k=0;k<nT;k++){ const t=t0+k*dt; prof[k]=sampleVol(v,P0[0]+t*n[0],P0[1]+t*n[1],P0[2]+t*n[2]); }
  const need=Math.round(1.5/dt); let best=null,k=0;
  while(k<nT){
    if(prof[k]<AIRHU){k++;continue;}
    const s0=k; while(k<nT&&prof[k]>=AIRHU)k++; const e0=k-1, len=(e0-s0+1)*dt;
    if(s0>=need&&e0<=nT-1-need&&len>=0.8&&len<=9){
      let ok=true; for(let q=1;q<=need;q++){ if(prof[s0-q]>=AIRHU||prof[e0+q]>=AIRHU){ok=false;break;} }
      if(ok){ const ct=t0+((s0+e0)/2)*dt; if(Math.abs(ct)<=(gate||99)&&(!best||Math.abs(ct)<Math.abs(best.ct))){ let mx=-1e9,sm=0; for(let q=s0;q<=e0;q++){ if(prof[q]>mx)mx=prof[q]; sm+=prof[q]; } best={ct,len,mx,mean:sm/(e0-s0+1)}; } }
    }
  }
  return best;
}
function computeSeptum(gate){
  gate=gate||S.gate||5; const v=S.vol; if(!v) return null; const B=basis(),n=B.n,px=0.5,half=22,dt=0.25,nT=Math.round(2*half/dt)+1;
  const nu=Math.round(110/px),nv=Math.round(90/px),U0=S.view.uc-55,V0=S.view.vc-45;
  const N=nu*nv, off=new Float32Array(N).fill(NaN), th=new Float32Array(N).fill(NaN), mx=new Float32Array(N).fill(NaN), mean=new Float32Array(N).fill(NaN), soft=new Uint8Array(N), prof=new Float32Array(nT);
  for(let iv=0;iv<nv;iv++)for(let iu=0;iu<nu;iu++){
    const P0=fromUV(U0+iu*px,V0+iv*px,B);
    const r=columnSeptum(P0,n,prof,nT,-half,dt,gate);
    if(r){ const i=iu+nu*iv; off[i]=r.ct; th[i]=r.len; mx[i]=r.mx; mean[i]=r.mean; soft[i]=r.mx<SOFTMAX?1:0; }
  }
  const sm={U0,V0,px,nu,nv,off,th,mx,mean,soft,B,gate,stale:false};
  let nValid=0,nSoft=0,sumTh=0,sumSq=0,big=0; const absd=[];
  for(let i=0;i<N;i++){ if(isNaN(off[i]))continue; nValid++; if(soft[i]){ nSoft++; sumTh+=th[i]; sumSq+=off[i]*off[i]; absd.push(Math.abs(off[i])); if(Math.abs(off[i])>3) big++; } }
  absd.sort((a,b)=>a-b);
  sm.stats={nValid,nSoft,areaValid:nValid*px*px,areaSoft:nSoft*px*px,meanTh:nSoft?sumTh/nSoft:NaN,rms:nSoft?Math.sqrt(sumSq/nSoft):NaN,p95:absd.length?absd[Math.floor(absd.length*0.95)]:NaN,areaBig:big*px*px};
  S.sm=sm; return sm;
}
function robustFit(m,softOnly){
  const pts=[]; for(let iv=0;iv<m.nv;iv++)for(let iu=0;iu<m.nu;iu++){ const i=iu+m.nu*iv; if(isNaN(m.off[i])||(softOnly&&!m.soft[i]))continue; pts.push([m.U0+iu*m.px,m.V0+iv*m.px,m.off[i]]); }
  if(pts.length<150) return null;
  let w=new Float32Array(pts.length).fill(1),co=[0,0,0];
  for(let it=0;it<6;it++){
    let a=[[0,0,0],[0,0,0],[0,0,0]],r=[0,0,0];
    pts.forEach((p,k)=>{ const x=[1,p[0],p[1]]; for(let i=0;i<3;i++){ r[i]+=w[k]*x[i]*p[2]; for(let j=0;j<3;j++) a[i][j]+=w[k]*x[i]*x[j]; } });
    const d=a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]); if(Math.abs(d)<1e-9) return null;
    const inv=(M,k)=>{ const t=M.map(row=>row.slice()); for(let i=0;i<3;i++) t[i][k]=r[i]; return t; };
    const det=m3=>m3[0][0]*(m3[1][1]*m3[2][2]-m3[1][2]*m3[2][1])-m3[0][1]*(m3[1][0]*m3[2][2]-m3[1][2]*m3[2][0])+m3[0][2]*(m3[1][0]*m3[2][1]-m3[1][1]*m3[2][0]);
    co=[det(inv(a,0))/d,det(inv(a,1))/d,det(inv(a,2))/d];
    pts.forEach((p,k)=>{ const res=p[2]-(co[0]+co[1]*p[0]+co[2]*p[1]); w[k]=1/(1+(res/0.8)*(res/0.8)); });
  }
  let sq=0; pts.forEach(p=>{ const res=p[2]-(co[0]+co[1]*p[0]+co[2]*p[1]); sq+=res*res; });
  return {a:co[0],b:co[1],c:co[2],n:pts.length,rms:Math.sqrt(sq/pts.length)};
}
function setPlaneParams(x0,yaw,roll){
  S.plane.x0=x0; S.plane.yaw=yaw; S.plane.roll=roll;
  const sh=$('pShift'),yw=$('pYaw'),rl=$('pRoll'); const d=x0-S.plane.x0auto;
  if(d<+sh.min) sh.min=Math.floor(d-5); if(d>+sh.max) sh.max=Math.ceil(d+5); sh.value=d;
  if(yaw<+yw.min) yw.min=Math.floor(yaw-2); if(yaw>+yw.max) yw.max=Math.ceil(yaw+2); yw.value=yaw;
  if(roll<+rl.min) rl.min=Math.floor(roll-2); if(roll>+rl.max) rl.max=Math.ceil(roll+2); rl.value=roll;
  syncPlaneOut(); dirtyImg=true;
}
async function alignPlane(){
  if(!S.vol){ toast('Load a scan first.'); return; }
  busy('Aligning plane to the septum…'); await tick();
  let fit=null,total=0;
  for(let it=0;it<3;it++){
    const m=computeSeptum([12,6,4][it]); fit=robustFit(m,true)||robustFit(m,false);
    if(!fit){ busy(); toast('Could not find enough septum on this plane. Move the view over the nose and try again.'); return; }
    const B=basis(),n=B.n,u=B.u,v=B.v,c=B.c;
    let np=[n[0]-fit.b*u[0]-fit.c*v[0],n[1]-fit.b*u[1]-fit.c*v[1],n[2]-fit.b*u[2]-fit.c*v[2]]; const L=Math.hypot(...np); np=np.map(x=>x/L);
    const Q=[c[0]+fit.a*n[0],c[1]+fit.a*n[1],c[2]+fit.a*n[2]];
    const yaw=Math.atan2(np[1],np[0])/D2R, roll=Math.asin(-np[2])/D2R;
    const x0=Q[0]-(np[1]*(c[1]-Q[1])+np[2]*(c[2]-Q[2]))/np[0];
    total+=Math.abs(fit.a)+Math.abs(fit.b)+Math.abs(fit.c);
    setPlaneParams(x0,yaw,roll); await tick();
    if(Math.abs(fit.a)<0.15&&Math.abs(fit.b)<0.004&&Math.abs(fit.c)<0.004) break;
  }
  S.gate=5; computeSeptum(5);
  S.pts=[];S.closed=false;S.lm={K:null,ASA:null,ANS:null};S.snap=null;S.annos=[];S.pending=[];
  busy(); dirtyImg=true; drawMinis(); update(); updatePlane3D(); rebuildSeptMesh(); renderSepRes();
  toast('Plane aligned to the septum.');
}
/* morphology on the small septum grid */
function boxCount(A,nu,nv,r){
  const tmp=new Int32Array(nu*nv),out=new Int32Array(nu*nv);
  for(let j=0;j<nv;j++){ const row=j*nu,pre=new Int32Array(nu+1); for(let i=0;i<nu;i++)pre[i+1]=pre[i]+A[row+i]; for(let i=0;i<nu;i++){ const a=Math.max(0,i-r),b=Math.min(nu-1,i+r); tmp[row+i]=pre[b+1]-pre[a]; } }
  for(let i=0;i<nu;i++){ const pre=new Int32Array(nv+1); for(let j=0;j<nv;j++)pre[j+1]=pre[j]+tmp[j*nu+i]; for(let j=0;j<nv;j++){ const a=Math.max(0,j-r),b=Math.min(nv-1,j+r); out[j*nu+i]=pre[b+1]-pre[a]; } }
  return out;
}
const erode=(M,nu,nv,r)=>{ const c=boxCount(M,nu,nv,r),f=(2*r+1)*(2*r+1),o=new Uint8Array(nu*nv); for(let i=0;i<o.length;i++)o[i]=c[i]===f?1:0; return o; };
const dilate=(M,nu,nv,r)=>{ const c=boxCount(M,nu,nv,r),o=new Uint8Array(nu*nv); for(let i=0;i<o.length;i++)o[i]=c[i]>0?1:0; return o; };
function largestComp(M,nu,nv){
  const lab=new Int32Array(nu*nv),q=new Int32Array(nu*nv); let best=0,bestN=0,id=0;
  for(let s0=0;s0<M.length;s0++){ if(!M[s0]||lab[s0])continue; id++; let h=0,t=0; q[t++]=s0; lab[s0]=id; while(h<t){ const c=q[h++],x=c%nu,y=(c/nu)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=nu||yy>=nv)continue; const k=xx+nu*yy; if(M[k]&&!lab[k]){lab[k]=id;q[t++]=k;} } } if(t>bestN){bestN=t;best=id;} }
  const o=new Uint8Array(nu*nv); for(let i=0;i<o.length;i++)o[i]=lab[i]===best?1:0; return o;
}
function fillHoles(M,nu,nv){
  const seen=new Uint8Array(nu*nv),q=new Int32Array(nu*nv); let h=0,t=0;
  const push=k=>{ if(!M[k]&&!seen[k]){seen[k]=1;q[t++]=k;} };
  for(let i=0;i<nu;i++){push(i);push(i+nu*(nv-1));} for(let j=0;j<nv;j++){push(nu*j);push(nu-1+nu*j);}
  while(h<t){ const c=q[h++],x=c%nu,y=(c/nu)|0; if(x>0)push(c-1); if(x<nu-1)push(c+1); if(y>0)push(c-nu); if(y<nv-1)push(c+nu); }
  const o=new Uint8Array(nu*nv); for(let i=0;i<o.length;i++)o[i]=(M[i]||!seen[i])?1:0; return o;
}
function dpOpen(p,tol){ if(p.length<3)return p; const a=p[0],b=p[p.length-1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1; let md=-1,mi=-1; for(let i=1;i<p.length-1;i++){ const d=Math.abs((p[i][0]-a[0])*dy-(p[i][1]-a[1])*dx)/L; if(d>md){md=d;mi=i;} } if(md>tol){ const l=dpOpen(p.slice(0,mi+1),tol),r=dpOpen(p.slice(mi),tol); return l.slice(0,-1).concat(r); } return [a,b]; }
function dpClosed(p,tol){ const n=p.length; if(n<4)return p; let k=0,md=0; for(let i=1;i<n;i++){ const d=Math.hypot(p[i][0]-p[0][0],p[i][1]-p[0][1]); if(d>md){md=d;k=i;} } const a=dpOpen(p.slice(0,k+1),tol),b=dpOpen(p.slice(k).concat([p[0]]),tol); return a.slice(0,-1).concat(b.slice(0,-1)); }
function traceBoundary(M,nu,nv){
  let sx=-1,sy=-1; for(let j=0;j<nv&&sx<0;j++)for(let i=0;i<nu;i++) if(M[i+nu*j]){sx=i;sy=j;break;} if(sx<0) return [];
  const D=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]; const inside=(x,y)=>x>=0&&y>=0&&x<nu&&y<nv&&M[x+nu*y]===1;
  const pts=[]; let x=sx,y=sy,dir=4,guard=0,second=null;
  while(guard++<20*(nu+nv)*4){
    pts.push([x,y]); let moved=false;
    for(let k=1;k<=8;k++){ const d=(dir+k)%8,nx=x+D[d][0],ny=y+D[d][1];
      if(inside(nx,ny)){ const pd=(dir+k-1)%8,px_=x+D[pd][0],py_=y+D[pd][1]; const ndx=px_-nx,ndy=py_-ny; let nd=0; for(let q=0;q<8;q++) if(D[q][0]===ndx&&D[q][1]===ndy){nd=q;break;} x=nx;y=ny;dir=nd;moved=true;break; } }
    if(!moved) break;
    if(pts.length>2&&x===sx&&y===sy) break;
  }
  return pts;
}
function suggestOutline(){
  if(!S.vol){ toast('Load a scan first.'); return false; }
  const m=(S.sm&&!S.sm.stale)?S.sm:computeSeptum(5); const {nu,nv,px,U0,V0}=m;
  let M=new Uint8Array(nu*nv); for(let i=0;i<M.length;i++) M[i]=(!isNaN(m.off[i])&&m.soft[i]&&m.th[i]>=1&&m.th[i]<=7)?1:0;
  const r=Math.round(2/px); M=dilate(erode(M,nu,nv,r),nu,nv,r); M=largestComp(M,nu,nv);
  if(M.reduce((a,b)=>a+b,0)<150){ toast('No soft septal sheet found here. Align the plane first, or draw the outline by hand.'); return false; }
  M=erode(dilate(M,nu,nv,Math.round(1.5/px)),nu,nv,Math.round(1.5/px)); M=fillHoles(M,nu,nv);
  const tr=traceBoundary(M,nu,nv); const ring=tr.map(q=>[U0+q[0]*px,V0+q[1]*px]);
  let poly=dpClosed(ring,1.2); if(poly.length<5){ toast('Could not make a usable outline. Draw it by hand.'); return false; }
  /* landmarks: K = highest vertex; ASA = most anterior vertex above the lowest 15% of the outline; ANS = lowest vertex at least a quarter of the width behind ASA */
  const umin=Math.min(...poly.map(p=>p[0])),umax=Math.max(...poly.map(p=>p[0])),vmin=Math.min(...poly.map(p=>p[1])),vmax=Math.max(...poly.map(p=>p[1]));
  let K=poly[0]; poly.forEach(p=>{ if(p[1]>K[1])K=p; });
  const up=poly.filter(p=>p[1]>=vmin+0.15*(vmax-vmin)); let ASA=up[0]; up.forEach(p=>{ if(p[0]<ASA[0])ASA=p; });
  const cand=poly.filter(p=>p[0]>=ASA[0]+0.25*(umax-umin)&&p[0]<=umin+0.8*(umax-umin)); const pool=cand.length?cand:poly;
  let ANS=pool[0]; pool.forEach(p=>{ if(p[1]<ANS[1]-0.3||(Math.abs(p[1]-ANS[1])<=0.3&&p[0]<ANS[0]))ANS=p; });
  const B=basis(); S.snap=B; S.pts=poly.map(p=>fromUV(p[0],p[1],B)); S.closed=true;
  S.lm.K=fromUV(K[0],K[1],B); S.lm.ASA=fromUV(ASA[0],ASA[1],B); S.lm.ANS=fromUV(ANS[0],ANS[1],B);
  { const u0=Math.min(...poly.map(p=>p[0])),u1=Math.max(...poly.map(p=>p[0])),v0=Math.min(...poly.map(p=>p[1])),v1=Math.max(...poly.map(p=>p[1])); S.view.uc=(u0+u1)/2; S.view.vc=(v0+v1)/2; S.view.s=Math.min(cssW()/Math.max(70,(u1-u0)*1.7),cssH()/Math.max(60,(v1-v0)*1.7)); dirtyImg=true; }
  update(); renderSepRes(); drawMinis(); toast('Outline and landmarks suggested. Check them and drag to correct.'); return true;
}

function roiHU(P,rad){ const B=basis(),vals=[]; for(let du=-rad;du<=rad+1e-6;du+=0.5)for(let dv=-rad;dv<=rad+1e-6;dv+=0.5){ if(du*du+dv*dv>rad*rad)continue; vals.push(sampleVol(S.vol,P[0]+du*B.u[0]+dv*B.v[0],P[1]+du*B.u[1]+dv*B.v[1],P[2]+du*B.u[2]+dv*B.v[2])); } const m=vals.reduce((a,b)=>a+b,0)/vals.length; return {mean:m,sd:Math.sqrt(vals.reduce((a,b)=>a+(b-m)*(b-m),0)/vals.length)}; }
function thickAt(P){ const B=basis(),nT=Math.round(44/0.25)+1; return columnSeptum(P,B.n,new Float32Array(nT),nT,-22,0.25,22); }


function reportExtra(){
  let t=''; const st=S.sm&&S.sm.stats; if(st) t+=`\nSeptal sheet within ${S.sm.gate} mm of plane: deviation p95 ${f1(st.p95)} mm, RMS ${f1(st.rms)} mm; mean thickness (with mucosa) ${f1(st.meanTh)} mm`;
  const os=outlineStats(); if(os) t+=`\nHarvest on the curved septum: ${f0(os.harvSurf)} mm2; ossified share of outline ${f0(100*os.ossShare)}%`;
  if(S.evals&&S.evals.length) t+=`\nPlans (margin ${S.margin}%): `+S.evals.map(e=>e.plan.name+': '+e.txt).join('; ');
  S.annos.forEach(a=>{ t+=`\n${a.type}: ${a.txt}`; }); return t;
}

function smUV(P){ return toUV(P,S.sm.B); }
function pipPoly(x,y,poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i],b=poly[j]; if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])) c=!c; } return c; }
function outlineStats(){
  if(!S.sm||!S.an||!S.snap||!S.closed) return null; const m=S.sm,{nu,nv,px,U0,V0}=m;
  const out=S.pts.map(P=>smUV(P)); const harv=S.an.poly.length>=3?S.an.poly.map(p=>smUV(fromUV(p[0],p[1],S.snap))):null;
  let inN=0,valid=0,oss=0,hN=0,hArea=0,hSurf=0,hTh=0,hThN=0,hMin=1e9,hCov=0;
  for(let j=1;j<nv-1;j++)for(let i=1;i<nu-1;i++){ const x=U0+i*px,y=V0+j*px,k=i+nu*j;
    if(pipPoly(x,y,out)){ inN++; if(!isNaN(m.off[k])){ valid++; if(!m.soft[k]) oss++; } }
    if(harv&&pipPoly(x,y,harv)){ hN++; if(!isNaN(m.off[k])){ hCov++; let gu=0,gv=0; const a=m.off[k+1],b=m.off[k-1],c=m.off[k+nu],d=m.off[k-nu]; if(!isNaN(a)&&!isNaN(b))gu=(a-b)/(2*px); if(!isNaN(c)&&!isNaN(d))gv=(c-d)/(2*px); hSurf+=px*px*Math.sqrt(1+gu*gu+gv*gv); hTh+=m.th[k]; hThN++; if(m.th[k]<hMin)hMin=m.th[k]; } else hSurf+=px*px; } }
  return {outCov:inN?valid/inN:0,ossShare:valid?oss/valid:NaN,harvProj:hN*px*px,harvSurf:hSurf,harvCov:hN?hCov/hN:0,harvTh:hThN?hTh/hThN:NaN,harvThMin:hThN?hMin:NaN};
}
function renderSepRes(){
  const box=$('sepRes'); if(!box) return; const m=S.sm; if(!m){ box.innerHTML='<p class="note">No analysis yet.</p>'; return; }
  const st=m.stats; let h=`<div class="kv"><span>Septum found over</span><span>${f0(st.areaValid)} mm² (${f0(st.areaSoft)} mm² soft)</span><span>Deviation from plane, 95th pct</span><span>${f1(st.p95)} mm</span><span>Deviation RMS</span><span>${f1(st.rms)} mm</span><span>Area deviating over 3 mm</span><span>${f0(st.areaBig)} mm²</span><span>Septal thickness, soft (with mucosa)</span><span>${f1(st.meanTh)} mm</span>`;
  const os=outlineStats(); if(os){ h+=`<span>Ossified share of outline</span><span>${f0(100*os.ossShare)}%</span><span>Harvest area, projected</span><span>${f0(os.harvProj)} mm²</span><span>Harvest area, on the curved septum</span><span>${f0(os.harvSurf)} mm²</span><span>Mean thickness in harvest</span><span>${f1(os.harvTh)} mm (min ${f1(os.harvThMin)})</span>`; }
  h+='</div>'; if(m.stale) h+='<div class="warn">The plane moved after this analysis. Press Align or Suggest again to refresh.</div>';
  box.innerHTML=h;
}
let septMesh=null;
function rebuildSeptMesh(){
  if(!gPat) return; if(septMesh){ gPat.remove(septMesh); septMesh.geometry.dispose(); septMesh.material.dispose(); septMesh=null; }
  const m=S.sm; if(!m) return; const {nu,nv,px,U0,V0,off,th,soft,B}=m,mode=$('sepColor').value; const only=$('sepOnly')&&$('sepOnly').checked&&S.closed&&S.snap&&S.pts.length>=3, outp=only?S.pts.map(P=>smUV(P)):null;
  const pos=[],col=[],idx=[],map=new Int32Array(nu*nv).fill(-1);
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){ const k=i+nu*j; if(isNaN(off[k]))continue; if(outp&&!pipPoly(U0+i*px,V0+j*px,outp))continue; const P0=fromUV(U0+i*px,V0+j*px,B),P=[P0[0]+off[k]*B.n[0],P0[1]+off[k]*B.n[1],P0[2]+off[k]*B.n[2]],sP=toScene(P); map[k]=pos.length/3; pos.push(sP.x,sP.y,sP.z);
    let c; if(mode==='dev'){ const t=Math.max(-1,Math.min(1,off[k]/4)); c=t<0?[1+t*0.7,1+t*0.45,1]:[1,1-t*0.55,1-t*0.7]; } else if(mode==='thick'){ const t=Math.max(0,Math.min(1,(th[k]-1)/5)); c=[0.2+0.8*t,0.25+0.6*t,0.9-0.7*t]; } else if(mode==='gray'){ const t=Math.max(0,Math.min(1,(th[k]-1)/5)); c=[0.92-0.65*t,0.92-0.65*t,0.92-0.65*t]; } else c=soft[k]?[0.25,0.7,0.5]:[0.85,0.8,0.7];
    col.push(c[0],c[1],c[2]); }
  for(let j=0;j<nv-1;j++)for(let i=0;i<nu-1;i++){ const a=map[i+nu*j],b=map[i+1+nu*j],c=map[i+nu*(j+1)],d=map[i+1+nu*(j+1)]; if(a<0||b<0||c<0||d<0)continue; idx.push(a,b,c,b,d,c); }
  if(!idx.length) return;
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx);
  septMesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:0.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  septMesh.visible=S.ly3.sept&&S.tab!=='teach'; gPat.add(septMesh); dirty3=true;
}