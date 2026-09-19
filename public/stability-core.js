(function(root){
  'use strict';
  function riverDelta(series){
    const points=(series||[]).filter(p=>p.v!==null&&p.v!==''&&Number.isFinite(Number(p.v))&&Number.isFinite(Date.parse(p.t)))
      .map(p=>({t:Date.parse(p.t),v:Number(p.v)})).sort((a,b)=>a.t-b.t);
    const last=points.at(-1);
    if(!last)return null;
    const candidates=points.filter(p=>{const minutes=(last.t-p.t)/60000;return minutes>=45&&minutes<=75;});
    candidates.sort((a,b)=>Math.abs(last.t-a.t-3600000)-Math.abs(last.t-b.t-3600000));
    const ref=candidates[0];
    return ref?{value:last.v-ref.v,minutes:Math.round((last.t-ref.t)/60000)}:null;
  }
  const api={riverDelta};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.MonitoraCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);

