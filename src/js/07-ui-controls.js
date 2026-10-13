

function renderChart(avail){
  const refs=[['Kim 2014, Korea',497.3,181.7,'h'],['Nguyen 2026, n=116',461.5,0,'d'],['Kim 2010, intra-op',520.9,0,'h'],['Rendón-Medina 2025',320,0,'d'],['Nguyen 2026, composite',992.0,0,'d']];
  const rows=refs.slice(); if(avail!=null) rows.unshift(['This patient',avail,0,'s']);
  const mx=Math.max(1100,...rows.map(r=>r[1]+r[2]+20)),W=340,L=148,bh=16,gap=8,H=rows.length*(bh+gap)+20;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Harvestable area comparison"><defs><pattern id="hh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--panel)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink)" stroke-width="2"/></pattern><pattern id="dd" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--panel)"/><circle cx="2.5" cy="2.5" r="1" fill="var(--ink)"/></pattern></defs>`;
  rows.forEach((r,i)=>{ const y=i*(bh+gap)+4,w=(W-L-30)*r[1]/mx; const fill=r[3]==='s'?'var(--accent)':r[3]==='h'?'url(#hh)':'url(#dd)';
    s+=`<text x="${L-6}" y="${y+bh-4}" text-anchor="end" font-size="10.5" fill="var(--ink)">${r[0]}</text><rect x="${L}" y="${y}" width="${w}" height="${bh}" fill="${fill}" stroke="var(--ink)" stroke-width="1"/>`;
    if(r[2]){ const a=(W-L-30)*(r[1]-r[2])/mx,b=(W-L-30)*(r[1]+r[2])/mx; s+=`<line x1="${L+a}" x2="${L+b}" y1="${y+bh/2}" y2="${y+bh/2}" stroke="var(--ink)"/><line x1="${L+a}" x2="${L+a}" y1="${y+3}" y2="${y+bh-3}" stroke="var(--ink)"/><line x1="${L+b}" x2="${L+b}" y1="${y+3}" y2="${y+bh-3}" stroke="var(--ink)"/>`; }
    s+=`<text x="${L+Math.max(w,(W-L-30)*(r[1]+r[2])/mx)+5}" y="${y+bh-4}" font-size="10.5" fill="var(--muted)">${f0(r[1])}</text>`; });
  s+=`<text x="${L}" y="${H-3}" font-size="10" fill="var(--muted)">mm²</text></svg>`; $('chart').innerHTML=s;
}
/* ---------------- tabs + controls ---------------- */
const HELP={pan:'Drag to move the image. Scroll to zoom. Right-drag also pans.',trace:'Click around the septal cartilage. Click the first point again to close. Drag a point to adjust it.',lm:'Pick K, ASA or ANS, then click the image. Drag a marker to move it.',ruler:'Click two points to measure. A third click starts again.',angle:'Click three points: the end of one arm, the corner, then the end of the other arm.',hu:'Click to read the mean and spread of HU in a 2 mm disc on the plane.',thick:'Click on the septum to read its thickness across the plane and its mean HU.'};
const LMN={K:'K: upper end of the dorsal strut, where cartilage meets the nasal bones',ASA:'ASA: anterior septal angle, the corner where dorsal and caudal struts meet',ANS:'ANS: anterior nasal spine, the lower end of the caudal strut'};
function setTab(t){
  S.tab=t; document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===t)));
  document.querySelectorAll('.tabpanel').forEach(p=>p.hidden=p.id!=='tab-'+t);
  gTeach.visible=(t==='teach')||!S.vol; gPat.visible=t!=='teach'&&!!S.vol; if(typeof septMesh!=='undefined'&&septMesh) septMesh.visible=S.ly3.sept&&t!=='teach'; if(S.vol) updateOverlays3D();
  if(t==='teach'||!S.vol) setCamTeach(); else fitCamera();
  if(t==='plan') renderPlanning();
  if(t==='patient') drawMinis();
  dirtyImg=true; requestDraw(); updatePlane3D(); dirty3=true;
}
function setTool(t){ S.tool=t; document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===t))); $('toolHelp').textContent=HELP[t]; $('lmRow').hidden=t!=='lm'; sag.style.cursor=t==='pan'?'grab':'crosshair'; }
function setLm(k){ S.lmSel=k; document.querySelectorAll('[data-lm]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lm===k))); $('lmName').textContent=LMN[k]; }
function syncUI(){ $('wL').value=S.win.l; $('wW').value=S.win.w; }
function bindRange(id,outId,fmt,fn,onChange){
  const el=$(id); el.addEventListener('input',()=>{ $(outId).textContent=fmt(+el.value); fn(+el.value); });
  if(onChange) el.addEventListener('change',()=>onChange(+el.value));
}
function setStrut(w){ S.strutW=w; $('tStrut').value=w; $('pStrut').value=w; $('tStrutO').textContent=f1(w)+' mm'; $('pStrutO').textContent=f1(w)+' mm'; }
function bind(){
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  document.querySelectorAll('[data-lm]').forEach(b=>b.onclick=()=>setLm(b.dataset.lm));
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{ if(S.tab==='teach'||!S.vol){ const d={front:[0,0,270],left:[270,0,0],right:[-270,0,0],top:[0,270,1],obl:[200,90,170]}[b.dataset.view]; camera.position.set(...d); controls.target.set(0,0,0); controls.update(); dirty3=true; } else fitCamera(b.dataset.view); });
  /* teaching */
  [['lyCart','cart'],['lyBone','bone'],['lyStrut','strut'],['lyHarv','harv']].forEach(([id,k])=>$(id).onchange=e=>{S.ly[k]=e.target.checked; buildTeach(); requestDraw();});
  const tK=()=>{ const a=schAnalysis(); $('tKv').innerHTML=`<span>Cartilage (schematic)</span><span>${f0(a.total)} mm²</span><span>Harvestable</span><span>${f0(a.harv)} mm²</span><span>Share left</span><span>${f0(100*a.harv/a.total)}%</span>`; };
  $('tStrut').addEventListener('input',e=>{ setStrut(+e.target.value); buildTeach(); tK(); requestDraw(); update(); }); tK();
  $('pStrut').addEventListener('input',e=>{ setStrut(+e.target.value); buildTeach(); tK(); update(); });
  bindRange('pMargin','pMarginO',v=>v+'%',v=>{S.margin=v;schedulePlan();});
  $('pContact').oninput=e=>{S.contact=e.target.value;renderPlanning();};
  $('srcTrace').onclick=()=>{S.src='trace';$('srcTrace').setAttribute('aria-pressed','true');$('srcManual').setAttribute('aria-pressed','false');$('srcTraceBox').hidden=false;$('srcManualBox').hidden=true;renderPlanning();};
  $('srcManual').onclick=()=>{S.src='manual';$('srcManual').setAttribute('aria-pressed','true');$('srcTrace').setAttribute('aria-pressed','false');$('srcTraceBox').hidden=true;$('srcManualBox').hidden=false;renderPlanning();};
  ['mArea','mLen','mWid'].forEach(id=>$(id).oninput=()=>{S.manual={area:$('mArea').value,len:$('mLen').value,wid:$('mWid').value};renderPlanning();});
  $('mRef').onclick=()=>{ $('mArea').value=461.5; S.manual.area=461.5; renderPlanning(); };
  buildGraftTable();
  /* patient */
  const drop=$('drop'),file=$('file');
  drop.onclick=()=>file.click(); drop.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();} };
  file.onchange=()=>{ if(file.files.length) handleFiles([...file.files]); file.value=''; };
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
  drop.addEventListener('drop',e=>{ if(e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });
  $('ser').onchange=e=>loadCatalog(+e.target.value);
  $('autoPlane').onclick=async()=>{ if(!S.vol){toast('Load a scan first.');return;} busy('Finding plane…'); await tick(); autoPlane(); busy(); S.snap=null; clearAll(true); dirtyImg=true; drawMinis(); requestDraw(); updatePlane3D(); toast('Plane detected. Check it on the axial and coronal views.'); };
  const planeChange=()=>{ if(S.sm)S.sm.stale=true; renderSepRes(); syncPlaneOut(); dirtyImg=true; requestDraw(); drawMinis(); updatePlane3D(); };
  $('pShift').addEventListener('input',e=>{S.plane.x0=S.plane.x0auto+(+e.target.value);planeChange();});
  $('pYaw').addEventListener('input',e=>{S.plane.yaw=+e.target.value;planeChange();});
  $('pRoll').addEventListener('input',e=>{S.plane.roll=+e.target.value;planeChange();});
  $('pShift').addEventListener('change',updateOverlays3D);
  $('ax').addEventListener('pointerdown',e=>miniClick(e,'ax')); $('co').addEventListener('pointerdown',e=>miniClick(e,'co'));
  const img=()=>{dirtyImg=true;requestDraw();drawMinis();};
  bindRange('wL','wLO',v=>f0(v),v=>{S.win.l=v;img();}); bindRange('wW','wWO',v=>f0(v),v=>{S.win.w=v;img();}); bindRange('slab','slabO',v=>v+' mm',v=>{S.slab=v;img();});
  $('closeOutline').onclick=()=>{ if(S.pts.length<3){toast('Place at least three points.');return;} S.closed=true; update(); };
  $('undo').onclick=()=>{ if(['angle','hu','thick'].includes(S.tool)&&(S.pending.length||S.annos.length)){ if(S.pending.length)S.pending.pop(); else S.annos.pop(); update(true); return; } if(S.closed){S.closed=false;} else S.pts.pop(); if(!S.pts.length&&!Object.values(S.lm).some(Boolean))S.snap=null; update(); };
  const clearAll=(quiet)=>{ S.pts=[];S.closed=false;S.lm={K:null,ASA:null,ANS:null};S.ruler=[];S.snap=null;S.annos=[];S.pending=[]; update(); setLm('K'); };
  window.clearAll=clearAll; $('clearAll').onclick=()=>clearAll();
  $('copyRes').onclick=()=>{ const a=S.an; if(!a){toast('Nothing to copy yet.');return;} const B=basis();
    const t=`Septal cartilage (projected area, midsagittal reformat)\nTotal cartilage: ${f0(a.total)} mm2\nL-strut width: ${f1(S.strutW)} mm\nHarvestable: ${f0(a.harv)} mm2\nDorsal edge: ${f1(a.dorsal)} mm; caudal edge: ${f1(a.caudal)} mm\nSpan: ${f1(a.feretMax)} x ${f1(a.feretMin)} mm\nPlane: yaw ${f1(S.plane.yaw)} deg, roll ${f1(S.plane.roll)} deg\nVoxel ${S.vol.sx.toFixed(2)} x ${S.vol.sy.toFixed(2)} x ${S.vol.sz.toFixed(2)} mm\nResearch/teaching tool, not a medical device.`+reportExtra();
    (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Summary copied.')).catch(()=>toast('Copy is blocked here. Select the numbers on screen instead.')); };
  $('bwOv').onchange=e=>{S.bw=e.target.checked;requestDraw();updateOverlays3D();};
  $('boneHU').addEventListener('input',e=>$('boneHUO').textContent=e.target.value+' HU');
  $('boneHU').addEventListener('change',async e=>{ S.boneHU=+e.target.value; busy('Rebuilding surface…'); await tick(); buildBone(); busy(); });
  $('cutPlane').onchange=e=>{ S.cut=e.target.checked; if(patMesh){ patMesh.material.clippingPlanes=S.cut?[clipPl]:[]; patMesh.material.needsUpdate=true; } if(S.vol&&S.tab!=='teach'){ if(S.cut) fitCamera(); } dirty3=true; };
  $('showPlane').onchange=e=>{ S.showPlane=e.target.checked; if(planeMesh)planeMesh.visible=S.showPlane&&S.tab!=='teach'; dirty3=true; };
  const apply3d=()=>{ if(patMesh)patMesh.visible=S.ly3.bone; if(septMesh)septMesh.visible=S.ly3.sept&&S.tab!=='teach'; updateOverlays3D(); dirty3=true; };
  ['bone','sept','plan'].forEach(k=>$('ly3'+k).onchange=e=>{S.ly3[k]=e.target.checked;apply3d();});
  $('boneOp').addEventListener('input',e=>{ if(patMesh){ const o=+e.target.value; patMesh.material.transparent=o<1; patMesh.material.opacity=o; patMesh.material.depthWrite=o>=1; patMesh.material.needsUpdate=true; dirty3=true; } });
  $('alignSep').onclick=()=>alignPlane(); $('sugOutline').onclick=async()=>{ if(!S.vol){toast('Load a scan first.');return;} busy('Looking for the septum…'); await tick(); if(!S.sm||S.sm.stale) computeSeptum(5); busy(); if(!S.sm||!septMesh) rebuildSeptMesh(); suggestOutline(); };
  $('sepColor').onchange=()=>rebuildSeptMesh(); $('sepOnly').onchange=()=>rebuildSeptMesh();
  setTool('pan'); setLm('K'); setStrut(10); renderChart(null);
  new ResizeObserver(()=>{ const r=$('sagHost').getBoundingClientRect(),w=Math.max(200,Math.floor(r.width)),h=Math.max(200,Math.floor(r.height)); const bw=Math.round(w*CK),bh=Math.round(h*CK); if(sag.width!==bw||sag.height!==bh){ sag.width=bw;sag.height=bh;imgCv.width=bw;imgCv.height=bh; dirtyImg=true; requestDraw(); } }).observe($('sagHost'));
}
