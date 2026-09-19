/* v5.1.0: extracted without changing the shared application state contract. */
let riverRefreshTimer=null;

function riverTrendLabel(value){
  return value==="rising"?"↑ Subindo":value==="falling"?"↓ Baixando":value==="stable"?"→ Estável":"Tendência indisponível";
}
function riverStatusLabel(value){
  return value==="normal"?"NORMAL":value==="attention"?"ATENÇÃO":value==="alert"?"ALERTA":value==="critical"?"CRÍTICO":"SEM COTA OFICIAL";
}
function riverFreshnessText(latest){
  if(!latest)return "Nenhuma medição armazenada.";
  const measured=Date.parse(latest.measured_at);
  if(!Number.isFinite(measured))return "Horário da medição indisponível.";
  const mins=Math.max(0,Math.floor((Date.now()-measured)/60000));
  if(mins<1)return "Última medição da estação: agora.";
  if(mins<60)return `Última medição da estação: há ${mins} min.`;
  const h=Math.floor(mins/60), m=mins%60;
  return `Última medição da estação: há ${h}h${m?` ${m}min`:""}.`;
}
function formatRiverDelta(delta){
  if(delta===null || delta===undefined || !Number.isFinite(Number(delta)))return "—";
  const cm=Math.round(Number(delta)*100);
  return `${cm>0?"+":""}${cm} cm`;
}
function formatRiverTime(iso){
  if(!iso)return "—";
  try{
    return new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",timeZone:"America/Sao_Paulo"}).format(new Date(iso));
  }catch(_){return "—";}
}

let riverWindowHours=24;
let riverChartView=null;

function riverPeriodText(hours){
  if(hours===1)return "Última hora";
  if(hours===3)return "Últimas 3 horas";
  if(hours===6)return "Últimas 6 horas";
  if(hours===12)return "Últimas 12 horas";
  if(hours===24)return "Últimas 24 horas";
  return "Últimos 7 dias";
}
function formatRiverAxisTime(iso,hours){
  const d=new Date(iso);
  if(!Number.isFinite(d.getTime()))return "";
  const opt=hours>=168
    ?{day:"2-digit",month:"2-digit",timeZone:"America/Sao_Paulo"}
    :{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"};
  return new Intl.DateTimeFormat("pt-BR",opt).format(d);
}
function formatRiverTooltipTime(iso){
  try{
    return new Intl.DateTimeFormat("pt-BR",{
      day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",
      timeZone:"America/Sao_Paulo"
    }).format(new Date(iso));
  }catch(_){return "—";}
}
function filterRiverSeries(series,hours){
  const clean=(Array.isArray(series)?series:[])
    .map(x=>({t:x?.t,v:Number(x?.v)}))
    .filter(x=>Number.isFinite(x.v)&&Number.isFinite(new Date(x.t).getTime()))
    .sort((a,b)=>new Date(a.t)-new Date(b.t));
  if(!clean.length)return [];
  const end=new Date(clean[clean.length-1].t).getTime();
  const start=end-hours*60*60*1000;
  return clean.filter(x=>new Date(x.t).getTime()>=start);
}
function niceRiverBounds(values){
  const rawMin=Math.min(...values),rawMax=Math.max(...values);
  let span=rawMax-rawMin;
  if(span<0.04)span=0.04;
  const margin=Math.max(0.015,span*.14);
  const min=Math.max(0,rawMin-margin);
  const max=rawMax+margin;
  return {min,max,span:max-min};
}
function updateRiverPeriodMetrics(pts,hours){
  const label=$("#riverPeriodLabel");
  if(label)label.textContent=riverPeriodText(hours);

  const deltaEl=$("#riverMetricDelta"),maxEl=$("#riverMetricMax"),minEl=$("#riverMetricMin");
  if(!pts.length){
    if(deltaEl)deltaEl.textContent="—";
    if(maxEl)maxEl.textContent="—";
    if(minEl)minEl.textContent="—";
    return;
  }
  const vals=pts.map(x=>x.v);
  const delta=pts.length>1?vals[vals.length-1]-vals[0]:null;
  if(deltaEl)deltaEl.textContent=delta===null?"—":formatRiverDelta(delta);
  if(maxEl)maxEl.textContent=`${Math.max(...vals).toFixed(2).replace(".",",")} m`;
  if(minEl)minEl.textContent=`${Math.min(...vals).toFixed(2).replace(".",",")} m`;
}
function renderRiverChart(series=[]){
  const host=$("#riverChart");if(!host)return;

  const pts=filterRiverSeries(series,riverWindowHours);
  updateRiverPeriodMetrics(pts,riverWindowHours);

  $$("#riverWindowChips [data-river-window]").forEach(btn=>{
    const active=Number(btn.dataset.riverWindow)===riverWindowHours;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-pressed",String(active));
  });

  if(pts.length<2){
    riverChartView=null;
    host.innerHTML='<div class="river-chart-empty">Ainda não há medições suficientes neste período.</div>';
    return;
  }

  const vals=pts.map(x=>x.v);
  const {min,max,span}=niceRiverBounds(vals);
  const width=720,height=235;
  const pad={l:52,r:20,t:18,b:34};
  const plotW=width-pad.l-pad.r,plotH=height-pad.t-pad.b;

  const xy=pts.map((x,i)=>{
    const px=pad.l+(i/(pts.length-1))*plotW;
    const py=pad.t+((max-x.v)/span)*plotH;
    return {...x,x:px,y:py};
  });

  const coords=xy.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area=`${pad.l},${height-pad.b} ${coords} ${width-pad.r},${height-pad.b}`;

  const yTicks=Array.from({length:4},(_,i)=>{
    const value=max-(span*(i/3));
    const y=pad.t+plotH*(i/3);
    return {value,y};
  });

  const tickCount=Math.min(5,pts.length);
  const idxs=[...new Set(Array.from({length:tickCount},(_,i)=>
    Math.round(i*(pts.length-1)/(tickCount-1))
  ))];

  const yGrid=yTicks.map(t=>`
    <line x1="${pad.l}" y1="${t.y.toFixed(1)}" x2="${width-pad.r}" y2="${t.y.toFixed(1)}" class="river-grid-line"/>
    <text x="${pad.l-9}" y="${(t.y+3).toFixed(1)}" text-anchor="end" class="river-axis-label">${t.value.toFixed(2).replace(".",",")} m</text>
  `).join("");

  const xLabels=idxs.map(i=>{
    const p=xy[i];
    return `<text x="${p.x.toFixed(1)}" y="${height-10}" text-anchor="middle" class="river-axis-label">${formatRiverAxisTime(p.t,riverWindowHours)}</text>`;
  }).join("");

  const last=xy[xy.length-1];

  host.innerHTML=`
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução do nível do Rio Biguaçu em ${riverPeriodText(riverWindowHours).toLowerCase()}">
      <defs>
        <linearGradient id="riverFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#1681EF" stop-opacity=".28"/>
          <stop offset="100%" stop-color="#1681EF" stop-opacity=".025"/>
        </linearGradient>
        <filter id="riverDotShadow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".18"/>
        </filter>
      </defs>
      ${yGrid}
      <polygon points="${area}" fill="url(#riverFill)"/>
      <polyline points="${coords}" class="river-chart-line"/>
      <line id="riverCrosshair" x1="${last.x}" y1="${pad.t}" x2="${last.x}" y2="${height-pad.b}" class="river-crosshair" visibility="hidden"/>
      <circle id="riverHoverDot" cx="${last.x}" cy="${last.y}" r="5" class="river-hover-dot" visibility="hidden"/>
      <circle cx="${last.x}" cy="${last.y}" r="6" class="river-last-dot" filter="url(#riverDotShadow)"/>
      ${xLabels}
    </svg>
    <div class="river-current-label" style="left:${(last.x/width*100).toFixed(2)}%;top:${(last.y/height*100).toFixed(2)}%">
      ${last.v.toFixed(2).replace(".",",")} m
    </div>
    <div class="river-tooltip" id="riverTooltip">
      <strong id="riverTooltipLevel">${last.v.toFixed(2).replace(".",",")} m</strong>
      <span id="riverTooltipTime">${formatRiverTooltipTime(last.t)}</span>
    </div>`;

  riverChartView={pts:xy,width,height,pad};
  bindRiverChartInteraction();
}
function bindRiverChartInteraction(){
  const host=$("#riverChart"),view=riverChartView;
  if(!host||!view)return;

  const tooltip=$("#riverTooltip");
  const cross=$("#riverCrosshair");
  const dot=$("#riverHoverDot");
  const latest=view.pts[view.pts.length-1];

  function paintPoint(nearest,active=true){
    if(!nearest)return;
    cross?.setAttribute("x1",nearest.x);
    cross?.setAttribute("x2",nearest.x);
    cross?.setAttribute("visibility",active?"visible":"hidden");
    dot?.setAttribute("cx",nearest.x);
    dot?.setAttribute("cy",nearest.y);
    dot?.setAttribute("visibility",active?"visible":"hidden");
    if($("#riverTooltipLevel"))$("#riverTooltipLevel").textContent=`${nearest.v.toFixed(2).replace(".",",")} m`;
    if($("#riverTooltipTime"))$("#riverTooltipTime").textContent=formatRiverTooltipTime(nearest.t);
    if(tooltip)tooltip.hidden=false;
  }

  function showAt(clientX){
    const rect=host.getBoundingClientRect();
    if(rect.width<=0)return;
    const svgX=Math.max(view.pad.l,Math.min(view.width-view.pad.r,(clientX-rect.left)/rect.width*view.width));
    let nearest=view.pts[0],dist=Infinity;
    for(const p of view.pts){
      const d=Math.abs(p.x-svgX);
      if(d<dist){dist=d;nearest=p;}
    }
    paintPoint(nearest,true);
  }

  function reset(){paintPoint(latest,false);}

  host.onpointermove=e=>{
    if(e.pointerType==="touch")return;
    showAt(e.clientX);
  };
  host.onpointerdown=e=>showAt(e.clientX);
  host.onpointerleave=reset;
  host.onpointercancel=reset;
  reset();
}
function bindRiverWindowControls(){
  const wrap=$("#riverWindowChips");
  if(!wrap||wrap.dataset.bound==="1")return;
  wrap.dataset.bound="1";
  wrap.addEventListener("click",e=>{
    const btn=e.target.closest("[data-river-window]");
    if(!btn)return;
    riverWindowHours=Number(btn.dataset.riverWindow)||24;
    renderRiverChart(state.riverStatus?.series||[]);
  });
}

function renderRiverStatus(){
  const d=state.riverStatus;
  const badge=$("#riverStatusBadge");
  const value=$("#riverLevelValue"),trend=$("#riverTrend"),variation=$("#riverVariation"),updated=$("#riverUpdated"),fresh=$("#riverFreshness");
  if(!badge||!value)return;
  bindRiverWindowControls();

  const connection=d?.connection_state||"source_not_configured";
  const latest=d?.latest||null;
  const status=d?.status||"unknown";
  badge.className=`river-status-badge ${status}`;
  badge.textContent=riverStatusLabel(status);

  if(latest){
    value.textContent=`${Number(latest.level_m).toFixed(2).replace(".",",")} m`;
    const delta=MonitoraCore.riverDelta(d?.series||[]);
    const trendValue=delta===null?"unknown":(Math.abs(delta.value)<=0.02?"stable":delta.value>0?"rising":"falling");
    trend.className=`river-trend ${trendValue}`;
    trend.textContent=riverTrendLabel(trendValue);
    variation.textContent=delta===null?"Variação em 1 hora: dados insuficientes":`Variação em aproximadamente 1 hora: ${formatRiverDelta(delta.value)} (${delta.minutes} min)`;
    updated.textContent=latest.stale
      ?`Dado desatualizado • medição de ${formatRiverTime(latest.measured_at)}`
      :`Medição: ${formatRiverTime(latest.measured_at)} • consulta a cada ${d?.source?.polling_minutes||15} min`;
    fresh.textContent=connection==="unavailable"?"Sem conexão com a fonte • exibindo última medição salva":riverFreshnessText(latest);
    renderRiverChart(d?.series||[]);
  }else{
    value.textContent="—";
    trend.className="river-trend unknown";
    trend.textContent=connection==="source_not_configured"?"Fonte estruturada ainda não confirmada":"Sem medição disponível";
    variation.textContent="Variação em 1 hora: —";
    updated.textContent=connection==="source_not_configured"
      ?"Backend pronto; ingestão automática permanece desativada até validar o endpoint oficial."
      :"Aguardando nova medição.";
    fresh.textContent="Nenhuma medição armazenada.";
    renderRiverChart([]);
  }
}
async function loadRiverStatus(){
  if(!state.user)return;
  try{
    const {data,error}=await db.functions.invoke("river-biguacu-status",{method:"GET"});
    if(error)throw error;
    state.riverStatus=data||null;
    saveSnapshot();
  }catch(e){
    console.warn("Rio Biguaçu:",e);
    state.riverStatus={...(state.riverStatus||{latest:null,status:"unknown",trend:"unknown",series:[]}),connection_state:"unavailable"};
  }
  renderRiverStatus();
  renderSources();
}
function scheduleRiverRefresh(){
  clearTimeout(riverRefreshTimer);
  riverRefreshTimer=setTimeout(async()=>{
    if(document.visibilityState==="visible")await loadRiverStatus();
    scheduleRiverRefresh();
  },15*60*1000);
}


