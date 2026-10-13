

/* ---------------- geometry (2D) ---------------- */
function polyArea(p){ let a=0; for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length]; a+=p[i][0]*q[1]-q[0]*p[i][1];} return Math.abs(a)/2; }
function polyCentroid(p){ let a=0,cx=0,cy=0; for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length]; const c=p[i][0]*q[1]-q[0]*p[i][1]; a+=c; cx+=(p[i][0]+q[0])*c; cy+=(p[i][1]+q[1])*c;} if(Math.abs(a)<1e-9){ let sx=0,sy=0; p.forEach(v=>{sx+=v[0];sy+=v[1];}); return [sx/p.length,sy/p.length]; } return [cx/(3*a),cy/(3*a)]; }
function strutNormal(a,b,cen){ const dx=b[0]-a[0],dy=b[1]-a[1]; const L=Math.hypot(dx,dy)||1; let nx=-dy/L,ny=dx/L; if((cen[0]-a[0])*nx+(cen[1]-a[1])*ny<0){nx=-nx;ny=-ny;} return [nx,ny]; }
function clipHalf(poly,a,nrm,w){
  const out=[],n=poly.length;
  for(let i=0;i<n;i++){
    const p=poly[i],q=poly[(i+1)%n];
    const dp=(p[0]-a[0])*nrm[0]+(p[1]-a[1])*nrm[1]-w, dq=(q[0]-a[0])*nrm[0]+(q[1]-a[1])*nrm[1]-w;
    if(dp>=0) out.push(p);
    if((dp>=0)!==(dq>=0)){ const t=dp/(dp-dq); out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]); }
  }
  return out;
}
function edgeLenOnLine(poly,a,nrm,w){
  let L=0; const n=poly.length;
  for(let i=0;i<n;i++){ const p=poly[i],q=poly[(i+1)%n];
    const dp=(p[0]-a[0])*nrm[0]+(p[1]-a[1])*nrm[1]-w, dq=(q[0]-a[0])*nrm[0]+(q[1]-a[1])*nrm[1]-w;
    if(Math.abs(dp)<1e-6&&Math.abs(dq)<1e-6) L+=Math.hypot(q[0]-p[0],q[1]-p[1]); }
  return L;
}
function analysePoly(poly,K,ASA,ANS,w){
  const cen=polyCentroid(poly);
  const nD=strutNormal(K,ASA,cen), nC=strutNormal(ASA,ANS,cen);
  let h=clipHalf(poly,K,nD,w); if(h.length>=3) h=clipHalf(h,ASA,nC,w);
  const total=polyArea(poly), harv=h.length>=3?polyArea(h):0;
  let fmax=0,fmin=Infinity;
  if(h.length>=3){ for(let t=0;t<180;t+=1){ const c=Math.cos(t*D2R),s=Math.sin(t*D2R); let mn=1e9,mx=-1e9; for(const p of h){const d=p[0]*c+p[1]*s; if(d<mn)mn=d; if(d>mx)mx=d;} const e=mx-mn; if(e>fmax)fmax=e; if(e<fmin)fmin=e; } } else fmin=0;
  return {total,harv,poly:h.length>=3?h:[],nD,nC,
    dorsal:h.length>=3?edgeLenOnLine(h,K,nD,w):0, caudal:h.length>=3?edgeLenOnLine(h,ASA,nC,w):0,
    feretMax:fmax, feretMin:fmin, K,ASA,ANS,w};
}
function pip(pt,poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i],b=poly[j]; if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])) c=!c; } return c; }
function segX(a,b,c,d){ const o=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]); const e=1e-9;
  const o1=o(a,b,c),o2=o(a,b,d),o3=o(c,d,a),o4=o(c,d,b);
  return ((o1>e&&o2<-e)||(o1<-e&&o2>e))&&((o3>e&&o4<-e)||(o3<-e&&o4>e)); }
function rectInside(poly,c){ for(const p of c) if(!pip(p,poly)) return false;
  for(let i=0;i<4;i++){ const a=c[i],b=c[(i+1)%4]; for(let j=0;j<poly.length;j++){ if(segX(a,b,poly[j],poly[(j+1)%poly.length])) return false; } } return true; }
function fitsRect(poly,L,W){
  if(!poly||poly.length<3) return false;
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; poly.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  if(Math.max(L,W)>Math.hypot(x1-x0,y1-y0)+1e-6) return false;
  const hl=L/2,hw=W/2;
  for(let th=0;th<180;th+=5){ const c=Math.cos(th*D2R),s=Math.sin(th*D2R);
    for(let cx=x0;cx<=x1;cx+=1) for(let cy=y0;cy<=y1;cy+=1){
      if(!pip([cx,cy],poly)) continue;
      const cor=[[-hl,-hw],[hl,-hw],[hl,hw],[-hl,hw]].map(q=>[cx+q[0]*c-q[1]*s,cy+q[0]*s+q[1]*c]);
      if(rectInside(poly,cor)) return true; } }
  return false;
}

/* ---------------- schematic septum ---------------- */
const SC=1.2;
const SCH={
  cart:[[-18,12],[12,34],[22,27],[27,9],[23,0],[0,0]].map(p=>[p[0]*SC,p[1]*SC]),
  ppe:[[12,34],[40,46],[56,22],[27,9],[22,27]].map(p=>[p[0]*SC,p[1]*SC]),
  vomer:[[23,0],[27,9],[56,22],[64,6],[52,-2],[30,-3]].map(p=>[p[0]*SC,p[1]*SC]),
  K:[12*SC,34*SC],ASA:[-18*SC,12*SC],ANS:[0,0]
};
function schAnalysis(){ return analysePoly(SCH.cart,SCH.K,SCH.ASA,SCH.ANS,S.strutW); }

/* ---------------- plane basis ---------------- */
function basis(){
  const a=S.plane.yaw*D2R,b=S.plane.roll*D2R,cz=Math.cos(a),sz=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
  const R=v=>{ const x1=v[0]*cb+v[2]*sb,y1=v[1],z1=-v[0]*sb+v[2]*cb; return [x1*cz-y1*sz,x1*sz+y1*cz,z1]; };
  return {n:R([1,0,0]),u:R([0,1,0]),v:R([0,0,1]),c:[S.plane.x0,S.plane.yc,S.plane.zc]};
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const toUV=(P,B)=>{ const r=[P[0]-B.c[0],P[1]-B.c[1],P[2]-B.c[2]]; return [dot(r,B.u),dot(r,B.v)]; };
const fromUV=(u,v,B)=>[B.c[0]+u*B.u[0]+v*B.v[0],B.c[1]+u*B.u[1]+v*B.v[1],B.c[2]+u*B.u[2]+v*B.v[2]];
const offPlane=(P,B)=>dot([P[0]-B.c[0],P[1]-B.c[1],P[2]-B.c[2]],B.n);