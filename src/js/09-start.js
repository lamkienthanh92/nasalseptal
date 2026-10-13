

/* ---------------- start ---------------- */
function boot(){
  if(typeof THREE==='undefined'||typeof JSZip==='undefined'){ toast('A required library did not load. Check your connection and reload.'); }
  init3D(); bind(); setTab('teach'); drawMinis(); requestDraw(); renderPlanning();
}
boot();
window.__api={getSM:()=>S.sm,computeSeptum,alignPlane,suggestOutline,outlineStats,robustFit};
