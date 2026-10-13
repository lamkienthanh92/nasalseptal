

/* ---------------- analysis ---------------- */
function computeAnalysis(){
  S.an=null; if(!S.snap||!S.closed||S.pts.length<3||!S.lm.K||!S.lm.ASA||!S.lm.ANS) return;
  const q=P=>toUV(P,S.snap); const poly=S.pts.map(q);
  S.an=analysePoly(poly,q(S.lm.K),q(S.lm.ASA),q(S.lm.ANS),S.strutW);
}
function updateResults(){
  const a=S.an; let h='';
  const need=[]; if(S.pts.length<3||!S.closed) need.push('close the outline'); if(!S.lm.K||!S.lm.ASA||!S.lm.ANS) need.push('place K, ASA and ANS');
  if(!S.vol) h='<p class="note">Load a scan to begin.</p>';
  else if(a){
    h=`<div class="kv"><span>Cartilage area (projected)</span><span>${f0(a.total)} mm²</span><span>Harvestable after ${f1(S.strutW)} mm strut</span><span>${f0(a.harv)} mm² (${f1(a.harv/100)} cm²)</span><span>Dorsal edge of harvest</span><span>${f1(a.dorsal)} mm</span><span>Caudal edge of harvest</span><span>${f1(a.caudal)} mm</span><span>Longest × narrowest span</span><span>${f1(a.feretMax)} × ${f1(a.feretMin)} mm</span><span>Dorsal strut K–ASA</span><span>${f1(Math.hypot(a.K[0]-a.ASA[0],a.K[1]-a.ASA[1]))} mm</span><span>Caudal strut ASA–ANS</span><span>${f1(Math.hypot(a.ASA[0]-a.ANS[0],a.ASA[1]-a.ANS[1]))} mm</span></div>`;
    if(a.harv<=0) h+='<div class="warn">The strut lines remove the whole outline. Check the landmarks and the strut width.</div>';
  } else h='<p class="note">To get areas: '+need.join(' and ')+'.</p>';
  if(S.ruler.length===2){ const d=Math.hypot(S.ruler[0][0]-S.ruler[1][0],S.ruler[0][1]-S.ruler[1][1],S.ruler[0][2]-S.ruler[1][2]); h+=`<div class="kv" style="margin-top:6px"><span>Ruler</span><span>${f1(d)} mm</span></div>`; }
  if(S.annos.length){ h+='<div class="kv" style="margin-top:6px">'+S.annos.map(a=>`<span>${{angle:'Angle',hu:'HU disc',thick:'Thickness'}[a.type]}</span><span>${a.txt}</span>`).join('')+'</div>'; }
  $('results').innerHTML=h;
}

/* ---------------- planning ---------------- */

/* ================= placement + plans ================= */
function buildMask(poly,res){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; poly.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);});
  x0-=res;y0-=res;x1+=res;y1+=res; const nx=Math.ceil((x1-x0)/res)+1,ny=Math.ceil((y1-y0)/res)+1,M=new Uint8Array(nx*ny);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++) M[i+nx*j]=pipPoly(x0+i*res,y0+j*res,poly)?1:0;
  return {M,nx,ny,x0,y0,res};
}
function rectPts(L,W){ const nl=Math.max(1,Math.ceil(L/1)),nw=Math.max(1,Math.ceil(W/1)),pts=[]; for(let i=0;i<=nl;i++)for(let j=0;j<=nw;j++)pts.push([-L/2+L*i/nl,-W/2+W*j/nw]); return pts; }
function findPlacements(mask,L,W,max,firstOnly){
  const {M,nx,ny,x0,y0,res}=mask,pts=rectPts(L,W),out=[],bx=x0+(nx-1)*res,by=y0+(ny-1)*res;
  for(let th=0;th<180;th+=7.5){ const c=Math.cos(th*D2R),s_=Math.sin(th*D2R);
    for(let cy=y0;cy<=by;cy+=1)for(let cx=x0;cx<=bx;cx+=1){
      let ok=true; for(let q=0;q<pts.length;q++){ const x=cx+pts[q][0]*c-pts[q][1]*s_,y=cy+pts[q][0]*s_+pts[q][1]*c,i=Math.round((x-x0)/res),j=Math.round((y-y0)/res); if(i<0||j<0||i>=nx||j>=ny||!M[i+nx*j]){ok=false;break;} }
      if(ok){ out.push({cx,cy,th}); if(firstOnly) return out; } } }
  if(out.length>max){ const st=out.length/max,t=[]; for(let i=0;i<max;i++)t.push(out[Math.floor(i*st)]); return t; }
  return out;
}
function cellSet(pl,L,W){ const c=Math.cos(pl.th*D2R),s_=Math.sin(pl.th*D2R),set=[]; rectPts(L,W).forEach(q=>{ const x=pl.cx+q[0]*c-q[1]*s_,y=pl.cy+q[0]*s_+q[1]*c; set.push((Math.round(x)+2000)*4001+(Math.round(y)+2000)); }); return Array.from(new Set(set)); }
function packRects(mask,rects){
  const cache={}; const lists=rects.map(r=>{ const k=r.L.toFixed(2)+'x'+r.W.toFixed(2); if(!cache[k]) cache[k]=findPlacements(mask,r.L,r.W,120,false).map(p=>({...p,cells:cellSet(p,r.L,r.W)})); return cache[k]; });
  const alone=lists.map(l=>l.length>0);
  const idx=rects.map((_,i)=>i).sort((a,b)=>lists[a].length-lists[b].length);
  if(alone.every(Boolean)){
    const chosen=new Array(rects.length),used=new Set(); let nodes=0;
    const dfs=k=>{ if(k===idx.length) return true; if(++nodes>30000) return false; const i=idx[k]; for(const pl of lists[i]){ if(pl.cells.some(c=>used.has(c))) continue; chosen[i]=pl; pl.cells.forEach(c=>used.add(c)); if(dfs(k+1)) return true; pl.cells.forEach(c=>used.delete(c)); } return false; };
    if(dfs(0)) return {ok:true,alone,placed:chosen.map((pl,i)=>({k:i,cx:pl.cx,cy:pl.cy,th:pl.th}))};
  }
  const placed=[],ug=new Set(); idx.forEach(i=>{ for(const pl of lists[i]){ if(pl.cells.some(c=>ug.has(c))) continue; pl.cells.forEach(c=>ug.add(c)); placed.push({k:i,cx:pl.cx,cy:pl.cy,th:pl.th}); break; } });
  return {ok:false,alone,placed};
}
function maxFit(mask,L,W){
  let maxL=0,maxW=0; for(let l=L-1;l>=3;l-=1){ if(findPlacements(mask,l,W,1,true).length){maxL=l;break;} }
  for(let w=W-0.5;w>=1;w-=0.5){ if(findPlacements(mask,L,w,1,true).length){maxW=w;break;} }
  return {maxL,maxW};
}
let maskCache={key:'',mask:null};
function planCtx(){
  if(S.src==='trace'){
    if(!S.an||S.an.harv<=0||!S.snap) return null;
    const key=JSON.stringify(S.an.poly.map(p=>[Math.round(p[0]*20),Math.round(p[1]*20)]));
    if(maskCache.key!==key) maskCache={key,mask:buildMask(S.an.poly,0.5)};
    return {mode:'trace',avail:S.an.harv,mask:maskCache.mask};
  }
  const avail=+S.manual.area; if(!(avail>0)) return null;
  return {mode:'manual',avail,len:+S.manual.len||null,wid:+S.manual.wid||null};
}
function expandRects(items){ const out=[]; items.forEach(id=>{ const g=S.grafts.find(x=>x.id===id); if(!g)return; for(let k=0;k<g.n;k++) out.push({id,g,label:g.short+(g.n>1?(k+1):''),L:g.L,W:g.W}); }); return out; }
function evalPlan(plan,ctx){
  const rects=expandRects(plan.items); const area=rects.reduce((a,r)=>a+r.L*r.W,0);
  if(!rects.length) return {plan,rects,status:'na',txt:'No graft ticked',area:0,share:0,placed:[]};
  if(ctx.mode==='manual'){
    let status='ok',txt='Feasible';
    if(area>ctx.avail){status='bad';txt='Insufficient';}
    else if(ctx.len&&ctx.wid){ const bad=rects.some(r=>!(Math.max(ctx.len,ctx.wid)>=Math.max(r.L,r.W)&&Math.min(ctx.len,ctx.wid)>=Math.min(r.L,r.W))); if(bad){status='bad';txt='Insufficient';} }
    else {status='na';txt='Area enough, shape not checked';}
    return {plan,rects,status,txt,area,share:area/ctx.avail,placed:[]};
  }
  const m=1+S.margin/100;
  const r0=packRects(ctx.mask,rects);
  let r1=null; if(r0.ok) r1=S.margin>0?packRects(ctx.mask,rects.map(r=>({...r,L:r.L*m,W:r.W*m}))):r0;
  const status=!r0.ok?'bad':(r1&&r1.ok?'ok':'mid'); const txt={bad:'Insufficient',mid:'Borderline',ok:'Feasible'}[status];
  const use=(r1&&r1.ok)?r1:r0;
  return {plan,rects,status,txt,area,share:area/ctx.avail,r0,r1,placed:use.placed.map(p=>({...p,label:rects[p.k].label,L:rects[p.k].L,W:rects[p.k].W,id:rects[p.k].id})),alone:r0.alone};
}
let planT=0; function schedulePlan(){ clearTimeout(planT); planT=setTimeout(renderPlanning,120); }
function renderPlanning(){
  $('srcTraceMsg').textContent=S.an?`Using the traced outline: ${f0(S.an.harv)} mm² harvestable.`:'No traced outline yet. Close the outline and place K, ASA and ANS in the Patient tab, or use manual entry.';
  const ctx=planCtx(); const thead=$('planTable').querySelector('thead'),tb=$('planTable').querySelector('tbody');
  thead.innerHTML='<tr><th></th><th>Plan</th>'+S.grafts.map(g=>`<th title="${g.name}">${g.short}</th>`).join('')+'<th>Result</th><th>Used</th></tr>';
  S.evals=ctx?S.plans.map(pl=>evalPlan(pl,ctx)):[];
  tb.innerHTML='';
  S.plans.forEach((pl,pi)=>{ const ev=S.evals[pi],tr=document.createElement('tr');
    tr.innerHTML=`<td><input type="radio" name="planSel" value="${pl.id}" ${S.planSel===pl.id?'checked':''} aria-label="Show ${pl.name}"></td><td>${pl.name}</td>`+S.grafts.map(g=>`<td><input type="checkbox" data-g="${g.id}" ${pl.items.includes(g.id)?'checked':''} aria-label="${g.name} in ${pl.name}"></td>`).join('')+`<td>${ev?`<span class="chip ${ev.status==='na'?'na':ev.status}">${ev.txt}</span>`:'<span class="chip na">no data</span>'}</td><td>${ev&&ev.area?f0(100*ev.share)+'%':''}</td>`;
    tr.querySelector('input[type=radio]').onchange=()=>{S.planSel=pl.id;renderPlanning();requestDraw();updateOverlays3D();};
    tr.querySelectorAll('input[data-g]').forEach(cb=>cb.onchange=()=>{ const id=cb.dataset.g; pl.items=pl.items.filter(x=>x!==id); if(cb.checked)pl.items.push(id); renderPlanning(); });
    tb.appendChild(tr); });
  const sel=S.evals.find(e=>e.plan.id===S.planSel)||null; S.sel=sel&&sel.placed&&sel.placed.length?sel:null;
  /* suggestion */
  const sg=$('suggest'); if(!ctx){ sg.innerHTML='<p class="note">Trace the outline (or let the app suggest it in the Patient tab) to compare plans.</p>'; $('verdict').innerHTML='<p class="note">No cartilage data yet.</p>'; renderChart(null); requestDraw(); updateOverlays3D(); return; }
  const ok=S.evals.filter(e=>e.status==='ok'),mid=S.evals.filter(e=>e.status==='mid');
  const rank=a=>a.slice().sort((x,y)=>(y.rects.length-x.rects.length)||(x.share-y.share));
  let h='';
  if(ok.length){ const b=rank(ok)[0]; h=`<p class="ink"><b>Suggested: ${b.plan.name}.</b> Every graft fits with the ${S.margin}% margin and uses ${f0(100*b.share)}% of the harvestable cartilage.</p><p class="note">Rule: among plans that fit, the one with the most grafts, then the least cartilage used. This is decision support only; the surgeon decides.</p>`; }
  else if(mid.length){ const b=rank(mid)[0]; h=`<p class="ink"><b>Closest: ${b.plan.name}.</b> It fits at the listed sizes but not with the ${S.margin}% margin, so there is little room for error.</p>`; }
  else { const sc=S.evals.filter(e=>e.rects.length).map(e=>({e,n:e.placed.length/e.rects.length})).sort((a,b)=>b.n-a.n)[0]; h=`<p class="ink"><b>No listed plan fits completely.</b>${sc?` Closest: ${sc.e.plan.name}, which places ${sc.e.placed.length} of ${sc.e.rects.length} grafts.`:''}</p>`; }
  sg.innerHTML=h;
  /* detail of the selected plan */
  let d=''; if(sel){
    d=`<div class="row"><span class="chip ${sel.status==='na'?'na':sel.status}">${sel.txt}</span><span class="note">${sel.plan.name}: needs ${f0(sel.area)} mm² of ${f0(ctx.avail)} mm² harvestable</span></div>`;
    if(ctx.mode==='trace'&&sel.r0){
      d+='<table><tbody>'; sel.rects.forEach((r,i)=>{ const pl=sel.placed.find(p=>p.k===i); d+=`<tr><td>${r.label}</td><td>${r.g.name}</td><td>${r.L} × ${r.W} mm</td><td>${pl?'placed':'<span class="chip bad">no room</span>'}</td></tr>`; }); d+='</tbody></table>';
      if(sel.status==='bad'){ const miss=sel.rects.findIndex((r,i)=>!sel.placed.some(p=>p.k===i)); const r=sel.rects[miss>=0?miss:0]; const mf=maxFit(ctx.mask,r.L,r.W); d+=`<p class="note"><b>What limits it:</b> ${r.g.name.toLowerCase()} ${r.L} × ${r.W} mm${sel.alone&&sel.alone[sel.rects.indexOf(r)]===false?' does not fit even alone':' does not fit together with the others'}. In this region a graft ${r.W} mm wide can be at most about ${mf.maxL?mf.maxL+' mm long':'under 3 mm long'}, and one ${r.L} mm long at most about ${mf.maxW?mf.maxW+' mm wide':'1 mm wide'}.</p>`; }
    }
  } else d='<p class="note">Select a plan.</p>';
  if(S.contact!==''){ const c=+S.contact; d+= c<45?`<div class="warn">Crest contact ${c}% is under about 45%, where collapse risk rises sharply [1].</div>`:`<p class="note">Crest contact ${c}% is above the ~45% collapse threshold [1].</p>`; }
  if(!ok.length){ d+=`<p class="ink" style="margin-top:8px"><b>If septal cartilage falls short</b></p><p class="note">Composite bony-cartilaginous unit: about 2.21 times the cartilage alone in the n=116 series, or roughly ${f0(ctx.avail*2.21)} mm² here. That is a population ratio, not a measurement of this patient. Check the skull-base margins on the plane (reference means: 48.9 mm to the cribriform plate, 54.3 mm to the anterior sphenoid wall [16]).</p><p class="note">Costal cartilage: donor-site complications under 3% and recipient-site warping about 5% in the systematic review [25,26].</p>`; }
  $('verdict').innerHTML=d; renderChart(ctx.avail); requestDraw(); updateOverlays3D(); if(S.sm) rebuildSeptMesh();
}
function buildGraftTable(){
  const tb=$('gTable').querySelector('tbody'); tb.innerHTML='';
  S.grafts.forEach(g=>{ const tr=document.createElement('tr');
    tr.innerHTML=`<td>${g.name}</td><td><input type="number" min="1" max="4" value="${g.n}" aria-label="Count"></td><td><input type="number" min="1" step="0.5" value="${g.L}" aria-label="Length"></td><td><input type="number" min="1" step="0.5" value="${g.W}" aria-label="Width"></td>`;
    const ins=tr.querySelectorAll('input');
    ins[0].oninput=()=>{g.n=Math.max(1,Math.min(4,+ins[0].value||1));schedulePlan();}; ins[1].oninput=()=>{g.L=+ins[1].value||1;schedulePlan();}; ins[2].oninput=()=>{g.W=+ins[2].value||1;schedulePlan();};
    tb.appendChild(tr); });
}