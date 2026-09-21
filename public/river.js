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
function riverSmoothSegments(points){
  if(!points||points.length<2)return "";
  let out="";
  for(let i=0;i<points.length-1;i++){
    const p0=points[i-1]||points[i];
    const p1=points[i];
    const p2=points[i+1];
    const p3=points[i+2]||p2;
    const cp1x=p1.x+(p2.x-p0.x)/6;
    const cp1y=p1.y+(p2.y-p0.y)/6;
    const cp2x=p2.x-(p3.x-p1.x)/6;
    const cp2y=p2.y-(p3.y-p1.y)/6;
    out+=` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return out;
}
function riverPointDelta(pts,index){
  if(index<=0||!pts[index]||!pts[index-1])return null;
  return pts[index].v-pts[index-1].v;
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
    host.removeAttribute("tabindex");
    host.innerHTML='<div class="river-chart-empty"><b>Histórico insuficiente</b><span>Ainda não há medições suficientes neste período.</span></div>';
    return;
  }

  const vals=pts.map(x=>x.v);
  const {min,max,span}=niceRiverBounds(vals);
  const width=760,height=250;
  const pad={l:62,r:28,t:34,b:44};
  const plotW=width-pad.l-pad.r,plotH=height-pad.t-pad.b;

  const xy=pts.map((x,i)=>{
    const px=pad.l+(i/(pts.length-1))*plotW;
    const py=pad.t+((max-x.v)/span)*plotH;
    return {...x,x:px,y:py};
  });

  const segments=riverSmoothSegments(xy);
  const first=xy[0],last=xy[xy.length-1],baseline=height-pad.b;
  const linePath=`M ${first.x.toFixed(1)} ${first.y.toFixed(1)}${segments}`;
  const areaPath=`M ${first.x.toFixed(1)} ${baseline.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}${segments} L ${last.x.toFixed(1)} ${baseline.toFixed(1)} Z`;

  const yTicks=Array.from({length:4},(_,i)=>{
    const value=max-(span*(i/3));
    const y=pad.t+plotH*(i/3);
    return {value,y};
  });

  const tickCount=Math.min(riverWindowHours>=168?4:5,pts.length);
  const idxs=[...new Set(Array.from({length:tickCount},(_,i)=>
    Math.round(i*(pts.length-1)/(tickCount-1))
  ))];

  const yGrid=yTicks.map(t=>`
    <line x1="${pad.l}" y1="${t.y.toFixed(1)}" x2="${width-pad.r}" y2="${t.y.toFixed(1)}" class="river-grid-line"/>
    <text x="${pad.l-10}" y="${(t.y+4).toFixed(1)}" text-anchor="end" class="river-axis-label river-axis-y">${t.value.toFixed(2).replace(".",",")} m</text>
  `).join("");

  const xLabels=idxs.map((i,pos)=>{
    const p=xy[i];
    const anchor=pos===0?"start":pos===idxs.length-1?"end":"middle";
    const x=pos===0?pad.l:pos===idxs.length-1?width-pad.r:p.x;
    return `<text x="${x.toFixed(1)}" y="${height-14}" text-anchor="${anchor}" class="river-axis-label river-axis-x">${formatRiverAxisTime(p.t,riverWindowHours)}</text>`;
  }).join("");

  host.innerHTML=`
    <div class="river-chart-inspector" id="riverChartInspector" aria-live="polite">
      <span id="riverInspectorLabel">Última medição</span>
      <strong id="riverInspectorLevel">${last.v.toFixed(2).replace(".",",")} m</strong>
      <small id="riverInspectorTime">${formatRiverTooltipTime(last.t)}</small>
      <em id="riverInspectorDelta"></em>
    </div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução do nível do Rio Biguaçu em ${riverPeriodText(riverWindowHours).toLowerCase()}">
      <defs>
        <linearGradient id="riverFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#0A84FF" stop-opacity=".34"/>
          <stop offset="58%" stop-color="#0A84FF" stop-opacity=".12"/>
          <stop offset="100%" stop-color="#0A84FF" stop-opacity=".015"/>
        </linearGradient>
        <filter id="riverDotShadow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".18"/>
        </filter>
      </defs>
      ${yGrid}
      <path d="${areaPath}" class="river-chart-area"/>
      <path d="${linePath}" class="river-chart-line"/>
      <line id="riverCrosshair" x1="${last.x}" y1="${pad.t}" x2="${last.x}" y2="${baseline}" class="river-crosshair" visibility="hidden"/>
      <circle id="riverHoverDot" cx="${last.x}" cy="${last.y}" r="6" class="river-hover-dot" visibility="hidden"/>
      <circle cx="${last.x}" cy="${last.y}" r="6" class="river-last-dot" filter="url(#riverDotShadow)"/>
      ${xLabels}
    </svg>
    <div class="river-current-label" style="left:${Math.min(92,Math.max(8,last.x/width*100)).toFixed(2)}%;top:${Math.min(78,Math.max(18,last.y/height*100)).toFixed(2)}%">
      ${last.v.toFixed(2).replace(".",",")} m
    </div>
    <div class="river-tooltip" id="riverTooltip" hidden>
      <strong id="riverTooltipLevel">${last.v.toFixed(2).replace(".",",")} m</strong>
      <span id="riverTooltipTime">${formatRiverTooltipTime(last.t)}</span>
    </div>
    <div class="river-chart-help">Toque, arraste ou passe o mouse sobre o gráfico</div>`;

  host.setAttribute("tabindex","0");
  host.setAttribute("aria-label","Gráfico interativo do nível do Rio Biguaçu. Use as setas para navegar pelas medições.");
  riverChartView={pts:xy,width,height,pad,selectedIndex:xy.length-1};
  bindRiverChartInteraction();
}
function bindRiverChartInteraction(){
  const host=$("#riverChart"),view=riverChartView;
  if(!host||!view)return;

  const tooltip=$("#riverTooltip");
  const cross=$("#riverCrosshair");
  const dot=$("#riverHoverDot");
  const currentLabel=$(".river-current-label",host);
  let touching=false;
  let resetTimer=null;

  function paintPoint(index,active=true){
    index=Math.max(0,Math.min(view.pts.length-1,index));
    const nearest=view.pts[index];
    if(!nearest)return;
    view.selectedIndex=index;

    cross?.setAttribute("x1",nearest.x);
    cross?.setAttribute("x2",nearest.x);
    cross?.setAttribute("visibility",active?"visible":"hidden");
    dot?.setAttribute("cx",nearest.x);
    dot?.setAttribute("cy",nearest.y);
    dot?.setAttribute("visibility",active?"visible":"hidden");

    if($("#riverTooltipLevel"))$("#riverTooltipLevel").textContent=`${nearest.v.toFixed(2).replace(".",",")} m`;
    if($("#riverTooltipTime"))$("#riverTooltipTime").textContent=formatRiverTooltipTime(nearest.t);

    const inspectorLabel=$("#riverInspectorLabel"),inspectorLevel=$("#riverInspectorLevel"),inspectorTime=$("#riverInspectorTime"),inspectorDelta=$("#riverInspectorDelta");
    if(inspectorLabel)inspectorLabel.textContent=index===view.pts.length-1?"Última medição":"Medição selecionada";
    if(inspectorLevel)inspectorLevel.textContent=`${nearest.v.toFixed(2).replace(".",",")} m`;
    if(inspectorTime)inspectorTime.textContent=formatRiverTooltipTime(nearest.t);
    const delta=riverPointDelta(view.pts,index);
    if(inspectorDelta){
      inspectorDelta.textContent=delta===null?"":`${formatRiverDelta(delta)} vs. anterior`;
      inspectorDelta.className=delta===null?"":Math.abs(delta)<.0005?"stable":delta>0?"rising":"falling";
    }

    if(tooltip){
      if(active){
        const rect=host.getBoundingClientRect();
        const x=(nearest.x/view.width)*rect.width;
        const y=(nearest.y/view.height)*rect.height;
        const half=58;
        tooltip.style.left=`${Math.max(half+6,Math.min(rect.width-half-6,x))}px`;
        tooltip.style.top=`${Math.max(62,Math.min(rect.height-22,y-4))}px`;
        tooltip.hidden=false;
      }else{
        tooltip.hidden=true;
      }
    }
    if(currentLabel)currentLabel.style.opacity=active?"0":"1";
  }

  function nearestIndex(clientX){
    const rect=host.getBoundingClientRect();
    if(rect.width<=0)return view.pts.length-1;
    const svgX=Math.max(view.pad.l,Math.min(view.width-view.pad.r,(clientX-rect.left)/rect.width*view.width));
    let idx=0,dist=Infinity;
    view.pts.forEach((p,i)=>{
      const d=Math.abs(p.x-svgX);
      if(d<dist){dist=d;idx=i;}
    });
    return idx;
  }

  function showAt(clientX){
    clearTimeout(resetTimer);
    paintPoint(nearestIndex(clientX),true);
  }

  function resetSoon(delay=900){
    clearTimeout(resetTimer);
    resetTimer=setTimeout(()=>paintPoint(view.pts.length-1,false),delay);
  }

  host.onpointermove=e=>{
    if(e.pointerType==="touch"&&!touching)return;
    showAt(e.clientX);
  };
  host.onpointerdown=e=>{
    touching=e.pointerType==="touch";
    try{host.setPointerCapture?.(e.pointerId);}catch(_){}
    showAt(e.clientX);
  };
  host.onpointerup=e=>{
    touching=false;
    try{host.releasePointerCapture?.(e.pointerId);}catch(_){}
    resetSoon(e.pointerType==="touch"?2400:1100);
  };
  host.onpointerleave=()=>{if(!touching)resetSoon(250);};
  host.onpointercancel=()=>{touching=false;resetSoon(250);};
  host.onfocus=()=>paintPoint(view.selectedIndex??view.pts.length-1,true);
  host.onblur=()=>paintPoint(view.pts.length-1,false);
  host.onkeydown=e=>{
    if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight"&&e.key!=="Home"&&e.key!=="End")return;
    e.preventDefault();
    let idx=view.selectedIndex??view.pts.length-1;
    if(e.key==="ArrowLeft")idx--;
    if(e.key==="ArrowRight")idx++;
    if(e.key==="Home")idx=0;
    if(e.key==="End")idx=view.pts.length-1;
    paintPoint(idx,true);
  };

  paintPoint(view.pts.length-1,false);
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

function renderDesktopRiverSummary(d,status,latest){
  const value=$("#desktopRiverLevel");
  const deltaEl=$("#desktopRiverDelta");
  const statusEl=$("#desktopRiverStatus");
  const updated=$("#desktopRiverUpdated");
  if(!value||!deltaEl||!statusEl||!updated)return;

  statusEl.className=`desktop-river-status ${status||"unknown"}`;
  const statusText={normal:"Normal",attention:"Atenção",alert:"Alerta",critical:"Crítico",unknown:"Sem cota oficial"};
  statusEl.textContent=statusText[status]||statusText.unknown;

  const scaleMarker=$("#desktopRiverScaleMarker");
  if(!latest){
    value.textContent="—";
    deltaEl.textContent="Aguardando dados";
    updated.textContent="Última medição: —";
    if(scaleMarker)scaleMarker.style.setProperty("--river-pct","0%");
    return;
  }

  value.textContent=`${Number(latest.level_m).toFixed(2).replace(".",",")} m`;
  const pts24=filterRiverSeries(d?.series||[],24);
  const delta24=pts24.length>1?pts24[pts24.length-1].v-pts24[0].v:null;
  if(delta24===null){
    deltaEl.textContent="Variação 24h: —";
  }else{
    const arrow=Math.abs(delta24)<=0.005?"→":delta24>0?"↑":"↓";
    deltaEl.textContent=`${arrow} ${formatRiverDelta(delta24)} (24h)`;
  }
  updated.textContent=`Última medição: ${formatRiverTime(latest.measured_at)}`;
  if(scaleMarker){
    const pct=Math.max(0,Math.min(100,(Number(latest.level_m)/4)*100));
    scaleMarker.style.setProperty("--river-pct",`${pct.toFixed(1)}%`);
  }
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
  renderDesktopRiverSummary(d,status,latest);

  if(latest){
    value.textContent=`${Number(latest.level_m).toFixed(2).replace(".",",")} m`;
    if($("#v7RiverLevel"))$("#v7RiverLevel").textContent=value.textContent;
    const delta=MonitoraCore.riverDelta(d?.series||[]);
    const trendValue=delta===null?"unknown":(Math.abs(delta.value)<=0.02?"stable":delta.value>0?"rising":"falling");
    trend.className=`river-trend ${trendValue}`;
    trend.textContent=riverTrendLabel(trendValue);
    if($("#v7RiverStatus"))$("#v7RiverStatus").textContent=riverStatusLabel(status)==="SEM COTA OFICIAL"?riverTrendLabel(trendValue):riverStatusLabel(status);
    if($("#v7RiverDot"))$("#v7RiverDot").className=status;
    variation.textContent=delta===null?"Variação em 1 hora: dados insuficientes":`Variação em aproximadamente 1 hora: ${formatRiverDelta(delta.value)} (${delta.minutes} min)`;
    updated.textContent=latest.stale
      ?`Dado desatualizado • medição de ${formatRiverTime(latest.measured_at)}`
      :`Medição: ${formatRiverTime(latest.measured_at)} • consulta a cada ${d?.source?.polling_minutes||15} min`;
    fresh.textContent=connection==="unavailable"?"Sem conexão com a fonte • exibindo última medição salva":riverFreshnessText(latest);
    renderRiverChart(d?.series||[]);
  }else{
    value.textContent="—";
    if($("#v7RiverLevel"))$("#v7RiverLevel").textContent="—";
    trend.className="river-trend unknown";
    trend.textContent=connection==="source_not_configured"?"Fonte estruturada ainda não confirmada":"Sem medição disponível";
    if($("#v7RiverStatus"))$("#v7RiverStatus").textContent="Sem medição disponível";
    if($("#v7RiverDot"))$("#v7RiverDot").className="";
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


