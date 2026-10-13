

/* ---------------- 3D (three.js) ---------------- */
let renderer,scene,camera,controls,gTeach,gPat,patMesh=null,planeMesh=null,planeTex=null,ovl=null,clipPl=null,dirty3=true;
const toScene=v=>new THREE.Vector3(v[0],v[2],-v[1]);
function planeMatrix(B,c){ const m=new THREE.Matrix4(); m.makeBasis(toScene(B.u),toScene(B.v),toScene(B.n)); m.setPosition(toScene(c)); return m; }
function init3D(){
  const host=$('three');
  renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); renderer.setClearColor(0x0d1317,1); renderer.localClippingEnabled=true;
  host.appendChild(renderer.domElement);
  scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(32,1,1,4000);
  scene.add(new THREE.HemisphereLight(0xffffff,0x334455,0.85));
  const dl=new THREE.DirectionalLight(0xffffff,0.8); dl.position.set(120,160,200); scene.add(dl);
  const dl2=new THREE.DirectionalLight(0xffffff,0.35); dl2.position.set(-150,-40,-120); scene.add(dl2);
  gTeach=new THREE.Group(); gPat=new THREE.Group(); scene.add(gTeach,gPat);
  controls=new THREE.OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=0.12; controls.addEventListener('change',()=>dirty3=true);
  clipPl=new THREE.Plane(new THREE.Vector3(-1,0,0),0);
  new ResizeObserver(()=>{ const r=host.getBoundingClientRect(); if(r.width<2||r.height<2)return; renderer.setSize(r.width,r.height,false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); dirty3=true; }).observe(host);
  camera.position.set(270,0,0); controls.target.set(0,0,0); controls.update();
  buildTeach();
  (function loop(){ requestAnimationFrame(loop); if(controls.update()||dirty3){ renderer.render(scene,camera); dirty3=false; } })();
}
function shapeMesh(poly,thick,color,opacity,B,extra){
  const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0],p[1])));
  const g=new THREE.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:false}); g.translate(0,0,-thick/2);
  const m=new THREE.Mesh(g,new THREE.MeshPhongMaterial({color,transparent:opacity<1,opacity,side:THREE.DoubleSide,shininess:30}));
  m.matrixAutoUpdate=false; m.matrix.copy(planeMatrix(B,[0,0,0])); if(extra)m.position.copy(extra); return m;
}
function buildTeach(){
  while(gTeach.children.length){ const o=gTeach.children.pop(); o.geometry&&o.geometry.dispose(); }
  const B={n:[1,0,0],u:[0,1,0],v:[0,0,1]};
  if(S.ly.bone){ gTeach.add(shapeMesh(SCH.ppe,1.4,0xd9d2bd,1,B)); gTeach.add(shapeMesh(SCH.vomer,1.4,0xbfb8a5,1,B)); }
  if(S.ly.cart) gTeach.add(shapeMesh(SCH.cart,2.6,0x7cc3dc,0.9,B));
  const a=schAnalysis();
  if(S.ly.harv&&a.poly.length>=3) gTeach.add(shapeMesh(a.poly,3.0,0x2f9e6b,1,B));
  gTeach.position.set(0,-26,28);
  dirty3=true;
}
function buildBone(){
  const v=S.vol; if(!v) return;
  if(patMesh){ gPat.remove(patMesh); patMesh.geometry.dispose(); patMesh=null; }
  const N=v.nx*v.ny*v.nz; const stride=Math.max(1,Math.ceil(Math.cbrt(N/4.5e6)));
  const g=surfaceNets(v,S.boneHU,stride);
  if(!g) { toast('No bone surface at this threshold.'); return; }
  const mat=new THREE.MeshPhongMaterial({color:0xe8e0cc,shininess:25,side:THREE.DoubleSide,clippingPlanes:S.cut?[clipPl]:[]});
  patMesh=new THREE.Mesh(g,mat); patMesh.visible=S.ly3.bone; const o=+($('boneOp')?$('boneOp').value:1); mat.transparent=o<1; mat.opacity=o; mat.depthWrite=o>=1; gPat.add(patMesh); updatePlane3D(); dirty3=true;
}
function surfaceNets(vol,iso,stride){
  const dx=Math.ceil(vol.nx/stride)+2,dy=Math.ceil(vol.ny/stride)+2,dz=Math.ceil(vol.nz/stride)+2;
  const F=new Float32Array(dx*dy*dz).fill(-1024);
  for(let k=0;k<dz-2;k++)for(let j=0;j<dy-2;j++)for(let i=0;i<dx-2;i++){
    let s=0,c=0; const k0=k*stride,j0=j*stride,i0=i*stride;
    for(let kk=k0;kk<Math.min(k0+stride,vol.nz);kk++)for(let jj=j0;jj<Math.min(j0+stride,vol.ny);jj++){ const b=vol.nx*(jj+vol.ny*kk); for(let ii=i0;ii<Math.min(i0+stride,vol.nx);ii++){ s+=vol.data[b+ii]; c++; } }
    F[(i+1)+dx*((j+1)+dy*(k+1))]=s/c;
  }
  const cell=new Int32Array(dx*dy*dz).fill(-1); const V=[];
  const co=[0,1,dx,dx+1,dx*dy,dx*dy+1,dx*dy+dx,dx*dy+dx+1];
  const cp=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const ed=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const val=new Float32Array(8);
  for(let k=0;k<dz-1;k++)for(let j=0;j<dy-1;j++)for(let i=0;i<dx-1;i++){
    const b=i+dx*(j+dy*k); let m=0;
    for(let c=0;c<8;c++){ val[c]=F[b+co[c]]-iso; if(val[c]>=0) m|=1<<c; }
    if(m===0||m===255) continue;
    let sx=0,sy=0,sz=0,n=0;
    for(let e=0;e<12;e++){ const a=ed[e][0],c=ed[e][1]; if((val[a]>=0)!==(val[c]>=0)){ const t=val[a]/(val[a]-val[c]); sx+=cp[a][0]+t*(cp[c][0]-cp[a][0]); sy+=cp[a][1]+t*(cp[c][1]-cp[a][1]); sz+=cp[a][2]+t*(cp[c][2]-cp[a][2]); n++; } }
    cell[b]=V.length/3; V.push(i+sx/n,j+sy/n,k+sz/n);
  }
  if(!V.length) return null;
  const idx=[];
  const quad=(A,B,C,D,flip)=>{ if(A<0||B<0||C<0||D<0)return; if(!flip) idx.push(A,B,C,A,C,D); else idx.push(A,C,B,A,D,C); };
  for(let k=1;k<dz-1;k++)for(let j=1;j<dy-1;j++)for(let i=1;i<dx-1;i++){
    const p=i+dx*(j+dy*k),s0=F[p]>=iso;
    const cx=(a,b,c)=>cell[a+dx*(b+dy*c)];
    if(s0!==(F[p+1]>=iso)) quad(cx(i,j-1,k-1),cx(i,j,k-1),cx(i,j,k),cx(i,j-1,k),!s0);
    if(s0!==(F[p+dx]>=iso)) quad(cx(i-1,j,k-1),cx(i-1,j,k),cx(i,j,k),cx(i,j,k-1),!s0);
    if(s0!==(F[p+dx*dy]>=iso)) quad(cx(i-1,j-1,k),cx(i,j-1,k),cx(i,j,k),cx(i-1,j,k),!s0);
  }
  const pos=new Float32Array(V.length);
  for(let q=0;q<V.length;q+=3){
    const wx=vol.ox+((V[q]-1)*stride+(stride-1)/2)*vol.sx, wy=vol.oy+((V[q+1]-1)*stride+(stride-1)/2)*vol.sy, wz=vol.oz+((V[q+2]-1)*stride+(stride-1)/2)*vol.sz;
    pos[q]=wx; pos[q+1]=wz; pos[q+2]=-wy;
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1)); g.computeVertexNormals(); return g;
}
function updatePlane3D(){
  if(!S.vol||!scene) return;
  const B=basis(),W=imgCv.width,H=imgCv.height,s=S.view.s*CK;
  if(!planeTex||planeTex.image!==imgCv||planeTex.__w!==W||planeTex.__h!==H){
    if(planeTex)planeTex.dispose(); planeTex=new THREE.CanvasTexture(imgCv); planeTex.__w=W; planeTex.__h=H; planeTex.minFilter=THREE.LinearFilter;
    if(planeMesh){ gPat.remove(planeMesh); planeMesh.material.dispose(); planeMesh.geometry.dispose(); planeMesh=null; }
  }
  if(!planeMesh){ planeMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:planeTex,side:THREE.DoubleSide,transparent:true,opacity:0.95,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2})); planeMesh.matrixAutoUpdate=false; gPat.add(planeMesh); }
  planeTex.needsUpdate=true;
  const m=planeMatrix(B,B.c); m.multiply(new THREE.Matrix4().makeTranslation(S.view.uc,S.view.vc,0)).multiply(new THREE.Matrix4().makeScale(W/s,H/s,1));
  planeMesh.matrix.copy(m); planeMesh.visible=S.showPlane&&S.tab!=='teach';
  const n=toScene(B.n); clipPl.normal.copy(n).negate(); clipPl.constant=n.dot(toScene(B.c));
  dirty3=true;
}
function updateOverlays3D(){
  if(ovl){ gPat.remove(ovl); ovl.traverse(o=>{o.geometry&&o.geometry.dispose();}); ovl=null; }
  if(!S.vol) return;
  ovl=new THREE.Group();
  const lineMat=c=>new THREE.LineBasicMaterial({color:c,depthTest:false,transparent:true}); 
  const mk=(pts,c,loop)=>{ const g=new THREE.BufferGeometry().setFromPoints(pts.map(toScene)); const l=loop?new THREE.LineLoop(g,lineMat(c)):new THREE.Line(g,lineMat(c)); l.renderOrder=10; ovl.add(l); };
  if(S.pts.length>1) mk(S.pts,S.bw?0xffffff:0xe0a030,S.closed);
  if(S.an&&S.an.poly.length>=3&&S.snap){ mk(S.an.poly.map(p=>fromUV(p[0],p[1],S.snap)),S.bw?0xffffff:0x2f9e6b,true); }
  const dot3=(P,c)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(1.1,12,8),new THREE.MeshBasicMaterial({color:c,depthTest:false})); m.position.copy(toScene(P)); m.renderOrder=11; ovl.add(m); };
  const lc=S.bw?{K:0xffffff,ASA:0xffffff,ANS:0xffffff}:{K:0xff6b6b,ASA:0xffd166,ANS:0x6bc5ff}; Object.keys(S.lm).forEach(k=>{ if(S.lm[k]) dot3(S.lm[k],lc[k]); });
  if(S.ruler.length===2) mk(S.ruler,0xffffff,false);
  if(S.snap&&S.ly3.plan){
    const mat=planeMatrix(S.snap,S.snap.c);
    if(S.an&&S.an.poly.length>=3){ const sh=new THREE.Shape(S.an.poly.map(q=>new THREE.Vector2(q[0],q[1]))); const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),new THREE.MeshBasicMaterial({color:S.bw?0xffffff:0x2f9e6b,transparent:true,opacity:S.bw?0.55:0.45,side:THREE.DoubleSide,depthTest:false})); m.matrixAutoUpdate=false; m.matrix.copy(mat); m.renderOrder=9; ovl.add(m); }
    if(S.tab==='plan'&&S.sel){ const cols=S.bw?{spr:0x111111,col:0x111111,seg:0x111111,tym:0x111111}:{spr:0xe0a030,col:0x58b2d1,seg:0xd9534f,tym:0x9b7fd6}; S.sel.placed.forEach(pl=>{ const box=new THREE.Mesh(new THREE.BoxGeometry(pl.L,pl.W,1.4),new THREE.MeshBasicMaterial({color:cols[pl.id]||0xffffff,transparent:true,opacity:0.88,depthTest:false})); const t=new THREE.Matrix4().makeTranslation(pl.cx,pl.cy,0).multiply(new THREE.Matrix4().makeRotationZ(pl.th*D2R)); box.matrixAutoUpdate=false; box.matrix.copy(mat.clone().multiply(t)); box.renderOrder=12; ovl.add(box); }); }
  }
  gPat.add(ovl); dirty3=true;
}
function fitCamera(view){
  const v=S.vol; if(!v||!camera) return;
  const B=basis(); const tgt=fromUV(S.view.uc,S.view.vc,B); const T=toScene(tgt); const d=Math.min(600,Math.max(220,Math.max(v.nz*v.sz,v.ny*v.sy)*2.6));
  const dirs={front:[0,0,1],left:[1,0,0],right:[-1,0,0],top:[0,1,0.001],obl:[1,0.45,0.9]};
  let dir=dirs[view||'obl']; const dv=new THREE.Vector3(...dir).normalize();
  if(!view&&S.cut){ dv.copy(toScene(B.n)); }
  camera.position.copy(T).addScaledVector(dv,d); controls.target.copy(T); controls.update(); dirty3=true;
}
function setCamTeach(){ camera.position.set(270,0,0); controls.target.set(0,0,0); camera.up.set(0,1,0); controls.update(); dirty3=true; }