const $=id=>document.getElementById(id);
const D2R=Math.PI/180;
const f1=x=>(Math.round(x*10)/10).toFixed(1);
const f0=x=>String(Math.round(x));

/* ---------------- state ---------------- */
const S={
  vol:null, tab:'teach', tool:'pan', lmSel:'K',
  plane:{x0:0,yc:0,zc:0,yaw:0,roll:0,x0auto:0},
  view:{uc:0,vc:0,s:6},
  win:{l:150,w:800}, slab:0,
  pts:[], closed:false, lm:{K:null,ASA:null,ANS:null}, ruler:[],
  snap:null, an:null,
  strutW:10, margin:10, pack:70, contact:'', src:'trace', manual:{area:'',len:'',wid:''},
  grafts:[
    {id:'spr',name:'Spreader grafts',short:'SP',n:2,L:25,W:3},
    {id:'col',name:'Columellar strut',short:'CS',n:1,L:15,W:4},
    {id:'seg',name:'Septal extension graft',short:'SE',n:1,L:25,W:8},
    {id:'tym',name:'Tympanoplasty graft',short:'TY',n:1,L:10,W:10}
  ],
  plans:[
    {id:'A',name:'Spreaders',items:['spr']},
    {id:'B',name:'Columellar strut',items:['col']},
    {id:'C',name:'Spreaders + columellar',items:['spr','col']},
    {id:'D',name:'Septal extension',items:['seg']},
    {id:'E',name:'Spreaders + septal extension',items:['spr','seg']}
  ],
  planSel:'C', sel:null, evals:[],
  bw:false, ly3:{bone:true,sept:true,plan:true}, sm:null, annos:[], pending:[], boneHU:300, cut:false, showPlane:true, ly:{cart:true,bone:true,strut:true,harv:true},
  catalog:[]
};
window.__S=S;

/* ---------------- ui helpers ---------------- */
function busy(msg){ if(msg){$('busyMsg').textContent=msg;$('busy').classList.add('on');} else $('busy').classList.remove('on'); }
const tick=()=>new Promise(r=>setTimeout(r,30));
let toastT=0;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(toastT); toastT=setTimeout(()=>t.style.display='none',3800); }