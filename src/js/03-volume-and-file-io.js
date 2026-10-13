

/* ---------------- volume ---------------- */
function sampleVol(v,x,y,z){
  const fx=(x-v.ox)/v.sx,fy=(y-v.oy)/v.sy,fz=(z-v.oz)/v.sz;
  if(fx<0||fy<0||fz<0||fx>v.nx-1||fy>v.ny-1||fz>v.nz-1) return -1024;
  let i=fx|0,j=fy|0,k=fz|0; if(i>=v.nx-1)i=v.nx-2; if(j>=v.ny-1)j=v.ny-2; if(k>=v.nz-1)k=v.nz-2; if(i<0)i=0; if(j<0)j=0; if(k<0)k=0;
  const tx=fx-i,ty=fy-j,tz=fz-k,d=v.data,nx=v.nx,sl=v.nx*v.ny,b=i+nx*j+sl*k;
  const c00=d[b]*(1-tx)+d[b+1]*tx, c10=d[b+nx]*(1-tx)+d[b+nx+1]*tx, c01=d[b+sl]*(1-tx)+d[b+sl+1]*tx, c11=d[b+nx+sl]*(1-tx)+d[b+nx+sl+1]*tx;
  return (c00*(1-ty)+c10*ty)*(1-tz)+(c01*(1-ty)+c11*ty)*tz;
}

/* ---------------- DICOM ---------------- */
const DT={0x0020000E:'UI',0x00200013:'IS',0x00200032:'DS',0x00200037:'DS',0x00280010:'US',0x00280011:'US',0x00280030:'DS',0x00180050:'DS',0x00280100:'US',0x00280101:'US',0x00280103:'US',0x00281052:'DS',0x00281053:'DS',0x0008103E:'LO',0x00080060:'CS',0x00020010:'UI'};
const LONGVR=/^(OB|OW|OF|SQ|UT|UN|OD|OL|UC|UR|SV|UV)$/;
function parseDicom(buf){
  const dv=new DataView(buf),n=buf.byteLength; let p=0;
  if(n>132&&dv.getUint32(128,false)===0x4449434D) p=132;
  else if(!(n>8&&(dv.getUint16(0,true)===8||dv.getUint16(0,true)===2))) return null;
  let expl=true; const T={}; let px=null;
  const hdr=q=>{
    const g=dv.getUint16(q,true),e=dv.getUint16(q+2,true),tag=((g<<16)|e)>>>0;
    if(g===0xFFFE) return {tag,vr:'',len:dv.getUint32(q+4,true),h:8};
    if(expl||g===2){ const vr=String.fromCharCode(dv.getUint8(q+4),dv.getUint8(q+5)); if(LONGVR.test(vr)) return {tag,vr,len:dv.getUint32(q+8,true),h:12}; return {tag,vr,len:dv.getUint16(q+6,true),h:8}; }
    return {tag,vr:'',len:dv.getUint32(q+4,true),h:8};
  };
  const skipSeq=(q,len)=>{
    if(len!==0xFFFFFFFF) return q+len;
    while(q+8<=n){ const h=hdr(q);
      if(h.tag===0xFFFEE0DD) return q+8;
      if(h.tag!==0xFFFEE000) return q;
      q+=8;
      if(h.len!==0xFFFFFFFF){ q+=h.len; continue; }
      while(q+8<=n){ const e=hdr(q); if(e.tag===0xFFFEE00D){q+=8;break;} q+=e.h; q=(e.vr==='SQ'||e.len===0xFFFFFFFF)?skipSeq(q,e.len):q+e.len; }
    }
    return q;
  };
  const str=(q,l)=>{ let s=''; for(let i=0;i<l;i++){const c=dv.getUint8(q+i); if(c)s+=String.fromCharCode(c);} return s.trim(); };
  while(p+8<=n){
    const h=hdr(p); if(h.tag===0x7FE00010){ px={off:p+h.h,len:h.len}; break; }
    const vp=p+h.h;
    if(h.len===0xFFFFFFFF||h.vr==='SQ'){ p=skipSeq(vp,h.len); continue; }
    const t=DT[h.tag];
    if(t){ if(t==='US') T[h.tag]=dv.getUint16(vp,true); else { const s=str(vp,h.len); T[h.tag]=(t==='DS'||t==='IS')?s.split('\\').map(parseFloat):s; } }
    if(h.tag===0x00020010) expl=(T[0x00020010]!=='1.2.840.10008.1.2');
    p=vp+h.len;
  }
  if(!px||T[0x00280010]==null) return null;
  T.px=px; return T;
}
function seriesToVolume(items){
  const T0=items[0].T; const ts=T0[0x00020010]||'1.2.840.10008.1.2.1';
  if(ts!=='1.2.840.10008.1.2'&&ts!=='1.2.840.10008.1.2.1') throw new Error('Compressed DICOM ('+ts+') is not supported. Export uncompressed DICOM or NRRD.');
  if(items.length<8) throw new Error('This series has only '+items.length+' images, too few for a reformat.');
  const iop=T0[0x00200037]; if(!iop||iop.length<6) throw new Error('Missing image orientation.');
  const rd=iop.slice(0,3),cd=iop.slice(3,6);
  if(Math.abs(rd[0])<0.98||Math.abs(cd[1])<0.98) throw new Error('Only axial scans aligned to the scanner axes are read. Reformat the scan to axial first.');
  items.forEach(it=>{ if(!it.T[0x00200032]) throw new Error('Missing image position.'); });
  items.sort((a,b)=>a.T[0x00200032][2]-b.T[0x00200032][2]);
  const nx=T0[0x00280011],ny=T0[0x00280010],nz=items.length;
  const ps=T0[0x00280030]||[1,1]; const sy=ps[0],sx=ps[1];
  const zs=items.map(i=>i.T[0x00200032][2]); const dz=[]; for(let i=1;i<nz;i++)dz.push(zs[i]-zs[i-1]); dz.sort((a,b)=>a-b); const sz=dz[dz.length>>1]||1;
  const warns=[]; if(dz[dz.length-1]-dz[0]>0.05*sz) warns.push('Slice spacing is uneven; the reformat assumes '+f1(sz)+' mm.');
  if(sz>2) warns.push('Slice spacing is '+f1(sz)+' mm. Thin cartilage will look coarse; 1 mm or thinner is better.');
  const flipX=rd[0]<0,flipY=cd[1]<0,p0=items[0].T[0x00200032];
  const ox=flipX?p0[0]-(nx-1)*sx:p0[0], oy=flipY?p0[1]-(ny-1)*sy:p0[1], oz=zs[0];
  const data=new Int16Array(nx*ny*nz);
  items.forEach((it,k)=>{
    const T=it.T,bits=T[0x00280100]||16; if(bits!==16) throw new Error('Only 16-bit images are read.');
    const signed=T[0x00280103]===1, sl=(T[0x00281053]||[1])[0], ic=(T[0x00281052]||[0])[0];
    const src=signed?new Int16Array(it.buf.slice(T.px.off,T.px.off+nx*ny*2)):new Uint16Array(it.buf.slice(T.px.off,T.px.off+nx*ny*2));
    for(let j=0;j<ny;j++){ const jj=flipY?ny-1-j:j; for(let i=0;i<nx;i++){ const ii=flipX?nx-1-i:i; let v=src[j*nx+i]*sl+ic; if(v>32000)v=32000; if(v<-32000)v=-32000; data[ii+nx*(jj+ny*k)]=v; } }
  });
  return {data,nx,ny,nz,sx,sy,sz,ox,oy,oz,warns};
}

/* ---------------- NRRD ---------------- */
async function parseNrrd(buf){
  const u8=new Uint8Array(buf); let e=0; while(e<u8.length-1&&!(u8[e]===10&&u8[e+1]===10)) e++;
  if(e>=u8.length-1) throw new Error('Not a readable NRRD file.');
  const head=new TextDecoder().decode(u8.subarray(0,e)).split(/\r?\n/);
  if(!/^NRRD/.test(head[0])) throw new Error('Not a NRRD file.');
  const h={}; head.slice(1).forEach(l=>{ if(l.startsWith('#'))return; const m=l.match(/^([^:=]+?)\s*:\s*=?\s*(.*)$/); if(m) h[m[1].trim().toLowerCase()]=m[2].trim(); });
  if(h['data file']||h['datafile']) throw new Error('Detached NRRD (.nhdr) is not supported. Use a single .nrrd file.');
  const dim=+h.dimension; if(dim!==3) throw new Error('Only 3D NRRD volumes are read.');
  const sizes=h.sizes.split(/\s+/).map(Number); const [nx,ny,nz]=sizes;
  const tp=(h.type||'').toLowerCase().replace(/\s+/g,' ');
  const TY={'short':Int16Array,'int16':Int16Array,'signed short':Int16Array,'int16_t':Int16Array,'signed short int':Int16Array,'ushort':Uint16Array,'uint16':Uint16Array,'unsigned short':Uint16Array,'uint16_t':Uint16Array,'unsigned short int':Uint16Array,'uchar':Uint8Array,'uint8':Uint8Array,'unsigned char':Uint8Array,'uint8_t':Uint8Array,'int8':Int8Array,'signed char':Int8Array,'int':Int32Array,'int32':Int32Array,'signed int':Int32Array,'float':Float32Array,'double':Float64Array};
  const Ty=TY[tp]; if(!Ty) throw new Error('Unsupported NRRD data type: '+h.type);
  let raw=buf.slice(e+2); const enc=(h.encoding||'raw').toLowerCase();
  if(enc==='gzip'||enc==='gz'){ const ds=new DecompressionStream('gzip'); raw=await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer(); }
  else if(enc!=='raw') throw new Error('Unsupported NRRD encoding: '+h.encoding);
  let arr=new Ty(raw.byteLength>=nx*ny*nz*Ty.BYTES_PER_ELEMENT?raw.slice(0,nx*ny*nz*Ty.BYTES_PER_ELEMENT):raw);
  if((h.endian||'little')==='big'&&Ty.BYTES_PER_ELEMENT>1){ const dv=new DataView(arr.buffer); const sw=new Ty(arr.length); const m={2:'Int16',4:'Int32'}; for(let i=0;i<arr.length;i++){ sw[i]=Ty===Int16Array?dv.getInt16(i*2,false):Ty===Uint16Array?dv.getUint16(i*2,false):Ty===Int32Array?dv.getInt32(i*4,false):Ty===Float32Array?dv.getFloat32(i*4,false):dv.getFloat64(i*8,false);} arr=sw; }
  const vec=s=>(s.match(/\(([^)]*)\)/g)||[]).map(t=>t.slice(1,-1).split(',').map(Number));
  let dirs=vec(h['space directions']||''); let org=vec(h['space origin']||'')[0]||[0,0,0];
  if(dirs.length!==3){ const sp=(h.spacings||'1 1 1').split(/\s+/).map(Number); dirs=[[sp[0],0,0],[0,sp[1],0],[0,0,sp[2]]]; }
  const space=(h.space||'left-posterior-superior').toLowerCase();
  let fx=1,fy=1; if(/right-anterior|^ras$/.test(space)){fx=-1;fy=-1;} else if(/left-anterior|^las$/.test(space)){fy=-1;}
  dirs=dirs.map(d=>[d[0]*fx,d[1]*fy,d[2]]); org=[org[0]*fx,org[1]*fy,org[2]];
  const sp=[],sg=[];
  for(let a=0;a<3;a++){ let m=0; for(let c=1;c<3;c++) if(Math.abs(dirs[a][c])>Math.abs(dirs[a][m])) m=c;
    if(m!==a||Math.hypot(...dirs[a])-Math.abs(dirs[a][a])>0.02*Math.hypot(...dirs[a])) throw new Error('Only axial volumes aligned to the scanner axes are read.');
    sp[a]=Math.abs(dirs[a][a]); sg[a]=Math.sign(dirs[a][a]); }
  const data=new Int16Array(nx*ny*nz); for(let i=0;i<data.length;i++){ let v=arr[i]; data[i]=v>32000?32000:v<-32000?-32000:v; }
  const o=[org[0]-(sg[0]<0?(nx-1)*sp[0]:0),org[1]-(sg[1]<0?(ny-1)*sp[1]:0),org[2]-(sg[2]<0?(nz-1)*sp[2]:0)];
  let out=data;
  if(sg[0]<0||sg[1]<0||sg[2]<0){ out=new Int16Array(data.length); for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){ const ii=sg[0]<0?nx-1-i:i,jj=sg[1]<0?ny-1-j:j,kk=sg[2]<0?nz-1-k:k; out[ii+nx*(jj+ny*kk)]=data[i+nx*(j+ny*k)]; } }
  const warns=[]; if(sp[2]>2) warns.push('Slice spacing is '+f1(sp[2])+' mm. Thin cartilage will look coarse.');
  return {data:out,nx,ny,nz,sx:sp[0],sy:sp[1],sz:sp[2],ox:o[0],oy:o[1],oz:o[2],warns};
}

/* ---------------- file intake ---------------- */
async function handleFiles(files){
  busy('Reading files…'); await tick();
  try{
    S.catalog=[]; const dcm=[]; let ndcmFail=0;
    for(const f of files){
      const low=f.name.toLowerCase();
      if(low.endsWith('.zip')){
        const z=await JSZip.loadAsync(f);
        const names=Object.keys(z.files).filter(n=>!z.files[n].dir&&!/__MACOSX|\.DS_Store/.test(n));
        for(const n of names){
          if(/\.nrrd$/i.test(n)){ if(/label|_seg/i.test(n)) continue; S.catalog.push({label:n.split('/').pop(),load:async()=>parseNrrd(await z.files[n].async('arraybuffer'))}); }
          else if(!/\.(txt|md|json|csv|xml|pdf|jpg|png)$/i.test(n)){ const b=await z.files[n].async('arraybuffer'); const T=parseDicomSafe(b); if(T) dcm.push({T,buf:b}); else ndcmFail++; }
        }
      } else if(/\.nrrd$/i.test(low)){ S.catalog.push({label:f.name,load:async()=>parseNrrd(await f.arrayBuffer())}); }
      else { const b=await f.arrayBuffer(); const T=parseDicomSafe(b); if(T) dcm.push({T,buf:b}); else ndcmFail++; }
    }
    if(dcm.length){
      const g={}; dcm.forEach(d=>{ const k=d.T[0x0020000E]||'series'; (g[k]=g[k]||[]).push(d); });
      Object.values(g).sort((a,b)=>b.length-a.length).forEach(items=>{
        const T=items[0].T; const th=T[0x00180050]?f1(T[0x00180050][0])+' mm':'?';
        S.catalog.push({label:(T[0x0008103E]||'Series')+' · '+items.length+' images · '+th,load:async()=>seriesToVolume(items)});
      });
    }
    if(!S.catalog.length) throw new Error('No readable CT found. Supported: uncompressed DICOM and NRRD, loose or in a ZIP.');
    const sel=$('ser'); sel.innerHTML=''; S.catalog.forEach((c,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=c.label; sel.appendChild(o); });
    $('serRow').hidden=S.catalog.length<2;
    await loadCatalog(0);
  }catch(err){ busy(); toast(err.message||String(err)); $('volWarn').innerHTML='<div class="warn">'+(err.message||err)+'</div>'; return; }
  busy();
}
function parseDicomSafe(b){ try{ return parseDicom(b); }catch(e){ return null; } }
async function loadCatalog(i){
  busy('Loading volume…'); await tick();
  try{ const v=await S.catalog[i].load(); await setVolume(v,S.catalog[i].label); }
  catch(err){ busy(); toast(err.message||String(err)); $('volWarn').innerHTML='<div class="warn">'+(err.message||err)+'</div>'; return; }
  busy();
}

/* ---------------- volume setup + midplane ---------------- */
async function setVolume(v,name){
  S.vol=v; v.name=name;
  S.pts=[];S.closed=false;S.lm={K:null,ASA:null,ANS:null};S.ruler=[];S.snap=null;S.an=null;S.sm=null;S.annos=[];S.pending=[];
  const ext=[v.nx*v.sx,v.ny*v.sy,v.nz*v.sz];
  $('volKv').innerHTML=`<span>Matrix</span><span>${v.nx} × ${v.ny} × ${v.nz}</span><span>Voxel</span><span>${v.sx.toFixed(2)} × ${v.sy.toFixed(2)} × ${v.sz.toFixed(2)} mm</span><span>Extent</span><span>${f0(ext[0])} × ${f0(ext[1])} × ${f0(ext[2])} mm</span>`;
  $('volWarn').innerHTML=(v.warns||[]).map(w=>`<div class="warn">${w}</div>`).join('');
  busy('Finding midsagittal plane…'); await tick();
  autoPlane();
  busy('Building 3D surface…'); await tick();
  buildBone();
  setTab(S.tab==='teach'?'patient':S.tab); syncUI();
  fitCamera(); dirtyImg=true; draw2D(); drawMinis(); updateResults(); updateOverlays3D();
}
function autoPlane(){
  const v=S.vol; if(!v) return;
  const st=[Math.max(1,Math.round(2.5/v.sx)),Math.max(1,Math.round(2.5/v.sy)),Math.max(1,Math.round(2.5/v.sz))];
  let pts=[]; const thr=-300;
  for(let k=0;k<v.nz;k+=st[2])for(let j=0;j<v.ny;j+=st[1])for(let i=0;i<v.nx;i+=st[0]) if(v.data[i+v.nx*(j+v.ny*k)]>thr) pts.push([v.ox+i*v.sx,v.oy+j*v.sy,v.oz+k*v.sz]);
  if(pts.length>30000){ const m=Math.ceil(pts.length/30000); pts=pts.filter((_,i)=>i%m===0); }
  if(pts.length<50){ toast('Too little tissue in this scan to find a plane.'); return; }
  let cx=0,cy=0,cz=0; pts.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];}); cx/=pts.length;cy/=pts.length;cz/=pts.length;
  const score=(x0,yaw)=>{
    const a=yaw*D2R,nx=Math.cos(a),ny=Math.sin(a); let hit=0;
    for(let q=0;q<pts.length;q++){ const p=pts[q]; const d=(p[0]-x0)*nx+(p[1]-cy)*ny; const x=p[0]-2*d*nx,y=p[1]-2*d*ny,z=p[2];
      const i=Math.round((x-v.ox)/v.sx),j=Math.round((y-v.oy)/v.sy),k=Math.round((z-v.oz)/v.sz);
      if(i>=0&&j>=0&&k>=0&&i<v.nx&&j<v.ny&&k<v.nz&&v.data[i+v.nx*(j+v.ny*k)]>thr) hit++; }
    return hit/pts.length;
  };
  let best={s:-1,x:cx,yaw:0};
  for(let yaw=-15;yaw<=15.01;yaw+=1.5)for(let x=cx-25;x<=cx+25.01;x+=1){ const s=score(x,yaw); if(s>best.s) best={s,x,yaw}; }
  const c0=best; for(let yaw=c0.yaw-1.5;yaw<=c0.yaw+1.51;yaw+=0.25)for(let x=c0.x-1;x<=c0.x+1.01;x+=0.25){ const s=score(x,yaw); if(s>best.s) best={s,x,yaw}; }
  S.plane.x0=best.x; S.plane.x0auto=best.x; S.plane.yc=cy; S.plane.zc=cz; S.plane.yaw=best.yaw; S.plane.roll=0;
  /* anterior-most tissue near the plane = nasal tip, used to centre the view */
  let ymin=1e9,zt=cz; const n=[Math.cos(best.yaw*D2R),Math.sin(best.yaw*D2R)];
  for(let k=0;k<v.nz;k++)for(let j=0;j<v.ny;j++){ const y=v.oy+j*v.sy; const x=best.x-(n[1]/n[0])*(y-cy); const i=Math.round((x-v.ox)/v.sx); if(i<0||i>=v.nx)continue; if(v.data[i+v.nx*(j+v.ny*k)]>thr){ if(y<ymin){ymin=y;zt=v.oz+k*v.sz;} break; } }
  const B=basis(); const ey=v.ny*v.sy,ez=v.nz*v.sz; const sw=Math.max(200,cssW()),sh=Math.max(200,cssH());
  if(ey<=170&&ez<=140){ /* cropped scan: fit the whole sagittal section */
    const ctr=[best.x-(n[1]/n[0])*(v.oy+ey/2-cy),v.oy+ey/2,v.oz+ez/2]; const uv=toUV(ctr,B); S.view.uc=uv[0]; S.view.vc=uv[1];
    S.view.s=Math.min(sw/ey,sh/ez)*0.94;
  } else { /* whole head: centre on the nasal region */
    const tgt=[best.x-(n[1]/n[0])*(ymin+32-cy),ymin+32,zt+2]; const uv=toUV(tgt,B); S.view.uc=uv[0]; S.view.vc=uv[1];
    S.view.s=sh/110;
  }
  $('pShift').value=0; $('pYaw').value=best.yaw.toFixed(1); $('pRoll').value=0; syncPlaneOut();
  dirtyImg=true;
}
function syncPlaneOut(){
  $('pShiftO').textContent=f1(S.plane.x0-S.plane.x0auto)+' mm'; $('pYawO').textContent=f1(S.plane.yaw)+'°'; $('pRollO').textContent=f1(S.plane.roll)+'°';
}