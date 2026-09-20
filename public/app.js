
const SUPABASE_URL = "https://wdyvfuzmntqbldxxzokd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ubslwFZZ-XN8CTS1C6Dyiw_umpyC99W";
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let PUSH_VAPID_PUBLIC_KEY = null;

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

const THEME_STORAGE_KEY="monitora_theme";
function currentTheme(){return document.documentElement.dataset.theme==="dark"?"dark":"light";}
function applyTheme(theme,{persist=true}={}){
  const next=theme==="dark"?"dark":"light";
  document.documentElement.dataset.theme=next;
  if(persist){try{localStorage.setItem(THEME_STORAGE_KEY,next);}catch(_){}}
  const dark=next==="dark";
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",dark?"#0B1625":"#0B63CE");
  const desk=$("#themeToggleDesktop"), mobile=$("#themeToggleMobile");
  [desk,mobile].filter(Boolean).forEach(btn=>{
    btn.setAttribute("aria-checked",String(dark));
    btn.classList.toggle("on",dark);
  });
  if($("#themeToggleDesktopLabel"))$("#themeToggleDesktopLabel").textContent=dark?"Tema claro":"Tema escuro";
  if($("#themeStatusText"))$("#themeStatusText").textContent=dark?"Tema escuro ativado":"Tema claro";
  document.body?.classList.toggle("theme-dark",dark);
}
function toggleTheme(){applyTheme(currentTheme()==="dark"?"light":"dark");}
function snapshotKey(){return `monitora_snapshot_v1_${state.user?.id||"none"}`;}
function saveSnapshot(){
  if(!state.user||!state.profile)return;
  try{
    const {profile,condominiums,locations,occurrences,recentResolved,alerts,riverStatus,sourceUpdatedAt}=state;
    localStorage.setItem(snapshotKey(),JSON.stringify({savedAt:Date.now(),profile,condominiums,locations,occurrences,recentResolved,alerts,riverStatus,sourceUpdatedAt}));
  }catch(_){/* Storage may be disabled or full; live use still works. */}
}
function restoreSnapshot(){
  try{
    const cached=JSON.parse(localStorage.getItem(snapshotKey())||"null");
    if(!cached||cached.profile?.user_id!==state.user?.id||Date.now()-cached.savedAt>7*86400000)return;
    for(const key of ["profile","condominiums","locations","occurrences","recentResolved","alerts","riverStatus","sourceUpdatedAt"]){
      if(cached[key]!=null)state[key]=cached[key];
    }
    state.connectionDegraded=true;
    fillCondoSelects();
  }catch(_){}
}
function renderConnection(){
  const pending=!navigator.onLine||state.connectionDegraded;
  const message=!navigator.onLine?"Sem conexão • últimos dados salvos; sua sessão foi preservada.":pending?"Conexão parcial • alguns dados podem estar desatualizados.":"Conectado • dados da comunidade sincronizados.";
  const banner=$("#connectionNotice");
  if(banner){banner.hidden=!pending;banner.textContent=message;}
  if($("#backendStatus"))$("#backendStatus").textContent=message;
  const mobileSystem=$("#v7SystemStatus");
  if(mobileSystem){
    mobileSystem.classList.remove("online","degraded","offline");
    const mode=!navigator.onLine?"offline":pending?"degraded":"online";
    mobileSystem.classList.add(mode);
    mobileSystem.innerHTML=`<i></i>${!navigator.onLine?"Sem conexão":pending?"Conexão parcial":"Sistema online"}`;
  }
  renderSources();
}
function renderSources(){
  const hosts=[$("#monitoringSources"),$("#homeMonitoringSources"),$("#mobileMonitoringSources")].filter(Boolean);if(!hosts.length)return;
  const river=state.riverStatus;
  const sourceText=river?.connection_state==='ok'?"Medição disponível":river?.connection_state==='stale'?"Medição desatualizada":river?.connection_state==='degraded'?"Fonte com falha recente":"Consulta indisponível ou pendente";
  let weatherText="Consulta pendente";
  try{const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||"null");if(cached?.saved_at){const mins=Math.max(0,Math.floor((Date.now()-cached.saved_at)/60000));weatherText=(state.weatherUnavailable||mins>60?"Desatualizado":"Online")+" • atualização há "+mins+" min";}}catch(_){}
  const pushText=state.pushEnabled?"Ativas neste aparelho":"Desativadas ou não confirmadas neste aparelho";
  hosts.forEach(host=>host.innerHTML=`<p><b>Relatos dos moradores</b> — ${!navigator.onLine||state.connectionDegraded?"últimos dados disponíveis":"conectado"}</p><p><b>Epagri/Ciram · Rio Biguaçu</b> — ${sourceText}</p><p><b>Previsão · Open-Meteo</b> — ${weatherText}</p><p><b>Notificações</b> — ${pushText}</p><p>Disponibilidade das fontes não indica ausência de risco na comunidade.</p>`);
}
async function loadPushConfig(){
  const {data,error}=await db.functions.invoke("app-config",{method:"GET"});
  if(error||!data?.push_vapid_public_key)throw new Error("PUSH_CONFIG_UNAVAILABLE");
  PUSH_VAPID_PUBLIC_KEY=data.push_vapid_public_key;
}
function pushKeyMatches(subscription){
  const raw=subscription.options?.applicationServerKey;
  if(!raw||!PUSH_VAPID_PUBLIC_KEY)return false;
  const actual=new Uint8Array(raw),expected=base64UrlToUint8Array(PUSH_VAPID_PUBLIC_KEY);
  return actual.length===expected.length&&actual.every((byte,i)=>byte===expected[i]);
}
function initTheme(){
  let stored="light";
  try{stored=localStorage.getItem(THEME_STORAGE_KEY)==="dark"?"dark":"light";}catch(_){}
  applyTheme(stored,{persist:false});
  $("#themeToggleDesktop")?.addEventListener("click",toggleTheme);
  $("#themeToggleMobile")?.addEventListener("click",toggleTheme);
}


function isMapGestureTarget(target){
  return !!target?.closest?.(".leaflet-container,.map-shell,.map-preview,.map-full");
}

const state = {
  user:null, profile:null, isAdmin:false, adminUsers:[], adminOccurrences:[], adminAlerts:[], condominiums:[], locations:[], occurrences:[], recentResolved:[], alerts:[], riverStatus:null,
  maps:{}, markers:{home:[],full:[]}, filter:"all", alertFilter:"all",
  installPrompt:null, initialized:false, realtimeChannel:null,
  avenueLayers:{home:[],full:[]}, lakeLayers:{home:[],full:[]}, riverLayers:{home:[],full:[]},
  selectedPoint:null, selectedPointMarker:null, selectedPoints:[], selectedPointMarkers:[],
  pointPickMode:false, multiPointMode:false, mapInteractionBound:false, mapLongPressTimer:null, pointerStart:null,
  occurrencePointMarkers:{home:[],full:[]}, eventLayers:{home:[],full:[]}, mapResizeObserver:null,
  activeMapItem:null, editingOccurrenceId:null, editingOccurrenceGroupId:null, editingOccurrenceIds:[],
  selectedSegment:null, segmentSelectionLayers:[], segmentPickMode:null, reportAvenueMode:"point",
  reportLocationIds:[], reportCustomLocation:"", reportSource:"manual", smartParsed:false,
  smartLocationDetails:{},
  reportPhotos:[], removedPhotoIds:[], photoViewerUrls:[], reportDamageTypes:[],
  pushEnabled:false, pushMinSeverity:"attention", pushSubscription:null
};
const MAP_W=1601, MAP_H=982;
const MAP_BOUNDS=[[0,0],[MAP_H,MAP_W]];
const MAP_EXTENDED_BOUNDS=[[-120,-180],[MAP_H+120,MAP_W+180]];

/* Visual anchors are tied to this map artwork and remain stable at every zoom. */
const visualAnchors={
  "Av. Egídio Abelino Richartz":[121,472],
  "Av. Wilson Castelo Branco":[700,282],
  "Av. Deltaville":[650,555],
  "Av. Beira Rio":[1138,522],
  "Lagos Av. Deltaville":[634,532],
  "Lagos Av. Comercial":[1332,520],
  "Lagos Rodovia - Blue":[390,760],
  "Lagos Rodovia - Garden":[766,833],
  "Rio Biguaçu":[1572,555]
};

const condominiumAnchors={
  "Brisas":[370,170],
  "Costa do Sol":[805,165],
  "Blue":[390,520],
  "Acqua":[925,525],
  "Garden":[900,735]
};
const neighborhoodAnchor=[800,500];
const WEATHER_SCOPE_TYPES=new Set(["heavy_rain_flood_risk","hail","wind_damage","wind_no_damage"]);
const COMMUNITY_PROBLEM_TYPES=new Set([
  "public_lighting","drainage_clogged","tree_hazard","road_damage","power_outage",
  "sewer_issue","waste_accumulation","signage_issue","sidewalk_obstruction",
  "water_supply","infrastructure_damage","other_neighborhood_issue"
]);
const DAMAGE_LABELS={
  tree:"Árvore/galhos",
  roof:"Telhado/estrutura",
  power:"Energia/postes",
  vehicle:"Veículos",
  other:"Outros danos"
};
function isWeatherScopeType(type){return WEATHER_SCOPE_TYPES.has(type);}
function isCommunityProblemType(type){return COMMUNITY_PROBLEM_TYPES.has(type);}
function condominiumToken(id){return `condo:${id}`;}
function isCondominiumToken(id){return String(id||"").startsWith("condo:");}
function condominiumIdFromToken(id){return String(id||"").slice(6);}
function condominiumByToken(token){
  if(!isCondominiumToken(token))return null;
  return state.condominiums.find(c=>String(c.id)===condominiumIdFromToken(token))||null;
}
function reportLocationName(id){
  id=String(id||"");
  if(id==="whole")return "Bairro inteiro";
  if(id==="other")return $("#customLocation")?.value.trim()||state.reportCustomLocation||"Outro local";
  if(isCondominiumToken(id))return condominiumByToken(id)?.name||"Condomínio";
  return locationById(id)?.name||"";
}
function condominiumNormalized(name){
  const xy=condominiumAnchors[name];
  if(!xy)return {map_x:.5,map_y:.5};
  return {map_x:xy[0]/MAP_W,map_y:xy[1]/MAP_H};
}
function neighborhoodNormalized(){
  return {map_x:neighborhoodAnchor[0]/MAP_W,map_y:neighborhoodAnchor[1]/MAP_H};
}


const occurrenceLabels = {
  avenue_flooding:"Alagamento em avenida", lakes_full:"Lagos cheios",
  heavy_rain_flood_risk:"Chuva intensa / risco de alagamento", hail:"Granizo",
  wind_damage:"Vendaval com danos", wind_no_damage:"Vendaval sem danos",
  river_level:"Nível do Rio Biguaçu", river_overflow:"Transbordamento de rio",
  public_lighting:"Iluminação pública", drainage_clogged:"Bueiro / drenagem",
  tree_hazard:"Árvore / galhos", road_damage:"Buraco / pavimento",
  power_outage:"Energia / poste", sewer_issue:"Esgoto / vazamento",
  waste_accumulation:"Lixo / entulho", signage_issue:"Sinalização",
  sidewalk_obstruction:"Calçada / obstrução", water_supply:"Abastecimento de água",
  infrastructure_damage:"Estrutura danificada", other_neighborhood_issue:"Outro problema"
};
const conditionLabels = {
  water_accumulating:"Água acumulando", flooding:"Alagamento",
  partially_blocked:"Via parcialmente bloqueada", impassable:"Via intransitável"
};
const severityLabels = {attention:"Atenção",alert:"Alerta",critical:"Crítico"};
const severityRank = {normal:0,attention:1,alert:2,critical:3};
const occurrenceIconShapes = {
  avenue_flooding:`
    <path d="M7.2 12.2 8.5 8.5h7l1.3 3.7"/>
    <path d="M5.5 12.5h13v3.4h-13z"/>
    <circle cx="8" cy="15.9" r=".8"/><circle cx="16" cy="15.9" r=".8"/>
    <path d="M3 18.7c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/>
    <path d="M4 21c1.3-.8 2.6-.8 3.9 0s2.6.8 3.9 0 2.6-.8 3.9 0 2.6.8 4 0"/>
  `,
  drainage_clogged:`
    <circle cx="12" cy="12" r="7.2"/>
    <path d="M7.5 9.2h9M6.8 12h10.4M7.5 14.8h9M9.2 6.9v10.2M12 5.7v12.6M14.8 6.9v10.2"/>
  `,
  lakes_full:`
    <path d="M3 9.4c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/>
    <path d="M3 13.3c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/>
    <path d="M3 17.2c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/>
  `,
  river_level:`
    <path d="M5 5v14M3.5 8H5M3.5 11H5M3.5 14H5M3.5 17H5"/>
    <path d="M7.5 10.5c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.6-.9 3.9 0"/>
    <path d="M7.5 14.3c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.6-.9 3.9 0"/>
    <path d="M7.5 18.1c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.6-.9 3.9 0"/>
  `,
  river_overflow:`
    <path d="M5 5v14M3.5 8H5M3.5 11H5M3.5 14H5M3.5 17H5"/>
    <path d="M7.5 11c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.6-.9 3.9 0"/>
    <path d="M7.5 14.8c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.6-.9 3.9 0"/>
    <path d="M7.5 18.6c1.3-.9 2.6-.9 3.9 0s2.6.9 3.9 0 2.6-.9 3.9 0"/>
    <path d="M17.5 10V5.5M15.5 7.4l2-2 2 2"/>
  `,
  heavy_rain_flood_risk:`
    <path d="M6.2 14.2h10.3a3.5 3.5 0 0 0 .2-7 4.7 4.7 0 0 0-8.9 1.2 3 3 0 0 0-1.6 5.8Z"/>
    <path d="M8 16.8 7.3 19M12 16.8 11.3 19M16 16.8 15.3 19"/>
    <path d="M5 21c1.2-.7 2.4-.7 3.6 0s2.4.7 3.6 0 2.4-.7 3.6 0 2.4.7 3.6 0"/>
  `,
  hail:`
    <path d="M6.2 13.4h10.3a3.5 3.5 0 0 0 .2-7 4.7 4.7 0 0 0-8.9 1.2 3 3 0 0 0-1.6 5.8Z"/>
    <circle cx="8" cy="17.2" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="16" cy="17.2" r="1"/>
  `,
  wind_damage:`
    <path d="M3.5 8h10.3c2.5 0 2.5-3 0-3-1.2 0-1.9.6-2.1 1.4"/>
    <path d="M3.5 12h14c3 0 3 4 0 4-1.5 0-2.3-.8-2.5-1.8"/>
    <path d="M4.5 16h6.8"/>
    <path d="m17.3 18.5 2.7-2.7M18.4 20l2.2-2.2"/>
  `,
  wind_no_damage:`
    <path d="M3.5 8h10.3c2.5 0 2.5-3 0-3-1.2 0-1.9.6-2.1 1.4"/>
    <path d="M3.5 12h14c3 0 3 4 0 4-1.5 0-2.3-.8-2.5-1.8"/>
    <path d="M4.5 16h6.8"/>
  `,
  public_lighting:`
    <path d="M9 19h6M10 16h4M9.2 12.5a5 5 0 1 1 5.6 0c-.9.6-1.3 1.3-1.4 2.1h-2.8c-.1-.8-.5-1.5-1.4-2.1Z"/>
    <path d="M12 2.2v1.5M4.7 5.2l1.1 1.1M19.3 5.2l-1.1 1.1"/>
  `,
  tree_hazard:`
    <path d="M12 20v-5M8.5 20h7"/>
    <path d="M12 4.2 8.5 9h2.1L7.8 13h8.4l-2.8-4H15Z"/>
    <path d="M18.3 14.8v3.1M18.3 20.2v.1"/>
  `,
  road_damage:`
    <path d="M8 21 10 3M16 21 14 3"/>
    <path d="m12.3 8-1.6 2.3 2 1.5-1.8 2.7 2.4 1.7-1.4 2.1"/>
  `,
  power_outage:`
    <path d="M8 21V7l4-3 4 3v14M6 10h12M7 15h10"/>
    <path d="m13 8-2 4h2l-2 4"/>
  `,
  sewer_issue:`
    <path d="M4 8h8v4h5v3"/>
    <path d="M3 17c1.4-.9 2.8-.9 4.2 0s2.8.9 4.2 0 2.8-.9 4.2 0 2.8.9 4.2 0"/>
    <path d="M3 20c1.4-.9 2.8-.9 4.2 0s2.8.9 4.2 0 2.8-.9 4.2 0 2.8.9 4.2 0"/>
  `,
  waste_accumulation:`
    <path d="M7 8h10l-.8 11H7.8Z"/>
    <path d="M6 8h12M9 8l1-3h4l1 3M10 11v5M14 11v5"/>
  `,
  signage_issue:`
    <path d="M12 21V4M12 5h7l-2 3 2 3h-7"/>
    <path d="M8 21h8"/>
  `,
  sidewalk_obstruction:`
    <path d="M4 17h16M6 13h5l2-4 2 4h3"/>
    <path d="M7 17v3M17 17v3"/>
  `,
  water_supply:`
    <path d="M5 9h8v4h5M8 9V6h5"/>
    <path d="M18 13v2.2"/>
    <path d="M14.5 18c1.1-.7 2.2-.7 3.3 0s2.2.7 3.3 0"/>
    <path d="M14.5 20.5c1.1-.7 2.2-.7 3.3 0s2.2.7 3.3 0"/>
  `,
  infrastructure_damage:`
    <path d="M5 21V6l7-3 7 3v15M5 10h14M9 10v11M15 10v11"/>
    <path d="m12 10-1.4 3 1.7 1.7-1.5 3.3"/>
  `,
  other_neighborhood_issue:`
    <circle cx="12" cy="12" r="8"/>
    <path d="M12 8v8M8 12h8"/>
  `
};

function occurrenceIconMarkup(type){
  const shape=occurrenceIconShapes[type]||occurrenceIconShapes.other_neighborhood_issue;
  return `<svg class="occ-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg>`;
}

function decorateOccurrenceTypeButtons(){
  $$("[data-occ-type]").forEach(btn=>{
    if(btn.dataset.iconReady==="1")return;
    const label=btn.textContent.trim();
    btn.textContent="";
    const icon=document.createElement("span");
    icon.className="occ-type-icon";
    icon.setAttribute("aria-hidden","true");
    icon.innerHTML=occurrenceIconMarkup(btn.dataset.occType);
    const text=document.createElement("span");
    text.className="occ-type-label";
    text.textContent=label;
    btn.append(icon,text);
    btn.dataset.iconReady="1";
  });
}

const META_PREFIX = "[[MDMETA]]";
const META_SUFFIX = "[[/MDMETA]]";

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function decodeOccurrenceNotes(raw){
  const text=String(raw||"");
  if(text.startsWith(META_PREFIX)){
    const end=text.indexOf(META_SUFFIX);
    if(end>META_PREFIX.length){
      let meta=null;
      try{ meta=JSON.parse(text.slice(META_PREFIX.length,end)); }catch(_){ meta=null; }
      return {meta,text:text.slice(end+META_SUFFIX.length).trim()};
    }
  }
  return {meta:null,text};
}
function encodeOccurrenceNotes(text,meta){
  const cleaned=String(text||"").trim();
  if(!meta)return cleaned?cleaned.slice(0,500):null;
  const head=`${META_PREFIX}${JSON.stringify(meta)}${META_SUFFIX}`;
  const remaining=Math.max(0,500-head.length);
  return head+cleaned.slice(0,remaining);
}
function hydrateOccurrence(o){
  const parsed=decodeOccurrenceNotes(o?.notes);
  return {...o,_meta:parsed.meta,notes_text:parsed.text};
}
function noteText(o){ return o?.notes_text ?? decodeOccurrenceNotes(o?.notes).text; }

function normText(v=""){
  return String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
function makeGroupId(){
  try{return crypto.randomUUID();}catch(_){return `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
}
function groupIdOf(o){return o?._meta?.groupId||null;}
function groupOccurrences(items=state.occurrences){
  const groups=[],by=new Map();
  for(const o of items){
    const gid=groupIdOf(o);
    if(gid){
      if(!by.has(gid)){const g={id:gid,items:[]};by.set(gid,g);groups.push(g);}
      by.get(gid).items.push(o);
    }else groups.push({id:null,items:[o]});
  }
  return groups;
}

function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.hidden=false;
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.hidden=true,3200);
}
function esc(v=""){ return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function age(iso){
  const min=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/60000));
  if(min<1)return"agora"; if(min<60)return`há ${min} min`;
  const h=Math.floor(min/60); if(h<24)return`há ${h}h`;
  return`há ${Math.floor(h/24)}d`;
}
function activeOccurrence(o){return o.status==="active" && new Date(o.expires_at)>new Date();}
function highestSeverity(items){
  return items.reduce((a,x)=>severityRank[x.severity]>severityRank[a]?x.severity:a,"normal");
}
function locationName(o){return o.monitored_locations?.name || o.custom_location || "Local informado";}
function navigate(page){
  if(page==="admin"&&!state.isAdmin){toast("Acesso restrito à administração.");page="profile";}
  $(".page").forEach(p=>p.classList.toggle("active",p.dataset.page===page));
  $$(".bottom-nav [data-nav]").forEach(b=>{
    const active=b.dataset.nav===page;
    b.classList.toggle("active",active);
    if(active)b.setAttribute("aria-current","page");
    else b.removeAttribute("aria-current");
  });
  $$(".desktop-nav [data-nav]").forEach(b=>{
    const active=b.dataset.nav===page;
    b.classList.toggle("active",active);
    if(active)b.setAttribute("aria-current","page");
    else b.removeAttribute("aria-current");
  });
  document.body.classList.toggle("map-open",page==="map");
  window.scrollTo({top:0,behavior:"smooth"});
  if(page==="reports")renderReports();
  if(page==="admin")loadAdminData();
  if(page==="map"){
    setTimeout(syncMapBottomUI,30);
    refreshFullMapLayout();
  }else{
    setTimeout(()=>ensureMapLayout(state.maps.home,true),80);
  }
}

function refreshFullMapLayout(){
  const map=state.maps.full;
  const el=$("#fullMap");
  if(!map||!el)return;

  const apply=()=>{
    const rect=el.getBoundingClientRect();
    if(rect.width<120||rect.height<120)return false;

    if(window.matchMedia("(pointer:fine)").matches)map.scrollWheelZoom.enable();
    map.invalidateSize({animate:false,pan:false});
    map.setMaxBounds(MAP_EXTENDED_BOUNDS);

    const coverZoom=map.getBoundsZoom(MAP_BOUNDS,true,[12,12]);
    if(Number.isFinite(coverZoom)){
      map.setMinZoom(coverZoom-.22);
      map.fitBounds(MAP_BOUNDS,{padding:[12,12],animate:false});
    }
    renderMapMarkers();
    return true;
  };

  requestAnimationFrame(()=>requestAnimationFrame(apply));
  [80,180,360,700].forEach(delay=>setTimeout(apply,delay));
}
function showLoading(show){$("#loading").hidden=!show;}

function ensureMapLayout(map,fit=false){
  if(!map)return;
  map.invalidateSize({animate:false});
  map.setMaxBounds(MAP_EXTENDED_BOUNDS);
  if(fit){
    const coverZoom=map.getBoundsZoom(MAP_BOUNDS,true,[0,0]);
    if(Number.isFinite(coverZoom)){
      map.setMinZoom(coverZoom-.18);
      map.setView([MAP_H/2,MAP_W/2],coverZoom,{animate:false});
    }
    map.__visibleFitDone=true;
  }
}
function xyToLatLng(x,y){return [MAP_H-Number(y),Number(x)];}
function shortLakeName(name){
  return String(name)
    .replace("Lagos Av. ","")
    .replace("Lagos Rodovia - ","");
}

async function bootstrap(){
  showLoading(true);
  try{
    const {data:{session},error}=await db.auth.getSession();
    if(error)throw error;

    if(!session){
      state.user=null; state.profile=null;
      await loadPublicCondominiums();
      showAccess("login");
      return;
    }

    state.user=session.user;
    restoreSnapshot();
    await loadLookups();
    await loadProfile();
    await loadAdminAccess();

    // Sessões anônimas criadas em outro contexto sem perfil não são úteis.
    if(!state.profile){
      await db.auth.signOut({scope:"local"}).catch(()=>{});
      state.user=null;
      showAccess("login");
      return;
    }

    await startSignedInApp();
  }catch(e){
    console.error("Falha ao iniciar app:",e);
    if(state.user && state.profile){
      state.connectionDegraded=true;
      await startSignedInApp();
    }else{
      toast("Sem conexão para carregar seu acesso. Sua sessão foi preservada; tente novamente quando a conexão voltar.");
      showAccess("login");
    }
  }finally{
    showLoading(false);
  }
}

async function startSignedInApp(){
  initMaps();
  await loadDataSafe();
  renderAll();
  subscribeRealtime();
  loadCachedWeather();
  loadWeather();
  scheduleWeatherRefresh();
  loadRiverStatus();
  scheduleRiverRefresh();
  state.pushMinSeverity=localStorage.getItem("monitora_push_level")||"attention";
  loadPushSettings();
  saveSnapshot();
  renderConnection();
  state.initialized=true;
  $("#accessOverlay").hidden=true;
  renderConnection();
  handlePushDeepLink();
}

async function loadPublicCondominiums(){
  const {data,error}=await db.from("condominiums").select("*").eq("active",true).order("sort_order");
  if(error)throw error;
  state.condominiums=data||[];
  fillCondoSelects();
}

async function loadLookups(){
  const [{data:condos,error:ce},{data:locs,error:le}] = await Promise.all([
    db.from("condominiums").select("*").eq("active",true).order("sort_order"),
    db.from("monitored_locations").select("*").eq("active",true).order("sort_order")
  ]);
  if(ce)throw ce;if(le)throw le;
  state.condominiums=condos||state.condominiums;
  state.locations=locs||[];
  fillCondoSelects();
}
async function loadProfile(){
  const {data,error}=await db.from("profiles").select("*, condominiums(name)").eq("user_id",state.user.id).maybeSingle();
  if(error)throw error; state.profile=data||null;
}

async function loadAdminAccess(){
  if(!state.user||state.user.is_anonymous===true){state.isAdmin=false;return false;}
  const {data,error}=await db.from("app_admins").select("user_id").eq("user_id",state.user.id).maybeSingle();
  if(error){console.warn("Admin check indisponível:",error);state.isAdmin=false;return false;}
  state.isAdmin=!!data;
  return state.isAdmin;
}

async function loadAdminData(){
  if(!state.isAdmin)return;
  const refresh=$("#adminRefreshBtn");
  if(refresh)refresh.disabled=true;
  try{
    const [usersRes,occRes,alertsRes]=await Promise.all([
      db.from("profiles").select("user_id,first_name,last_name,house_or_lot,created_at,condominiums(name)").order("created_at",{ascending:false}),
      db.from("occurrences").select("id,reporter_id,occurrence_type,severity,status,created_at,expires_at,resolved_at,reporter_first_name,reporter_last_name,reporter_condominium,custom_location,monitored_locations(name,category)").order("created_at",{ascending:false}).limit(40),
      db.from("alerts").select("id,title,message,severity,source_type,active,created_at,starts_at,ends_at").order("created_at",{ascending:false}).limit(30)
    ]);
    if(usersRes.error)throw usersRes.error;
    if(occRes.error)throw occRes.error;
    if(alertsRes.error)throw alertsRes.error;
    state.adminUsers=usersRes.data||[];
    state.adminOccurrences=occRes.data||[];
    state.adminAlerts=alertsRes.data||[];
    renderAdmin();
  }catch(error){
    console.error("Falha ao carregar administração:",error);
    toast("Não foi possível carregar os dados administrativos.");
  }finally{
    if(refresh)refresh.disabled=false;
  }
}

function renderAdmin(){
  if(!state.isAdmin)return;
  const users=state.adminUsers||[], occs=state.adminOccurrences||[], alerts=state.adminAlerts||[];
  const active=occs.filter(o=>o.status==="active"&&(!o.expires_at||new Date(o.expires_at)>new Date())).length;
  const resolved=occs.filter(o=>o.status==="resolved").length;
  const activeAlerts=alerts.filter(a=>a.active!==false&&(!a.ends_at||new Date(a.ends_at)>new Date())).length;
  if($("#adminUsersCount"))$("#adminUsersCount").textContent=users.length;
  if($("#adminActiveCount"))$("#adminActiveCount").textContent=active;
  if($("#adminResolvedCount"))$("#adminResolvedCount").textContent=resolved;
  if($("#adminAlertsCount"))$("#adminAlertsCount").textContent=activeAlerts;
  if($("#adminUsersBadge"))$("#adminUsersBadge").textContent=users.length;
  if($("#adminOccurrencesBadge"))$("#adminOccurrencesBadge").textContent=occs.length;
  if($("#adminAlertsBadge"))$("#adminAlertsBadge").textContent=alerts.length;

  const usersHost=$("#adminUsersList");
  if(usersHost)usersHost.innerHTML=users.length?users.map(u=>{
    const name=`${esc(u.first_name||"")} ${esc(u.last_name||"")}`.trim();
    const initials=((u.first_name?.[0]||"")+(u.last_name?.[0]||"")).toUpperCase()||"—";
    return `<article class="admin-user-row"><span class="admin-user-avatar">${esc(initials)}</span><div><b>${name||"Morador"}</b><small>${esc(u.condominiums?.name||"Sem condomínio")} • Casa/lote ${esc(u.house_or_lot||"—")}</small></div><time>${age(u.created_at)}</time></article>`;
  }).join(""):'<p class="muted">Nenhum morador cadastrado.</p>';

  const occHost=$("#adminOccurrencesList");
  if(occHost)occHost.innerHTML=occs.length?occs.map(o=>{
    const loc=esc(o.monitored_locations?.name||o.custom_location||o.reporter_condominium||"Deltaville");
    const reporter=esc(`${o.reporter_first_name||""} ${o.reporter_last_name||""}`.trim()||"Morador");
    const status=o.status==="resolved"?"Resolvida":(o.status==="active"?"Ativa":"Encerrada");
    const actions=o.status==="active"?`<div class="admin-row-actions"><button type="button" data-admin-resolve="${esc(o.id)}">Resolver</button><button type="button" class="danger-link" data-admin-delete="${esc(o.id)}">Excluir</button></div>`:`<div class="admin-row-actions"><button type="button" class="danger-link" data-admin-delete="${esc(o.id)}">Excluir</button></div>`;
    return `<article class="admin-occurrence-row"><div class="admin-occurrence-main"><span class="admin-severity-dot ${esc(o.severity||"attention")}"></span><div><b>${esc(typeLabel(o.occurrence_type))}</b><small>${loc} • ${reporter} • ${age(o.created_at)}</small></div><em class="${o.status==="resolved"?"resolved":""}">${status}</em></div>${actions}</article>`;
  }).join(""):'<p class="muted">Nenhuma ocorrência encontrada.</p>';

  const alertsHost=$("#adminAlertsList");
  if(alertsHost)alertsHost.innerHTML=alerts.length?alerts.map(a=>`<article class="admin-alert-row"><span class="admin-severity-dot ${esc(a.severity||"attention")}"></span><div><b>${esc(a.title)}</b><small>${esc(a.message)} • ${age(a.created_at)}</small></div><em>${a.active!==false?"Ativo":"Encerrado"}</em></article>`).join(""):'<p class="muted">Nenhum alerta publicado.</p>';
}

async function publishAdminAlert(event){
  event.preventDefault();
  if(!state.isAdmin)return;
  const title=$("#adminAlertTitle")?.value.trim(),message=$("#adminAlertMessage")?.value.trim(),severity=$("#adminAlertSeverity")?.value||"attention";
  if(!title||!message)return;
  const submit=event.submitter||$("#adminAlertForm button[type=submit]");
  if(submit)submit.disabled=true;
  try{
    const {error}=await db.from("alerts").insert({title,message,severity,source_type:"admin",active:true,created_by:state.user.id,starts_at:new Date().toISOString()});
    if(error)throw error;
    $("#adminAlertForm")?.reset();
    toast("Alerta publicado para a comunidade.");
    await Promise.all([loadAdminData(),loadDataSafe(["alerts"])]);
    renderAlertsPage();
  }catch(error){
    console.error("Falha ao publicar alerta:",error);
    toast("Não foi possível publicar o alerta.");
  }finally{if(submit)submit.disabled=false;}
}

async function adminResolveOccurrence(id){
  if(!state.isAdmin||!id)return;
  const now=new Date().toISOString();
  const {error}=await db.from("occurrences").update({status:"resolved",resolved_at:now,resolved_by:state.user.id}).eq("id",id);
  if(error){console.error(error);toast("Não foi possível resolver a ocorrência.");return;}
  toast("Ocorrência marcada como resolvida.");
  await Promise.all([loadAdminData(),loadDataSafe()]);
  renderAll();
}

async function adminDeleteOccurrence(id){
  if(!state.isAdmin||!id)return;
  if(!confirm("Excluir esta ocorrência permanentemente?"))return;
  const {error}=await db.from("occurrences").delete().eq("id",id);
  if(error){console.error(error);toast("Não foi possível excluir a ocorrência.");return;}
  toast("Ocorrência excluída.");
  await Promise.all([loadAdminData(),loadDataSafe()]);
  renderAll();
}

function occurrencePhotoList(items){
  const out=[],seen=new Set();
  for(const o of items||[]){
    for(const ph of o._photos||[]){
      if(seen.has(ph.id))continue;
      seen.add(ph.id);out.push(ph);
    }
  }
  return out;
}
async function loadOccurrencePhotos(){
  const ids=state.occurrences.map(o=>o.id).filter(Boolean);
  if(!ids.length)return;

  const {data:rows,error}=await db.from("occurrence_photos")
    .select("id,occurrence_id,uploader_id,storage_path,sort_order,width,height,size_bytes,created_at")
    .in("occurrence_id",ids)
    .order("sort_order",{ascending:true})
    .order("created_at",{ascending:true});
  if(error){console.warn("Fotos indisponíveis:",error);return;}

  const paths=[...new Set((rows||[]).map(r=>r.storage_path).filter(Boolean))];
  const signedByPath=new Map();

  if(paths.length){
    try{
      const {data:signedRows,error:signError}=await db.storage
        .from("occurrence-photos")
        .createSignedUrls(paths,6*60*60);
      if(signError)throw signError;
      for(const item of signedRows||[]){
        const path=item.path||item.fullPath;
        if(path&&item.signedUrl)signedByPath.set(path,item.signedUrl);
      }
    }catch(err){
      console.warn("URLs de fotos indisponíveis:",err);
    }
  }

  const byOccurrence=new Map();
  for(const row of rows||[]){
    const photo={...row,url:signedByPath.get(row.storage_path)||null};
    if(!byOccurrence.has(row.occurrence_id))byOccurrence.set(row.occurrence_id,[]);
    byOccurrence.get(row.occurrence_id).push(photo);
  }
  state.occurrences=state.occurrences.map(o=>({...o,_photos:byOccurrence.get(o.id)||[]}));
}

// Each source commits only a successful response; failures retain its last snapshot.
let dataLoadInFlight=null;
async function loadData(keys=["occurrences","recentResolved","alerts"]){
  const now=new Date().toISOString();
  const jobs=[
    ['occurrences',()=>db.from("occurrences").select("*, monitored_locations(name,category)").eq("status","active").gt("expires_at",now).order("created_at",{ascending:false})],
    ['recentResolved',()=>db.from("occurrences").select("*, monitored_locations(name,category)").eq("status","resolved").order("resolved_at",{ascending:false}).limit(8)],
    ['alerts',()=>db.from("alerts").select("*, monitored_locations(name,category)").eq("active",true).or("starts_at.is.null,starts_at.lte."+now).or("ends_at.is.null,ends_at.gt."+now).order("created_at",{ascending:false})]
  ].filter(([key])=>keys.includes(key));
  const results=await Promise.allSettled(jobs.map(async([key,query])=>{
    const {data,error}=await query();
    if(error)throw error;
    state[key]=key==='alerts'?(data||[]):(data||[]).map(hydrateOccurrence);
    state.sourceUpdatedAt={...state.sourceUpdatedAt,[key]:Date.now()};
    return key;
  }));
  state.sourceFailures=state.sourceFailures||{};
  results.forEach((result,i)=>{state.sourceFailures[jobs[i][0]]=result.status==='rejected';});
  state.connectionDegraded=Object.values(state.sourceFailures).some(Boolean);
  for(let i=0;i<results.length;i++)if(results[i].status==='rejected')console.warn('Fonte indisponível:',jobs[i][0]);
  if(results.some((result,i)=>jobs[i][0]==='occurrences'&&result.status==='fulfilled'))await loadOccurrencePhotos().catch(()=>{});
  saveSnapshot();
  renderConnection();
}
async function loadDataSafe(keys){
  if(dataLoadInFlight)return dataLoadInFlight;
  dataLoadInFlight=loadData(keys).catch(e=>{state.connectionDegraded=true;renderConnection();console.warn('Carregamento indisponível',e);}).finally(()=>{dataLoadInFlight=null;});
  return dataLoadInFlight;
}

function fillCondoSelects(){
  const ids=["condominium","editCondominium","loginCondominium","registerCondominium","legacyCondominium"];
  for(const id of ids){
    const el=$("#"+id); if(!el)continue;
    const current=el.value;
    el.innerHTML='<option value="">Selecione</option>'+state.condominiums.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
    if(current)el.value=current;
  }
}

function revokeReportPhotoPreviews(){
  for(const ph of state.reportPhotos){
    if(ph.kind==="new"&&ph.preview){
      try{URL.revokeObjectURL(ph.preview);}catch(_){}
    }
  }
}
function resetReportPhotos(){
  revokeReportPhotoPreviews();
  state.reportPhotos=[];
  state.removedPhotoIds=[];
  renderReportPhotos();
}
function renderReportPhotos(){
  const grid=$("#reportPhotoGrid"),count=$("#photoCount"),actions=$("#reportPhotoActions");
  if(!grid)return;
  const photos=state.reportPhotos.slice(0,3);
  if(count)count.textContent=`${photos.length}/3`;
  grid.innerHTML=photos.map((ph,index)=>{
    const url=ph.preview||ph.url||"";
    return `<div class="report-photo-thumb">
      <img src="${esc(url)}" alt="Foto ${index+1}" data-view-photo="${esc(url)}">
      <button type="button" class="report-photo-remove" data-remove-report-photo="${index}" aria-label="Remover foto">×</button>
    </div>`;
  }).join("");
  if(actions)actions.hidden=photos.length>=3;
}
async function imageElementFromFile(file){
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();
    img.decoding="async";
    await new Promise((resolve,reject)=>{
      img.onload=()=>resolve();
      img.onerror=()=>reject(new Error("IMAGE_DECODE"));
      img.src=url;
    });
    return img;
  }finally{
    URL.revokeObjectURL(url);
  }
}
async function compressPhoto(file){
  if(!file||!String(file.type||"").startsWith("image/"))throw new Error("Selecione uma imagem.");
  if(file.size>20*1024*1024)throw new Error("A foto é muito grande.");

  const img=await imageElementFromFile(file);
  const maxSide=1600;
  const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  const width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
  const height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:false});
  ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
  ctx.drawImage(img,0,0,width,height);

  const toBlob=q=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("IMAGE_ENCODE")),"image/jpeg",q));
  let blob=await toBlob(.82);
  if(blob.size>2.7*1024*1024)blob=await toBlob(.68);
  if(blob.size>2.9*1024*1024)throw new Error("Não consegui reduzir esta foto. Tente outra imagem.");

  return {blob,width,height,size:blob.size,preview:URL.createObjectURL(blob)};
}
async function addReportPhotoFiles(fileList){
  const files=[...(fileList||[])];
  if(!files.length)return;
  let remaining=3-state.reportPhotos.length;
  if(remaining<=0){toast("Você já adicionou 3 fotos.");return;}
  for(const file of files.slice(0,remaining)){
    try{
      const prepared=await compressPhoto(file);
      state.reportPhotos.push({
        kind:"new",
        blob:prepared.blob,
        width:prepared.width,
        height:prepared.height,
        size_bytes:prepared.size,
        preview:prepared.preview
      });
      renderReportPhotos();
    }catch(err){
      console.warn(err);
      toast(err.message||"Não foi possível preparar a foto.");
    }
  }
}
function removeReportPhotoAt(index){
  const ph=state.reportPhotos[index];
  if(!ph)return;
  if(ph.kind==="existing"){
    state.removedPhotoIds.push({id:ph.id,path:ph.storage_path});
  }else if(ph.preview){
    try{URL.revokeObjectURL(ph.preview);}catch(_){}
  }
  state.reportPhotos.splice(index,1);
  renderReportPhotos();
}
function openPhotoViewer(url){
  if(!url)return;
  $("#photoViewerImage").src=url;
  $("#photoViewer").hidden=false;
}
function closePhotoViewer(){
  $("#photoViewer").hidden=true;
  $("#photoViewerImage").removeAttribute("src");
}
async function uploadNewReportPhotos(occurrenceId){
  const fresh=state.reportPhotos.filter(ph=>ph.kind==="new");
  if(!fresh.length)return [];
  const created=[];
  const existingCount=state.reportPhotos.filter(ph=>ph.kind==="existing").length;
  for(let i=0;i<fresh.length;i++){
    const ph=fresh[i];
    const fileName=`${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}.jpg`;
    const path=`${state.user.id}/${occurrenceId}/${fileName}`;
    const {error:uploadError}=await db.storage.from("occurrence-photos").upload(path,ph.blob,{
      contentType:"image/jpeg",
      cacheControl:"3600",
      upsert:false
    });
    if(uploadError)throw uploadError;
    try{
      const {data:row,error:rowError}=await db.from("occurrence_photos").insert({
        occurrence_id:occurrenceId,
        uploader_id:state.user.id,
        storage_path:path,
        sort_order:Math.min(2,existingCount+i),
        width:ph.width,
        height:ph.height,
        size_bytes:ph.size_bytes
      }).select("id,occurrence_id,uploader_id,storage_path,sort_order,width,height,size_bytes,created_at").single();
      if(rowError)throw rowError;
      created.push(row);
    }catch(err){
      await db.storage.from("occurrence-photos").remove([path]).catch(()=>{});
      throw err;
    }
  }
  return created;
}
async function removeMarkedExistingPhotos(){
  if(!state.removedPhotoIds.length)return;
  const paths=state.removedPhotoIds.map(x=>x.path).filter(Boolean);
  if(paths.length){
    const {error}=await db.storage.from("occurrence-photos").remove(paths);
    if(error)throw error;
  }
  const ids=state.removedPhotoIds.map(x=>x.id).filter(Boolean);
  if(ids.length){
    const {error}=await db.from("occurrence_photos").delete().in("id",ids).eq("uploader_id",state.user.id);
    if(error)throw error;
  }
}
async function moveExistingPhotosToOccurrence(occurrenceId){
  const ids=state.reportPhotos.filter(ph=>ph.kind==="existing").map(ph=>ph.id);
  if(!ids.length)return;
  const {error}=await db.from("occurrence_photos")
    .update({occurrence_id:occurrenceId})
    .in("id",ids)
    .eq("uploader_id",state.user.id);
  if(error)throw error;
}



function makeMap(id, preview=false){
  const map=L.map(id,{
    crs:L.CRS.Simple,
    minZoom:preview?-1.45:-1.15,
    maxZoom:2.45,
    zoomControl:!preview,
    attributionControl:false,
    scrollWheelZoom:preview?false:window.matchMedia("(pointer:fine)").matches,
    touchZoom:true,
    doubleClickZoom:true,
    dragging:true,
    tap:true,
    wheelDebounceTime:35,
    wheelPxPerZoomLevel:90,
    maxBounds:MAP_EXTENDED_BOUNDS,
    maxBoundsViscosity:.97,
    zoomSnap:.1,
    zoomDelta:.25,
    fadeAnimation:true,
    markerZoomAnimation:true,
    zoomAnimation:true,
    dragging:true,
    touchZoom:true,
    doubleClickZoom:true,
    boxZoom:!preview,
    keyboard:!preview
  });
  L.imageOverlay("assets/mapa-entorno-fade.webp",MAP_EXTENDED_BOUNDS,{
    interactive:false,className:"map-entourage-layer",opacity:1
  }).addTo(map);
  const overlay=L.imageOverlay("assets/mapa-deltaville-clean.webp",MAP_BOUNDS,{
    interactive:false,className:"map-core-layer"
  }).addTo(map);
  map.fitBounds(MAP_BOUNDS,{padding:[0,0],animate:false});
  overlay.on("load",()=>ensureMapLayout(map,true));
  map.whenReady(()=>setTimeout(()=>ensureMapLayout(map,true),80));
  if(preview)map.on("click",()=>navigate("map"));
  return map;
}
function initMaps(){
  if(state.maps.home)return;
  state.maps.home=makeMap("homeMap",true);
  state.maps.full=makeMap("fullMap",false);
  bindMapPointSelection();
  bindMapUX();
  attachMapResizeObserver();
  renderMapMarkers();
  updateSelectedPointUI();
  updateSegmentUI();
  renderSelectedSegmentLayers();
  setTimeout(()=>ensureMapLayout(state.maps.home,true),90);
}
function coord(loc){
  const anchor=visualAnchors[loc?.name];
  if(anchor)return xyToLatLng(anchor[0],anchor[1]);
  return [MAP_H*(1-Number(loc?.map_y||.5)),MAP_W*Number(loc?.map_x||.5)];
}
function latLngToNormalized(latlng){
  return {
    map_x:Math.max(0,Math.min(1,Number(latlng.lng)/MAP_W)),
    map_y:Math.max(0,Math.min(1,1-(Number(latlng.lat)/MAP_H)))
  };
}
function normalizedToLatLng(x,y){
  return [MAP_H*(1-Number(y)),MAP_W*Number(x)];
}
function precisePointIcon(index=1){
  return L.divIcon({className:"",html:`<div class="precise-pin precise-pin-numbered"><span>${index}</span></div>`,iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-16]});
}
function occurrencePointIcon(severity){
  return L.divIcon({className:"",html:`<div class="occurrence-map-pin ${severity}">!</div>`,iconSize:[22,22],iconAnchor:[11,11],popupAnchor:[0,-12]});
}
function pointToSegmentDistance(p,a,b){
  const ABx=b.lng-a.lng,ABy=b.lat-a.lat,APx=p.lng-a.lng,APy=p.lat-a.lat;
  const ab2=ABx*ABx+ABy*ABy||1;
  let t=(APx*ABx+APy*ABy)/ab2;
  t=Math.max(0,Math.min(1,t));
  const cx=a.lng+t*ABx,cy=a.lat+t*ABy;
  return Math.hypot(p.lng-cx,p.lat-cy);
}
function nearestFeatureForPoint(latlng){
  let best=null;
  const lakeThreshold=58,avenueThreshold=48;
  state.locations.forEach(loc=>{
    if(loc.category==="lake"){
      const c=coord(loc);
      const d=Math.hypot(Number(latlng.lng)-c[1],Number(latlng.lat)-c[0]);
      if(d<=lakeThreshold&&(!best||d<best.distance))best={category:"lake",loc,distance:d};
      return;
    }
    if(loc.category==="avenue"){
      const route=avenueRoutes[loc.name];
      if(!route)return;
      const pts=routeToLatLng(route);
      let min=Infinity;
      for(let i=0;i<pts.length-1;i++){
        min=Math.min(min,pointToSegmentDistance(latlng,{lat:pts[i][0],lng:pts[i][1]},{lat:pts[i+1][0],lng:pts[i+1][1]}));
      }
      if(min<=avenueThreshold&&(!best||min<best.distance))best={category:"avenue",loc,distance:min};
      return;
    }
    if(loc.category==="river"){
      const pts=routeToLatLng(riverRoute);
      let min=Infinity;
      for(let i=0;i<pts.length-1;i++){
        min=Math.min(min,pointToSegmentDistance(latlng,{lat:pts[i][0],lng:pts[i][1]},{lat:pts[i+1][0],lng:pts[i+1][1]}));
      }
      if(min<=58&&(!best||min<best.distance))best={category:"river",loc,distance:min};
    }
  });
  return best;
}
function syncMapBottomUI(){
  const pointHas=state.selectedPoints.length>0;
  const segmentHas=!!state.selectedSegment;
  const focusVisible=!!state.activeMapItem && !$("#mapFocusCard")?.hidden;
  const pointAction=$("#selectedPointAction");
  const segmentAction=$("#selectedSegmentAction");
  const pick=$("#pickPointBtn");

  // Progressive disclosure: never stack bottom controls.
  if(pointAction)pointAction.hidden=!pointHas || segmentHas;
  if(segmentAction)segmentAction.hidden=!segmentHas;
  if(pick)pick.hidden=pointHas || segmentHas || focusVisible;
}

function describeSelectedPoint(){
  const count=state.selectedPoints.length;
  if(!count)return "Nenhum ponto marcado.";
  if(count===1){
    const loc=state.selectedPoints[0].loc;
    return loc?`Ponto em ${loc.name}`:"1 ponto marcado";
  }
  return `${count} pontos marcados`;
}
function setPointPickMode(enabled,options={}){
  state.pointPickMode=enabled;if(options.multi!=null)state.multiPointMode=!!options.multi;
  const btn=$("#pickPointBtn");if(btn)btn.classList.toggle("active",enabled);
  $("#fullMap")?.classList.toggle("point-pick-active",enabled);
  if($("#pickPointText"))$("#pickPointText").textContent=enabled?(state.multiPointMode?"Adicionar pontos":"Toque no mapa"):"Marcar ponto";
  if($("#mapPickHelp"))$("#mapPickHelp").textContent=enabled?(state.multiPointMode?"Marque quantos pontos precisar. Depois toque em “Concluir”.":"Modo de marcação ativo: toque uma vez no ponto exato."):"Segure e arraste sobre uma via para delimitar um trecho.";
}
function renderSelectedPointMarkers(){
  state.selectedPointMarkers.forEach(m=>m.remove());state.selectedPointMarkers=[];
  if(!state.maps.full)return;
  state.selectedPoints.forEach((point,i)=>{
    const marker=L.marker([point.lat,point.lng],{icon:precisePointIcon(i+1),zIndexOffset:1200+i}).addTo(state.maps.full);
    marker.bindTooltip(`Ponto ${i+1}${point.loc?.name?` • ${point.loc.name}`:""}`,{direction:"top",offset:[0,-14]});
    state.selectedPointMarkers.push(marker);
  });
  state.selectedPointMarker=state.selectedPointMarkers.at(-1)||null;
}
function setSelectedPoint(latlng,options={}){
  const near=nearestFeatureForPoint(latlng),n=latLngToNormalized(latlng);
  const point={lat:Number(latlng.lat),lng:Number(latlng.lng),map_x:n.map_x,map_y:n.map_y,loc:near?.loc||null};
  const append=options.append??state.multiPointMode;
  if(append){
    const duplicate=state.selectedPoints.some(p=>Math.hypot(p.lng-point.lng,p.lat-point.lat)<18);
    if(!duplicate)state.selectedPoints.push(point);
  }else state.selectedPoints=[point];
  state.selectedPoint=state.selectedPoints.at(-1)||null;
  if(point.loc&&!state.reportLocationIds.includes(point.loc.id)){
    const currentType=$("#occurrenceType")?.value;
    const compatible=!currentType||(currentType==="avenue_flooding"&&point.loc.category==="avenue")||(currentType==="lakes_full"&&point.loc.category==="lake")||((currentType==="river_level"||currentType==="river_overflow")&&point.loc.category==="river");
    if(compatible)state.reportLocationIds.push(point.loc.id);
  }
  hideMapFocusCard?.();renderSelectedPointMarkers();
  if(!state.multiPointMode)setPointPickMode(false);
  updateSelectedPointUI();renderLocationChips?.();updateReportReadyState?.();
  try{navigator.vibrate?.(25);}catch(_){}
  try{state.maps.full.panInside(latlng,{paddingTopLeft:[35,35],paddingBottomRight:[35,155],animate:true});}catch(_){}
}
function clearSelectedPoint(options={}){
  state.selectedPoint=null;state.selectedPoints=[];
  state.selectedPointMarkers.forEach(m=>m.remove());state.selectedPointMarkers=[];state.selectedPointMarker=null;
  setPointPickMode(false,{multi:false});updateSelectedPointUI();updateReportReadyState?.();
  if(!options.silent)toast("Pontos marcados apagados.");
}
function updateSelectedPointUI(){
  const count=state.selectedPoints.length,has=count>0;
  if($("#clearReportPointBtn"))$("#clearReportPointBtn").hidden=!has;
  if($("#multiPointSummary"))$("#multiPointSummary").textContent=has?`${count} ${count===1?"ponto marcado":"pontos marcados"}`:"Nenhum ponto exato marcado.";
  if(has){
    if($("#selectedPointActionTitle"))$("#selectedPointActionTitle").textContent=count===1?"1 ponto marcado":`${count} pontos marcados`;
    if($("#selectedPointActionText"))$("#selectedPointActionText").textContent=state.multiPointMode?"Marque outros ou conclua":"Pronto para registrar";
    if($("#reportHereBtn"))$("#reportHereBtn").textContent=state.multiPointMode?"Concluir":"Registrar";
    if($("#clearMapPointBtn"))$("#clearMapPointBtn").textContent="Cancelar";
  }
  syncMapBottomUI();
}
function describeSelectedSegment(){
  if(!state.selectedSegment)return "Nenhum trecho delimitado.";
  const loc=avenueLocationById(state.selectedSegment.avenueId);
  return `Trecho delimitado em ${loc?.name||"avenida"}`;
}
function clearSegmentSelection(options={}){
  state.selectedSegment=null;
  state.segmentSelectionLayers.forEach(layer=>layer.remove());
  state.segmentSelectionLayers=[];
  state.segmentPickMode=null;
  updateSegmentUI();
  if(!options.silent)toast("Trecho delimitado apagado.");
}
function renderSelectedSegmentLayers(){
  state.segmentSelectionLayers.forEach(layer=>layer.remove());
  state.segmentSelectionLayers=[];
  const map=state.maps.full;
  const seg=state.selectedSegment;
  if(!map||!seg)return;
  const pts=avenuePointsByLocationId(seg.avenueId);
  if(!pts)return;
  const section=selectedSegmentRoute(pts,seg);
  const halo=L.polyline(section,{color:'#FFFFFF',weight:18,opacity:.84,lineCap:'round',lineJoin:'round',interactive:false}).addTo(map);
  const band=L.polyline(section,{color:'#0A84FF',weight:11,opacity:.94,lineCap:'round',lineJoin:'round',interactive:false,className:'selected-segment-band'}).addTo(map);
  const wave=L.polyline(section,{color:'#73C6FF',weight:3.2,opacity:.92,lineCap:'round',lineJoin:'round',interactive:false,className:'selected-segment-wave'}).addTo(map);
  const start=pointAtRouteRatio(pts,seg.startRatio);
  const end=pointAtRouteRatio(pts,seg.endRatio);
  const startHandle=L.marker(start,{draggable:true,icon:L.divIcon({className:'',html:'<div class="segment-handle start"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);
  const endHandle=L.marker(end,{draggable:true,icon:L.divIcon({className:'',html:'<div class="segment-handle end"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);
  const syncHandle=(which, marker)=>{
    marker.on('drag',ev=>{
      const proj=projectPointOnRoute(ev.target.getLatLng(),pts);
      ev.target.setLatLng(proj.latlng);
      if(routeIsClosed(pts)){
        const currentSpan=Number.isFinite(Number(state.selectedSegment.span))
          ?Number(state.selectedSegment.span)
          :shortestLoopSpan(state.selectedSegment.startRatio,state.selectedSegment.endRatio);
        if(which==='end'){
          const currentEndContinuous=Number(state.selectedSegment.startRatio)+currentSpan;
          const newEndContinuous=unwrapRouteRatio(proj.ratio,currentEndContinuous);
          state.selectedSegment.span=clampLoopSpan(newEndContinuous-Number(state.selectedSegment.startRatio));
          state.selectedSegment.endRatio=normalizeRouteRatio(newEndContinuous);
        }else{
          const currentStart=Number(state.selectedSegment.startRatio);
          const currentEndContinuous=currentStart+currentSpan;
          const newStartContinuous=unwrapRouteRatio(proj.ratio,currentStart);
          state.selectedSegment.startRatio=normalizeRouteRatio(newStartContinuous);
          state.selectedSegment.span=clampLoopSpan(currentEndContinuous-newStartContinuous);
          state.selectedSegment.endRatio=normalizeRouteRatio(currentEndContinuous);
        }
        state.selectedSegment.wrap=selectionCrossesLoopSeam(state.selectedSegment.startRatio,state.selectedSegment.span);
      }else{
        if(which==='start') state.selectedSegment.startRatio=proj.ratio;
        else state.selectedSegment.endRatio=proj.ratio;
        state.selectedSegment.span=state.selectedSegment.endRatio-state.selectedSegment.startRatio;
        state.selectedSegment.wrap=false;
      }
      const selectedRoute=selectedSegmentRoute(pts,state.selectedSegment);
      band.setLatLngs(selectedRoute);
      halo.setLatLngs(selectedRoute);
      wave.setLatLngs(selectedRoute);
      updateSegmentUI();
    });
    marker.on('dragend',()=>{ renderSelectedSegmentLayers(); updateSegmentUI(); });
  };
  syncHandle('start',startHandle);
  syncHandle('end',endHandle);
  state.segmentSelectionLayers.push(halo,band,wave,startHandle,endHandle);
}
function updateSegmentUI(){
  const has=!!state.selectedSegment;
  if($('#clearSegmentBtn')) $('#clearSegmentBtn').hidden=!has;
  if($('#selectedSegmentActionTitle')) $('#selectedSegmentActionTitle').textContent=has?'Trecho marcado':'Trecho marcado';
  if($('#selectedSegmentActionText')) $('#selectedSegmentActionText').textContent=state.segmentPickMode?.active?'Toque no início e no fim':'Pronto para registrar';
  syncMapBottomUI();
}
function startSegmentPickFromReport(){
  const ids=state.reportLocationIds.filter(id=>id!=="other");
  if(ids.length!==1){ toast('Para delimitar um trecho, selecione somente uma avenida.'); return; }
  const locationId=ids[0];
  const loc=avenueLocationById(locationId);
  if(!loc){ toast('Escolha uma avenida monitorada.'); return; }
  if(state.selectedSegment?.avenueId!==loc.id) clearSegmentSelection({silent:true});
  state.segmentPickMode={active:true, avenueId:loc.id, step: state.selectedSegment ? 'end' : 'start', fromReport:true};
  closeModal('reportModal');
  navigate('map');
  updateSegmentUI();
  toast(state.selectedSegment ? 'Toque no novo final do trecho.' : 'Toque no início do alagamento. Depois toque no final.');
}
function finishSegmentSelection(){
  state.segmentPickMode=null;
  renderSelectedSegmentLayers();
  updateSegmentUI();
}
function setSelectedSegmentPoint(latlng){
  const pick=state.segmentPickMode;
  if(!pick?.active)return;
  const pts=avenuePointsByLocationId(pick.avenueId);
  if(!pts){ toast('Não foi possível localizar a avenida.'); return; }
  const proj=projectPointOnRoute(latlng,pts);
  if(!state.selectedSegment || String(state.selectedSegment.avenueId)!==String(pick.avenueId)){
    state.selectedSegment={avenueId:pick.avenueId,startRatio:proj.ratio,endRatio:proj.ratio,span:0,wrap:false};
  }
  if(pick.step==='start'){
    state.selectedSegment.startRatio=proj.ratio;
    state.selectedSegment.endRatio=proj.ratio;
    state.selectedSegment.span=0;
    state.selectedSegment.wrap=false;
    state.segmentPickMode.step='end';
    renderSelectedSegmentLayers();
    updateSegmentUI();
    toast('Agora toque no final do trecho alagado.');
    return;
  }
  state.selectedSegment.endRatio=proj.ratio;
  state.selectedSegment.span=routeIsClosed(pts)
    ?shortestLoopSpan(state.selectedSegment.startRatio,proj.ratio)
    :proj.ratio-state.selectedSegment.startRatio;
  state.selectedSegment.wrap=routeIsClosed(pts)
    ?selectionCrossesLoopSeam(state.selectedSegment.startRatio,state.selectedSegment.span)
    :false;
  finishSegmentSelection();
  toast('Trecho delimitado. Você pode ajustar pelas alças.');
  setTimeout(()=>{
    if(!state.reportLocationIds.includes(pick.avenueId))state.reportLocationIds.push(pick.avenueId);
    setOccurrenceType('avenue_flooding',{keepLocations:true});
    openReport('map');
    $("#manualReportFields").hidden=false;renderLocationChips();updateReportReadyState();
  },180);
}
function prefillOccurrenceFromSelectedPoint(){
  const loc=state.selectedPoint?.loc;if(!loc)return;
  const type=loc.category==="avenue"?"avenue_flooding":loc.category==="lake"?"lakes_full":loc.category==="river"?"river_level":"";
  if(!type)return;
  if(!state.reportLocationIds.includes(loc.id))state.reportLocationIds.push(loc.id);
  setOccurrenceType(type,{keepLocations:true});
}
function bindMapPointSelection(){
  if(state.mapInteractionBound||!state.maps.full)return;
  state.mapInteractionBound=true;
  const map=state.maps.full;
  const container=map.getContainer();
  let suppressClickUntil=0;
  let touchGesture=null;
  let mouseGesture=null;

  const clientToLatLng=(x,y)=>{
    const rect=container.getBoundingClientRect();
    return map.containerPointToLatLng(L.point(x-rect.left,y-rect.top));
  };

  const restoreMapGestures=()=>{
    try{map.dragging.enable();}catch(_){}
    try{map.touchZoom.enable();}catch(_){}
    try{map.doubleClickZoom.enable();}catch(_){}
    container.classList.remove("road-drag-selecting");
  };

  const removeLiveLayers=gesture=>{
    for(const layer of gesture?.liveLayers||[]){
      try{layer.remove();}catch(_){}
    }
    if(gesture)gesture.liveLayers=[];
  };

  const updateLiveRoadSelection=(gesture,latlng)=>{
    if(!gesture?.active||!gesture.avenue)return;
    const projection=projectPointOnRoute(latlng,gesture.avenue.pts);
    gesture.currentProjection=projection;
    const closed=routeIsClosed(gesture.avenue.pts);
    let span=projection.ratio-gesture.startProjection.ratio;
    if(closed){
      const previous=Number.isFinite(gesture.lastContinuousRatio)?gesture.lastContinuousRatio:gesture.startProjection.ratio;
      const continuous=unwrapRouteRatio(projection.ratio,previous);
      gesture.lastContinuousRatio=continuous;
      span=clampLoopSpan(continuous-gesture.startProjection.ratio);
    }
    const endRatio=closed?normalizeRouteRatio(gesture.startProjection.ratio+span):projection.ratio;
    const wrap=closed?selectionCrossesLoopSeam(gesture.startProjection.ratio,span):false;
    state.selectedSegment={
      avenueId:gesture.avenue.loc.id,
      startRatio:gesture.startProjection.ratio,
      endRatio,
      span,
      wrap
    };
    const section=selectedSegmentRoute(gesture.avenue.pts,state.selectedSegment);
    if(!gesture.liveLayers?.length){
      const halo=L.polyline(section,{
        color:"#FFFFFF",weight:24,opacity:.72,lineCap:"round",lineJoin:"round",
        interactive:false,className:"road-drag-halo"
      }).addTo(map);
      const band=L.polyline(section,{
        color:"#0A84FF",weight:16,opacity:.46,lineCap:"round",lineJoin:"round",
        interactive:false,className:"road-drag-band"
      }).addTo(map);
      const core=L.polyline(section,{
        color:"#65D5FF",weight:7,opacity:.95,lineCap:"round",lineJoin:"round",
        interactive:false,className:"road-drag-core"
      }).addTo(map);
      gesture.liveLayers=[halo,band,core];
    }else{
      gesture.liveLayers.forEach(layer=>layer.setLatLngs(section));
    }
    const delta=Math.abs(Number(state.selectedSegment?.span)||0);
    gesture.dragged=delta>.006;
    if($("#selectedSegmentActionTitle"))$("#selectedSegmentActionTitle").textContent=gesture.avenue.loc.name;
    if($("#selectedSegmentActionText"))$("#selectedSegmentActionText").textContent=gesture.dragged?"Solte para marcar este trecho":"Arraste pela via";
  };

  const activateLongPress=(gesture)=>{
    if(!gesture||gesture.cancelled)return;
    const latlng=clientToLatLng(gesture.startX,gesture.startY);
    const avenue=nearestAvenueProjection(latlng,52);
    gesture.active=true;
    gesture.startLatLng=latlng;
    gesture.avenue=avenue;
    suppressClickUntil=Date.now()+900;

    try{map.dragging.disable();}catch(_){}
    try{map.touchZoom.disable();}catch(_){}
    try{map.doubleClickZoom.disable();}catch(_){}
    container.classList.add("road-drag-selecting");
    hideMapFocusCard?.();

    if(avenue){
      clearSelectedPoint({silent:true});
      clearSegmentSelection({silent:true});
      gesture.startProjection=avenue.projection;
      gesture.currentProjection=avenue.projection;
      gesture.lastContinuousRatio=avenue.projection.ratio;
      gesture.liveLayers=[];
      state.selectedSegment={
        avenueId:avenue.loc.id,
        startRatio:avenue.projection.ratio,
        endRatio:avenue.projection.ratio,
        span:0,
        wrap:false
      };
      if(!state.reportLocationIds.includes(avenue.loc.id))state.reportLocationIds.push(avenue.loc.id);
      if($("#selectedSegmentAction"))$("#selectedSegmentAction").hidden=false;
      if($("#selectedSegmentActionTitle"))$("#selectedSegmentActionTitle").textContent=avenue.loc.name;
      if($("#selectedSegmentActionText"))$("#selectedSegmentActionText").textContent="Arraste pela via";
      try{navigator.vibrate?.(18);}catch(_){}
    }else{
      gesture.pointOnly=true;
      try{navigator.vibrate?.(12);}catch(_){}
    }
  };

  const finishLongPress=(gesture,endX,endY)=>{
    clearTimeout(gesture?.timer);
    if(!gesture)return false;
    if(!gesture.active)return false;

    suppressClickUntil=Date.now()+700;
    if(gesture.avenue){
      const endLatLng=clientToLatLng(endX??gesture.startX,endY??gesture.startY);
      updateLiveRoadSelection(gesture,endLatLng);
      removeLiveLayers(gesture);

      if(gesture.dragged){
        state.segmentPickMode=null;
        renderSelectedSegmentLayers();
        updateSegmentUI();
        if($("#selectedSegmentActionTitle"))$("#selectedSegmentActionTitle").textContent=gesture.avenue.loc.name;
        if($("#selectedSegmentActionText"))$("#selectedSegmentActionText").textContent="Trecho delimitado • ajuste pelas alças";
        toast(`Trecho marcado em ${gesture.avenue.loc.name}.`);
        try{navigator.vibrate?.([12,24,12]);}catch(_){}
      }else{
        clearSegmentSelection({silent:true});
        setSelectedPoint(gesture.startLatLng);
      }
    }else{
      setSelectedPoint(gesture.startLatLng);
    }

    restoreMapGestures();
    return true;
  };

  const cancelGesture=gesture=>{
    if(!gesture)return;
    clearTimeout(gesture.timer);
    gesture.cancelled=true;
    removeLiveLayers(gesture);
    if(gesture.active&&gesture.avenue&&!gesture.dragged){
      clearSegmentSelection({silent:true});
    }
    restoreMapGestures();
  };

  map.on("click",e=>{
    if(Date.now()<suppressClickUntil)return;
    if(state.segmentPickMode?.active){setSelectedSegmentPoint(e.latlng);return;}
    if(!state.pointPickMode)return;
    setSelectedPoint(e.latlng);
  });

  map.on("contextmenu",e=>{
    if(e.originalEvent?.preventDefault)e.originalEvent.preventDefault();
    if(state.segmentPickMode?.active){setSelectedSegmentPoint(e.latlng);return;}
    const avenue=nearestAvenueProjection(e.latlng,46);
    if(avenue){
      clearSelectedPoint({silent:true});
      clearSegmentSelection({silent:true});
      state.selectedSegment={avenueId:avenue.loc.id,startRatio:avenue.projection.ratio,endRatio:avenue.projection.ratio,span:0,wrap:false};
      renderSelectedSegmentLayers();
      updateSegmentUI();
    }else setSelectedPoint(e.latlng);
  });

  // iPhone/iPad/Android: hold ~430 ms, then drag. During the active gesture
  // map panning is suspended and the selection snaps to the detected avenue.
  container.addEventListener("touchstart",ev=>{
    if(ev.touches.length!==1||ev.target.closest(".leaflet-control"))return;
    const t=ev.touches[0];
    touchGesture={
      startX:t.clientX,startY:t.clientY,lastX:t.clientX,lastY:t.clientY,
      active:false,cancelled:false,dragged:false,liveLayers:[]
    };
    touchGesture.timer=setTimeout(()=>activateLongPress(touchGesture),430);
  },{passive:true});

  container.addEventListener("touchmove",ev=>{
    if(!touchGesture||ev.touches.length!==1)return;
    const t=ev.touches[0];
    touchGesture.lastX=t.clientX;touchGesture.lastY=t.clientY;
    const moved=Math.hypot(t.clientX-touchGesture.startX,t.clientY-touchGesture.startY);

    if(!touchGesture.active){
      if(moved>13){
        clearTimeout(touchGesture.timer);
        touchGesture.cancelled=true;
        touchGesture=null;
      }
      return;
    }

    // Once long-press is active, finger movement belongs to route selection,
    // not to Leaflet's pan gesture.
    ev.preventDefault();
    if(touchGesture.avenue){
      updateLiveRoadSelection(touchGesture,clientToLatLng(t.clientX,t.clientY));
    }
  },{passive:false});

  container.addEventListener("touchend",ev=>{
    if(!touchGesture)return;
    const t=ev.changedTouches?.[0];
    const gesture=touchGesture;
    touchGesture=null;
    if(gesture.cancelled){cancelGesture(gesture);return;}
    finishLongPress(gesture,t?.clientX??gesture.lastX,t?.clientY??gesture.lastY);
  },{passive:false});

  container.addEventListener("touchcancel",()=>{
    const gesture=touchGesture;touchGesture=null;cancelGesture(gesture);
  },{passive:false});

  // Mouse/pen: same hold-and-drag behavior.
  if(!("ontouchstart" in window)){
    container.addEventListener("pointerdown",ev=>{
      if(ev.button!==0||ev.target.closest(".leaflet-control"))return;
      mouseGesture={
        startX:ev.clientX,startY:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,
        active:false,cancelled:false,dragged:false,liveLayers:[],pointerId:ev.pointerId
      };
      mouseGesture.timer=setTimeout(()=>activateLongPress(mouseGesture),430);
    },{passive:true});

    container.addEventListener("pointermove",ev=>{
      if(!mouseGesture)return;
      mouseGesture.lastX=ev.clientX;mouseGesture.lastY=ev.clientY;
      const moved=Math.hypot(ev.clientX-mouseGesture.startX,ev.clientY-mouseGesture.startY);
      if(!mouseGesture.active){
        if(moved>13){clearTimeout(mouseGesture.timer);mouseGesture=null;}
        return;
      }
      if(mouseGesture.avenue)updateLiveRoadSelection(mouseGesture,clientToLatLng(ev.clientX,ev.clientY));
    },{passive:true});

    container.addEventListener("pointerup",ev=>{
      const gesture=mouseGesture;mouseGesture=null;
      if(!gesture)return;
      finishLongPress(gesture,ev.clientX,ev.clientY);
    },{passive:true});

    container.addEventListener("pointercancel",()=>{
      const gesture=mouseGesture;mouseGesture=null;cancelGesture(gesture);
    },{passive:true});

    container.addEventListener("pointerleave",ev=>{
      if(!mouseGesture||!mouseGesture.active)return;
      const gesture=mouseGesture;mouseGesture=null;
      finishLongPress(gesture,ev.clientX,ev.clientY);
    },{passive:true});
  }
}
function renderOccurrencePointMarkers(){
  for(const which of ["home","full"]){
    (state.occurrencePointMarkers[which]||[]).forEach(m=>m.remove());
    state.occurrencePointMarkers[which]=[];
    (state.eventLayers[which]||[]).forEach(l=>l.remove());
    state.eventLayers[which]=[];

    const map=state.maps[which];
    if(!map)continue;

    state.occurrences.forEach(o=>{
      const category=o.monitored_locations?.category||"";
      const isAvenue=category==="avenue" || o.occurrence_type==="avenue_flooding";
      const meta=o._meta||null;
      const note=noteText(o);

      if(isAvenue && meta?.mode==='segment' && o.location_id){
        const pts=avenuePointsByLocationId(o.location_id);
        if(pts){
          const latlngs=selectedSegmentRoute(pts,{startRatio:meta.startRatio,endRatio:meta.endRatio,span:Number.isFinite(Number(meta.span))?Number(meta.span):undefined,wrap:!!meta.wrap});
          const color=o.severity==="critical"?"#E13B4B":o.severity==="alert"?"#F27A2C":"#F4B740";
          const halo=L.polyline(latlngs,{color:'#FFFFFF',weight:20,opacity:.70,lineCap:'round',interactive:false}).addTo(map);
          const flood=L.polyline(latlngs,{color,weight:14,opacity:.62,lineCap:'round',interactive:false,className:`flood-segment flood-${o.severity}`}).addTo(map);
          const water=L.polyline(latlngs,{color:'#36C7F4',weight:9,opacity:.78,dashArray:'9 11',lineCap:'round',interactive:false,className:'flood-wave'}).addTo(map);
          const hit=L.polyline(latlngs,{color:'#000',weight:26,opacity:0,interactive:true,className:'map-hit-target'}).addTo(map);
          const mid=selectedSegmentMidpoint(pts,{startRatio:meta.startRatio,endRatio:meta.endRatio,span:Number.isFinite(Number(meta.span))?Number(meta.span):undefined,wrap:!!meta.wrap});
          const popup=`<div class="popup"><h4>${esc(occurrenceLabels[o.occurrence_type]||"Ocorrência")}</h4><p><b>${esc(locationName(o))}</b></p><p class="statusline">${severityLabels[o.severity]||o.severity} • trecho delimitado</p>${note?`<p>${esc(note)}</p>`:''}<p>${age(o.created_at)}</p></div>`;
          const marker=L.marker(mid,{icon:occurrencePointIcon(o.severity),zIndexOffset:900}).addTo(map).bindPopup(popup);
          const payload={
            title:occurrenceLabels[o.occurrence_type]||"Ocorrência",
            description:note||"Trecho alagado delimitado no mapa.",
            status:o.severity||"alert",
            category:'occurrence',
            locationId:o.location_id||null,
            typeLabel:'Trecho alagado',
            timeLabel:age(o.created_at),
            photos:o._photos||[]
          };
          const openDetails=()=>{
            if(which==='home'){ navigate('map'); setTimeout(()=>showMapFocusCard(payload),120); }
            else showMapFocusCard(payload);
          };
          hit.on('click',openDetails);
          marker.on('click',openDetails);
          state.eventLayers[which].push(halo,flood,water,hit);
          state.occurrencePointMarkers[which].push(marker);
        }
        return;
      }

      if(o.exact_map_x==null||o.exact_map_y==null){
        if(!o.location_id)return;
        const loc=locationById(o.location_id);if(!loc)return;
        const latlng=coord(loc);
        const popup=`<div class="popup"><h4>${esc(occurrenceLabels[o.occurrence_type]||"Ocorrência")}</h4><p><b>${esc(locationName(o))}</b></p><p class="statusline">${severityLabels[o.severity]||o.severity}</p>${note?`<p>${esc(note)}</p>`:""}<p>${age(o.created_at)}</p></div>`;
        const m=L.marker(latlng,{icon:occurrencePointIcon(o.severity),zIndexOffset:880}).addTo(map).bindPopup(popup);
        m.on("click",()=>{const payload={title:occurrenceLabels[o.occurrence_type]||"Ocorrência",description:note||`${locationName(o)} • ${severityLabels[o.severity]||o.severity}`,status:o.severity||"alert",category:"occurrence",locationId:o.location_id,typeLabel:"Local informado",timeLabel:age(o.created_at),photos:o._photos||[]};if(which==="home"){navigate("map");setTimeout(()=>showMapFocusCard(payload),120);}else showMapFocusCard(payload);});
        state.occurrencePointMarkers[which].push(m);return;
      }
      const latlng=normalizedToLatLng(o.exact_map_x,o.exact_map_y);

      if(isAvenue){
        const zone=L.circleMarker(latlng,{
          radius:25,
          color:o.severity==="critical"?"#E13B4B":o.severity==="alert"?"#F27A2C":"#F4B740",
          weight:3,
          opacity:.82,
          fillColor:'#3B9DEB',
          fillOpacity:.18,
          dashArray:'5 7',
          interactive:false,
          className:`occurrence-road-zone occurrence-road-${o.severity}`
        }).addTo(map);

        const centerZone=L.circleMarker(latlng,{
          radius:11,
          color:'#FFFFFF',
          weight:2,
          opacity:.95,
          fillColor:o.severity==="critical"?"#E13B4B":o.severity==="alert"?"#F27A2C":"#F4B740",
          fillOpacity:.28,
          interactive:false,
          className:'occurrence-road-core'
        }).addTo(map);

        state.eventLayers[which].push(zone,centerZone);
      }

      const popup=`<div class="popup"><h4>${esc(occurrenceLabels[o.occurrence_type]||"Ocorrência")}</h4><p><b>${esc(locationName(o))}</b></p><p class="statusline">${severityLabels[o.severity]||o.severity} • ponto exato</p>${note?`<p>${esc(note)}</p>`:''}<p>${age(o.created_at)}</p></div>`;
      const m=L.marker(latlng,{icon:occurrencePointIcon(o.severity),zIndexOffset:900}).addTo(map).bindPopup(popup);

      m.on('click',()=>{
        const payload={
          title:occurrenceLabels[o.occurrence_type]||'Ocorrência',
          description:note||'Ocorrência com ponto exato registrado no mapa.',
          status:o.severity||'alert',
          category:'occurrence',
          locationId:o.location_id||null,
          typeLabel:'Ocorrência ativa',
          timeLabel:age(o.created_at),
          photos:o._photos||[]
        };
        if(which==='home'){navigate('map');setTimeout(()=>showMapFocusCard(payload),120);}
        else showMapFocusCard(payload);
      });

      state.occurrencePointMarkers[which].push(m);
    });
  }
}
function statusForLocation(id){
  const occ=state.occurrences.filter(o=>o.location_id===id);
  const al=state.alerts.filter(a=>a.location_id===id);
  return highestSeverity([...occ,...al]);
}
function markerHtml(loc,status,hasOccurrence=false){
  return `<div class="lake-marker ${status} ${hasOccurrence?"lake-marker-event":""}" title="${esc(loc.name)}"><span>≈</span></div>`;
}
function markerIcon(loc,status,hasOccurrence=false){
  return L.divIcon({className:"",html:markerHtml(loc,status,hasOccurrence),iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-20]});
}

const avenueRoutes={
  /* Geometria de snap: os cruzamentos compartilham o mesmo nó.
     A Av. Deltaville é um circuito fechado ao redor do canteiro/lagos centrais. */
  "Av. Egídio Abelino Richartz":[
    [120,282],[120,326],[120,372],[120,420],[120,470],[120,520],[120,570],[120,620],[120,675]
  ],
  "Av. Wilson Castelo Branco":[
    [120,282],[210,282],[300,282],[390,282],[480,282],[570,282],[650,282],
    [740,282],[830,282],[920,282],[1010,282],[1100,282],[1138,282]
  ],
  "Av. Deltaville":[
    [650,282],
    [622,288],[602,304],[590,330],
    [586,380],[586,435],[586,490],[586,545],[586,600],[586,655],[586,710],[586,765],[592,810],
    [604,834],[624,848],[650,853],
    [676,848],[696,834],[708,810],
    [714,765],[714,710],[714,655],[714,600],[714,545],[714,490],[714,435],[714,380],[710,330],
    [698,304],[678,288],[650,282]
  ],
  "Av. Beira Rio":[
    [1138,282],[1138,330],[1138,378],[1138,426],[1138,474],[1138,522],[1138,570],
    [1138,618],[1138,666],[1138,714],[1138,762],[1138,810],[1138,840]
  ]
};
const riverRoute=[
  [1573,302],[1578,370],[1575,450],[1571,535],[1577,620],[1573,710],[1569,805],[1562,895]
];
function routeToLatLng(points){
  return points.map(([x,y])=>xyToLatLng(x,y));
}
function routeLength(points){
  let total=0;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    total+=Math.hypot(b[1]-a[1],b[0]-a[0]);
  }
  return total||1;
}
function projectPointOnRoute(latlng,points){
  const p={lat:Number(latlng.lat),lng:Number(latlng.lng)};
  let best={distance:Infinity,ratio:0,latlng:L.latLng(points[0][0],points[0][1])};
  let walked=0;
  const total=routeLength(points);
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    const ABx=b[1]-a[1],ABy=b[0]-a[0];
    const APx=p.lng-a[1],APy=p.lat-a[0];
    const ab2=ABx*ABx+ABy*ABy||1;
    const segLen=Math.sqrt(ab2);
    const t=clamp((APx*ABx+APy*ABy)/ab2,0,1);
    const proj=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    const d=Math.hypot(p.lng-proj[1],p.lat-proj[0]);
    if(d<best.distance){
      best={
        distance:d,
        ratio:clamp((walked+segLen*t)/total,0,1),
        latlng:L.latLng(proj[0],proj[1]),
        segmentIndex:i
      };
    }
    walked+=segLen;
  }
  return best;
}
function pointAtRouteRatio(points, ratio){
  const wanted=clamp(Number(ratio)||0,0,1)*routeLength(points);
  let walked=0;
  for(let i=0;i<points.length-1;i++){
    const a=points[i], b=points[i+1];
    const segLen=Math.hypot(b[1]-a[1],b[0]-a[0]);
    if(wanted<=walked+segLen || i===points.length-2){
      const t=segLen?clamp((wanted-walked)/segLen,0,1):0;
      return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
    }
    walked+=segLen;
  }
  return points[points.length-1];
}
function subRoute(points, startRatio, endRatio){
  let a=clamp(Number(startRatio)||0,0,1), b=clamp(Number(endRatio)||0,0,1);
  if(b<a)[a,b]=[b,a];
  const startDist=a*routeLength(points);
  const endDist=b*routeLength(points);
  let walked=0;
  const out=[];
  for(let i=0;i<points.length-1;i++){
    const p1=points[i], p2=points[i+1];
    const segLen=Math.hypot(p2[1]-p1[1],p2[0]-p1[0]);
    const segStart=walked, segEnd=walked+segLen;
    if(segEnd<startDist){ walked=segEnd; continue; }
    if(segStart>endDist) break;
    const localStart=clamp((startDist-segStart)/(segLen||1),0,1);
    const localEnd=clamp((endDist-segStart)/(segLen||1),0,1);
    const startPoint=[p1[0]+(p2[0]-p1[0])*localStart,p1[1]+(p2[1]-p1[1])*localStart];
    const endPoint=[p1[0]+(p2[0]-p1[0])*localEnd,p1[1]+(p2[1]-p1[1])*localEnd];
    if(!out.length) out.push(startPoint);
    if(localStart<1 && localStart>0 && (out[out.length-1][0]!==startPoint[0]||out[out.length-1][1]!==startPoint[1])) out.push(startPoint);
    if(localEnd===1 && segEnd<=endDist){
      if(out[out.length-1][0]!==p2[0]||out[out.length-1][1]!==p2[1]) out.push(p2);
    }else{
      if(out[out.length-1][0]!==endPoint[0]||out[out.length-1][1]!==endPoint[1]) out.push(endPoint);
      break;
    }
    walked=segEnd;
  }
  if(out.length<2){
    const start=pointAtRouteRatio(points,a), end=pointAtRouteRatio(points,b);
    return [start,end];
  }
  return out;
}
function midpointRatio(a,b){ return (Math.min(a,b)+Math.max(a,b))/2; }
function routeIsClosed(points){
  if(!points||points.length<3)return false;
  const a=points[0],b=points[points.length-1];
  return Math.hypot(Number(a[0])-Number(b[0]),Number(a[1])-Number(b[1]))<2;
}
function segmentUsesWrap(points,a,b){
  return routeIsClosed(points)&&Math.abs(Number(a)-Number(b))>.5;
}
function subRouteSelection(points,startRatio,endRatio,wrap=false){
  if(!wrap)return subRoute(points,startRatio,endRatio);
  let a=clamp(Number(startRatio)||0,0,1),b=clamp(Number(endRatio)||0,0,1);
  const low=Math.min(a,b),high=Math.max(a,b);
  const first=subRoute(points,high,1);
  const second=subRoute(points,0,low);
  if(!first.length)return second;
  if(!second.length)return first;
  const out=[...first];
  const last=out[out.length-1],head=second[0];
  if(Math.hypot(last[0]-head[0],last[1]-head[1])<1)out.push(...second.slice(1));
  else out.push(...second);
  return out;
}
function segmentMidpointLatLng(points,startRatio,endRatio,wrap=false){
  const section=subRouteSelection(points,startRatio,endRatio,wrap);
  if(!section?.length)return pointAtRouteRatio(points,midpointRatio(startRatio,endRatio));
  return pointAtRouteRatio(section,.5);
}
function normalizeRouteRatio(value){
  const n=Number(value)||0;
  return ((n%1)+1)%1;
}
function unwrapRouteRatio(raw,previousContinuous){
  const r=normalizeRouteRatio(raw);
  if(!Number.isFinite(previousContinuous))return r;
  const candidates=[r-2,r-1,r,r+1,r+2];
  return candidates.reduce((best,value)=>Math.abs(value-previousContinuous)<Math.abs(best-previousContinuous)?value:best,candidates[0]);
}
function clampLoopSpan(span){
  const n=Number(span)||0;
  return clamp(n,-.985,.985);
}
function selectionCrossesLoopSeam(startRatio,span){
  const end=Number(startRatio)+Number(span||0);
  return end<0||end>1;
}
function selectedRouteFromSpan(points,startRatio,span){
  if(!routeIsClosed(points))return subRoute(points,startRatio,normalizeRouteRatio(Number(startRatio)+Number(span||0)));
  const start=normalizeRouteRatio(startRatio);
  const amount=clampLoopSpan(span);
  if(Math.abs(amount)<.0001){
    const p=pointAtRouteRatio(points,start);
    return [p,p];
  }
  const endContinuous=start+amount;
  if(amount>0){
    if(endContinuous<=1)return subRoute(points,start,endContinuous);
    const first=subRoute(points,start,1);
    const second=subRoute(points,0,normalizeRouteRatio(endContinuous));
    return first.concat(second.slice(1));
  }
  if(endContinuous>=0)return subRoute(points,endContinuous,start).reverse();
  const first=subRoute(points,0,start).reverse();
  const second=subRoute(points,normalizeRouteRatio(endContinuous),1).reverse();
  return first.concat(second.slice(1));
}
function selectedSegmentRoute(points,segment){
  if(!segment)return [];
  if(routeIsClosed(points)&&Number.isFinite(Number(segment.span))){
    return selectedRouteFromSpan(points,segment.startRatio,Number(segment.span));
  }
  return subRouteSelection(points,segment.startRatio,segment.endRatio,!!segment.wrap);
}
function selectedSegmentMidpoint(points,segment){
  const section=selectedSegmentRoute(points,segment);
  if(!section?.length)return pointAtRouteRatio(points,midpointRatio(segment.startRatio,segment.endRatio));
  return pointAtRouteRatio(section,.5);
}
function shortestLoopSpan(startRatio,endRatio){
  const start=normalizeRouteRatio(startRatio),end=normalizeRouteRatio(endRatio);
  let delta=end-start;
  if(delta>.5)delta-=1;
  if(delta<-.5)delta+=1;
  return delta;
}
function avenueLocationById(id){
  return state.locations.find(l=>String(l.id)===String(id) && l.category==='avenue')||null;
}
function avenuePointsByLocationId(id){
  const loc=avenueLocationById(id);
  if(!loc)return null;
  const route=avenueRoutes[loc.name];
  return route?routeToLatLng(route):null;
}

function nearestAvenueProjection(latlng,maxDistance=46){
  let best=null;
  for(const loc of state.locations.filter(item=>item.category==="avenue")){
    const pts=avenuePointsByLocationId(loc.id);
    if(!pts||pts.length<2)continue;
    const projection=projectPointOnRoute(latlng,pts);
    if(projection.distance<=maxDistance&&(!best||projection.distance<best.projection.distance)){
      best={loc,pts,projection};
    }
  }
  return best;
}

const lakeZones={
  "Lagos Av. Deltaville":[
    {type:"polygon",points:[[620,367],[631,355],[646,361],[653,382],[651,449],[642,474],[624,473],[616,454],[614,404]]},
    {type:"polygon",points:[[622,525],[638,520],[649,535],[653,565],[651,653],[642,688],[624,687],[615,666],[614,565]]}
  ],
  "Lagos Av. Comercial":[
    {type:"polygon",points:[[1267,269],[1305,269],[1297,410],[1264,420]]},
    {type:"polygon",points:[[1362,270],[1408,271],[1387,407],[1350,418]]},
    {type:"polygon",points:[[1264,421],[1294,417],[1293,570],[1262,573]]},
    {type:"polygon",points:[[1263,600],[1297,600],[1299,810],[1264,810]]},
    {type:"polygon",points:[[1378,599],[1410,600],[1414,811],[1381,811]]}
  ],
  "Lagos Rodovia - Blue":[
    {type:"trace",points:[[177,641],[226,664],[276,693],[326,724],[381,759],[431,789],[487,817],[536,842],[584,858]],weight:18}
  ],
  "Lagos Rodovia - Garden":[
    {type:"polygon",points:[[718,821],[730,808],[751,800],[781,800],[805,811],[812,828],[803,844],[783,853],[749,853],[727,846],[717,835]]}
  ]
};

function clearLakeLayers(which){
  (state.lakeLayers[which]||[]).forEach(layer=>layer.remove());
  state.lakeLayers[which]=[];
}
function lakeColor(status){
  if(status==="critical")return "#E13B4B";
  if(status==="alert")return "#F27A2C";
  if(status==="attention")return "#F4B740";
  return "#00A7BC";
}
function showMapFocusCard(payload){
  state.activeMapItem=payload;
  const card=$("#mapFocusCard");
  if(!card)return;
  $("#mapFocusTitle").textContent=payload.title||"Ponto monitorado";
  $("#mapFocusDesc").textContent=payload.description||"Sem ocorrência ativa.";
  const photoBox=$("#mapFocusPhotos");
  const photos=(payload.photos||[]).filter(ph=>ph?.url);
  if(photoBox){
    photoBox.hidden=!photos.length;
    photoBox.innerHTML=photos.slice(0,3).map(ph=>`<button type="button" class="map-focus-photo" data-view-photo="${esc(ph.url)}"><img src="${esc(ph.url)}" alt="Foto da ocorrência" loading="lazy"></button>`).join("");
  }
  const meta=$("#mapFocusMeta");
  meta.innerHTML=[
    payload.typeLabel?`<span>${esc(payload.typeLabel)}</span>`:"",
    payload.timeLabel?`<span>${esc(payload.timeLabel)}</span>`:""
  ].filter(Boolean).join("")||"<span>Monitoramento contínuo</span>";
  const badge=$("#mapFocusStatus");
  const status=payload.status||"normal";
  badge.className=`mini-status ${status}`;
  badge.textContent=severityLabels[status]||"Normal";
  card.hidden=false;
  syncMapBottomUI();
}
function hideMapFocusCard(){
  state.activeMapItem=null;
  if($("#mapFocusCard"))$("#mapFocusCard").hidden=true;
  syncMapBottomUI();
}
function focusLocationById(id){
  const loc=state.locations.find(l=>String(l.id)===String(id));
  if(!loc)return;
  navigate("map");
  setTimeout(()=>{
    const target=coord(loc);
    state.maps.full?.flyTo(target,Math.max(state.maps.full.getZoom(),-.15),{duration:.45});
    const st=statusForLocation(loc.id);
    const latest=state.occurrences.find(o=>o.location_id===loc.id);
    showMapFocusCard({
      title:loc.name,
      status:st,
      category:loc.category,
      locationId:loc.id,
      typeLabel:loc.category==="lake"?"Lago monitorado":loc.category==="river"?"Rio monitorado":"Avenida monitorada",
      timeLabel:latest?age(latest.created_at):"Sem ocorrência ativa",
      description:latest?`${occurrenceLabels[latest.occurrence_type]||"Ocorrência"} • ${severityLabels[latest.severity]||latest.severity}`:"Toque e segure no mapa para registrar um ponto exato.",
      photos:latest?latest._photos||[]:[]
    });
  },130);
}
function bindMapUX(){
  $("#mapBackBtn")?.addEventListener("click",()=>navigate("home"));
  $("#mapCenterBtn")?.addEventListener("click",()=>{
    state.maps.full?.flyToBounds(MAP_BOUNDS,{duration:.42,padding:[12,12],maxZoom:17});
  });
  $("#mapLegendBtn")?.addEventListener("click",()=>{
    const el=$("#mapInlineLegend");
    if(!el)return;
    el.hidden=!el.hidden;
    $("#mapLegendBtn").classList.toggle("active",!el.hidden);
  });
  $("#mapLegendCloseBtn")?.addEventListener("click",()=>{
    $("#mapInlineLegend").hidden=true;
    $("#mapLegendBtn")?.classList.remove("active");
  });
  $("#mapFocusCloseBtn")?.addEventListener("click",hideMapFocusCard);
  $("#mapFocusReportBtn")?.addEventListener("click",()=>{
    const item=state.activeMapItem;
    openReport("map");
    if(!item?.locationId)return;
    const type=item.category==="avenue"?"avenue_flooding":item.category==="lake"?"lakes_full":item.category==="river"?"river_level":"";
    if(type){
      state.reportLocationIds=[item.locationId];
      setOccurrenceType(type,{keepLocations:true});
      $("#manualReportFields").hidden=false;
      renderLocationChips();
      updateReportReadyState();
    }
  });
}
function attachMapResizeObserver(){
  if(state.mapResizeObserver||!("ResizeObserver"in window))return;
  state.mapResizeObserver=new ResizeObserver(()=>{
    ensureMapLayout(state.maps.home,false);
    ensureMapLayout(state.maps.full,false);
  });
  ["homeMap","fullMap"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)state.mapResizeObserver.observe(el);
  });
  window.addEventListener("orientationchange",()=>setTimeout(()=>refreshFullMapLayout(),180));
  window.addEventListener("resize",()=>{
    if(document.body.classList.contains("map-open"))setTimeout(()=>refreshFullMapLayout(),90);
    else setTimeout(()=>ensureMapLayout(state.maps.home,false),80);
    if(!$("#reportModal")?.hidden)showMobileReportCategories();
  });
}
function renderLakeZones(which){
  const map=state.maps[which];
  if(!map)return;
  clearLakeLayers(which);
  const visible=which==="home"?true:(state.filter==="all"||state.filter==="lake"||state.filter==="alerts");
  if(!visible)return;

  state.locations.filter(loc=>loc.category==="lake").forEach(loc=>{
    const status=statusForLocation(loc.id);
    if(which==="full"&&state.filter==="alerts"&&status==="normal")return;

    const defs=lakeZones[loc.name]||[];
    const latestOccurrence=state.occurrences.find(o=>o.location_id===loc.id);
    const color=lakeColor(status);
    const payload={
      title:loc.name,
      status,
      category:"lake",
      locationId:loc.id,
      typeLabel:"Lago monitorado",
      timeLabel:latestOccurrence?age(latestOccurrence.created_at):"Sem ocorrência ativa",
      description:latestOccurrence?`${occurrenceLabels[latestOccurrence.occurrence_type]||"Ocorrência"} • ${severityLabels[latestOccurrence.severity]||latestOccurrence.severity}`:"Área hídrica em monitoramento."
    };

    defs.forEach(def=>{
      const pts=routeToLatLng(def.points);
      let baseLayer;

      if(def.type==="trace"){
        const halo=L.polyline(pts,{
          color:"#FFFFFF",
          weight:(def.weight||18)+8,
          opacity:.38,
          interactive:false,
          className:"lake-zone-base"
        }).addTo(map);

        baseLayer=L.polyline(pts,{
          color,
          weight:def.weight||18,
          opacity:.28,
          interactive:true,
          className:"lake-zone-base map-hit-target"
        }).addTo(map);

        state.lakeLayers[which].push(halo,baseLayer);

        if(latestOccurrence){
          const event=L.polyline(pts,{
            color,
            weight:(def.weight||18)+3,
            opacity:.62,
            interactive:false,
            dashArray:"10 8",
            className:`lake-occurrence-wave lake-occurrence-${latestOccurrence.severity}`
          }).addTo(map);
          state.lakeLayers[which].push(event);
        }
      }else{
        baseLayer=L.polygon(pts,{
          color,
          weight:2.2,
          opacity:.82,
          fillColor:color,
          fillOpacity:.14,
          interactive:true,
          className:"lake-zone-base map-hit-target"
        }).addTo(map);

        state.lakeLayers[which].push(baseLayer);

        if(latestOccurrence){
          const event=L.polygon(pts,{
            color,
            weight:2.8,
            opacity:.95,
            fillColor:color,
            fillOpacity:.28,
            interactive:false,
            className:`lake-occurrence-fill lake-occurrence-${latestOccurrence.severity}`
          }).addTo(map);
          state.lakeLayers[which].push(event);
        }
      }

      baseLayer.on("click",()=>{
        if(which==="home"){navigate("map");setTimeout(()=>showMapFocusCard(payload),120);}
        else showMapFocusCard(payload);
      });
    });
  });
}
function clearAvenueLayers(which){
  (state.avenueLayers[which]||[]).forEach(l=>l.remove());
  state.avenueLayers[which]=[];
}
function renderAvenues(which){
  const map=state.maps[which];if(!map)return;
  clearAvenueLayers(which);
  const visible=which==="home"?true:(state.filter==="all"||state.filter==="avenue"||state.filter==="alerts");
  if(!visible)return;

  state.locations.filter(loc=>loc.category==="avenue").forEach(loc=>{
    const route=avenueRoutes[loc.name];if(!route)return;
    const status=statusForLocation(loc.id);
    if(which==="full"&&state.filter==="alerts"&&status==="normal")return;

    const points=routeToLatLng(route);
    const color="#1684D8";

    const corridor=L.polyline(points,{
      color,
      weight:10,
      opacity:.025,
      lineCap:"round",
      lineJoin:"round",
      interactive:false,
      className:"avenue-corridor"
    }).addTo(map);

    const core=L.polyline(points,{
      color,
      weight:2.4,
      opacity:.16,
      lineCap:"round",
      lineJoin:"round",
      interactive:false,
      className:"avenue-core"
    }).addTo(map);

    const center=L.polyline(points,{
      color:"#FFFFFF",
      weight:1,
      opacity:.08,
      lineCap:"round",
      interactive:false,
      dashArray:"3 8",
      className:"avenue-center-static"
    }).addTo(map);

    const hit=L.polyline(points,{
      color:"#000",
      weight:34,
      opacity:0,
      interactive:true,
      className:"map-hit-target"
    }).addTo(map);

    const latest=state.occurrences.find(o=>o.location_id===loc.id);
    const payload={
      title:loc.name,
      status,
      category:"avenue",
      locationId:loc.id,
      typeLabel:"Avenida monitorada",
      timeLabel:latest?age(latest.created_at):"Sem ocorrência ativa",
      description:latest?`${occurrenceLabels[latest.occurrence_type]||"Ocorrência"} • ${severityLabels[latest.severity]||latest.severity}`:"Segure sobre a via e arraste para selecionar o trecho."
    };

    hit.on("click",()=>{
      if(which==="home"){navigate("map");setTimeout(()=>showMapFocusCard(payload),120);}
      else showMapFocusCard(payload);
    });

    if(which==="full")hit.bindTooltip(loc.name,{sticky:true,className:"avenue-tooltip",direction:"top"});
    state.avenueLayers[which].push(corridor,core,center,hit);
  });
}

function clearRiverLayers(which){
  (state.riverLayers[which]||[]).forEach(layer=>layer.remove());
  state.riverLayers[which]=[];
}
function riverColor(status){
  if(status==="critical")return "#E13B4B";
  if(status==="alert")return "#F27A2C";
  if(status==="attention")return "#F4B740";
  return "#088FB4";
}
function riverMarkerIcon(status,hasOccurrence=false){
  return L.divIcon({
    className:"",
    html:`<div class="river-marker ${status} ${hasOccurrence?"river-marker-event":""}"><span>≋</span></div>`,
    iconSize:[38,38],
    iconAnchor:[19,19],
    popupAnchor:[0,-22]
  });
}
function renderRiverZone(which){
  const map=state.maps[which];
  if(!map)return;
  clearRiverLayers(which);

  const visible=which==="home"?true:(state.filter==="all"||state.filter==="river"||state.filter==="alerts");
  if(!visible)return;

  const loc=state.locations.find(l=>l.category==="river"&&l.name==="Rio Biguaçu");
  if(!loc)return;

  const status=statusForLocation(loc.id);
  if(which==="full"&&state.filter==="alerts"&&status==="normal")return;

  const latest=state.occurrences.find(o=>o.location_id===loc.id);
  const color=riverColor(status);
  const pts=routeToLatLng(riverRoute);

  const halo=L.polyline(pts,{
    color:"#FFFFFF",
    weight:31,
    opacity:.40,
    lineCap:"round",
    lineJoin:"round",
    interactive:false
  }).addTo(map);

  const base=L.polyline(pts,{
    color,
    weight:23,
    opacity:latest?.55:.28,
    lineCap:"round",
    lineJoin:"round",
    interactive:false,
    className:"river-zone-base"
  }).addTo(map);

  const hit=L.polyline(pts,{
    color:"#000000",
    weight:42,
    opacity:0,
    interactive:true,
    className:"map-hit-target"
  }).addTo(map);

  if(latest){
    const event=L.polyline(pts,{
      color,
      weight:27,
      opacity:.68,
      dashArray:"12 9",
      lineCap:"round",
      interactive:false,
      className:`river-occurrence-flow river-occurrence-${latest.severity}`
    }).addTo(map);
    state.riverLayers[which].push(event);
  }

  const payload={
    title:"Rio Biguaçu",
    status,
    category:"river",
    locationId:loc.id,
    typeLabel:"Nível do rio",
    timeLabel:latest?age(latest.created_at):"Sem ocorrência ativa",
    description:latest?`${occurrenceLabels[latest.occurrence_type]||"Nível do rio"} • ${severityLabels[latest.severity]||latest.severity}`:"Monitoramento comunitário do nível do Rio Biguaçu."
  };

  hit.on("click",()=>{
    if(which==="home"){navigate("map");setTimeout(()=>showMapFocusCard(payload),120);}
    else showMapFocusCard(payload);
  });

  const marker=L.marker(coord(loc),{
    icon:riverMarkerIcon(status,!!latest),
    zIndexOffset:560
  }).addTo(map);

  marker.on("click",()=>{
    if(which==="home"){navigate("map");setTimeout(()=>showMapFocusCard(payload),120);}
    else showMapFocusCard(payload);
  });

  if(which==="full"){
    marker.bindTooltip("Rio Biguaçu",{permanent:true,direction:"left",offset:[-19,0],className:"river-name-tooltip"}).openTooltip();
  }

  state.riverLayers[which].push(halo,base,hit,marker);
}

function renderMapMarkers(){
  if(!state.maps.home)return;
  for(const which of ["home","full"]){
    state.markers[which].forEach(m=>m.remove());
    state.markers[which]=[];
    const map=state.maps[which];
    renderAvenues(which);
    renderLakeZones(which);
    renderRiverZone(which);

    state.locations.filter(loc=>loc.category==="lake").forEach(loc=>{
      const status=statusForLocation(loc.id);
      if(which==="full"&&state.filter==="avenue")return;
      if(which==="full"&&state.filter==="alerts"&&status==="normal")return;
      const latest=state.occurrences.find(o=>o.location_id===loc.id);
      const marker=L.marker(coord(loc),{icon:markerIcon(loc,status,!!latest),zIndexOffset:540}).addTo(map);
      const payload={
        title:loc.name,
        status,
        category:"lake",
        locationId:loc.id,
        typeLabel:"Lago monitorado",
        timeLabel:latest?age(latest.created_at):"Sem ocorrência ativa",
        description:latest?`${occurrenceLabels[latest.occurrence_type]||"Ocorrência"} • ${severityLabels[latest.severity]||latest.severity}`:"Área hídrica em monitoramento."
      };
      marker.on("click",()=>{
        if(which==="home"){navigate("map");setTimeout(()=>showMapFocusCard(payload),120);}
        else showMapFocusCard(payload);
      });
      if(which==="full"){
        marker.bindTooltip(shortLakeName(loc.name),{permanent:true,direction:"top",offset:[0,-17],className:"lake-name-tooltip"}).openTooltip();
      }
      state.markers[which].push(marker);
    });
  }
  renderOccurrencePointMarkers();
}

function statusForTypes(types){
  const set=new Set(types);
  return highestSeverity(state.occurrences.filter(o=>set.has(o.occurrence_type)));
}
function renderDesktopMonitoring(){
  const host=$("#desktopMonitoringList");
  if(!host)return;
  const rows=[
    ["Condições climáticas",statusForTypes(["heavy_rain_flood_risk","hail","wind_damage","wind_no_damage"])],
    ["Rio Biguaçu",statusForTypes(["river_level","river_overflow"])],
    ["Drenagem e alagamentos",statusForTypes(["avenue_flooding","lakes_full","drainage_clogged"])],
    ["Iluminação pública",statusForTypes(["public_lighting"])],
    ["Vias e acesso",statusForTypes(["road_damage","signage_issue","sidewalk_obstruction"])],
    ["Áreas verdes",statusForTypes(["tree_hazard"])],
    ["Infraestrutura e serviços",statusForTypes(["power_outage","water_supply","sewer_issue","waste_accumulation","infrastructure_damage"])]
  ];
  host.innerHTML=rows.map(([label,status])=>{
    const st=status||"normal";
    return `<div><span>${esc(label)}</span><b class="${st}"><i></i>${st==="normal"?"Sem relatos ativos":severityLabels[st]}</b></div>`;
  }).join("");
}
function severitySummary(){
  const grouped=groupOccurrences(state.occurrences).map(g=>({severity:highestSeverity(g.items)}));
  const all=[...grouped,...state.alerts];
  return {
    attention:all.filter(x=>x.severity==="attention").length,
    alert:all.filter(x=>x.severity==="alert").length,
    critical:all.filter(x=>x.severity==="critical").length
  };
}
function renderDesktopSeverity(){
  const s=severitySummary();
  if($("#desktopAttentionCount"))$("#desktopAttentionCount").textContent=s.attention;
  if($("#desktopAlertSeverityCount"))$("#desktopAlertSeverityCount").textContent=s.alert;
  if($("#desktopCriticalSeverityCount"))$("#desktopCriticalSeverityCount").textContent=s.critical;
  if($("#topAttentionCount"))$("#topAttentionCount").textContent=s.attention;
  if($("#topAlertCount"))$("#topAlertCount").textContent=s.alert;
  if($("#topCriticalCount"))$("#topCriticalCount").textContent=s.critical;
}
function recentOccurrenceRow(o){
  const when=o.resolved_at||o.created_at;
  return `<div class="desktop-recent-row">
    <span class="desktop-recent-icon">${occurrenceIconMarkup(o.occurrence_type)}</span>
    <div><b>${esc(occurrenceLabels[o.occurrence_type]||"Ocorrência")}</b><small>${esc(locationName(o))} • ${age(when)}</small></div>
    <em>Resolvida</em>
  </div>`;
}
function renderDesktopRecent(){
  const host=$("#desktopRecentList");if(!host)return;
  host.innerHTML=state.recentResolved.length
    ?state.recentResolved.slice(0,3).map(recentOccurrenceRow).join("")
    :'<div class="desktop-recent-empty">Nenhuma ocorrência resolvida recentemente.</div>';
}
function renderReports(){
  const groups=groupOccurrences(state.occurrences);
  const s=severitySummary();
  if($("#reportsActiveCount"))$("#reportsActiveCount").textContent=groups.length;
  if($("#reportsAttentionCount"))$("#reportsAttentionCount").textContent=s.attention;
  if($("#reportsAlertCount"))$("#reportsAlertCount").textContent=s.alert;
  if($("#reportsCriticalCount"))$("#reportsCriticalCount").textContent=s.critical;
  if($("#reportsResolvedCount"))$("#reportsResolvedCount").textContent=state.recentResolved.length;

  const items=[...state.occurrences,...state.recentResolved];
  const counts={};
  for(const o of items)counts[o.occurrence_type]=(counts[o.occurrence_type]||0)+1;
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...ranked.map(x=>x[1]));
  const host=$("#reportsTypeList");
  if(host)host.innerHTML=ranked.length?ranked.map(([type,count])=>`
    <div class="reports-type-row">
      <span>${occurrenceIconMarkup(type)}</span>
      <div><b>${esc(occurrenceLabels[type]||type)}</b><i><u style="width:${Math.max(8,Math.round(count/max*100))}%"></u></i></div>
      <strong>${count}</strong>
    </div>`).join(""):'<div class="empty">Ainda não há registros suficientes para o relatório.</div>';
}

function mobileRecentRow(item){
  const o=item.occurrence;
  const title=occurrenceLabels[o.occurrence_type]||"Ocorrência";
  const where=locationName(o)||"Deltaville";
  const when=item.when||o.created_at;
  const sev=item.severity||o.severity||"attention";
  const icon=occurrenceIconMarkup(o.occurrence_type);
  const tag=item.resolved?"Resolvida":"Ativa";
  const cls=item.resolved?"":" active";
  const inner=`<span class="v7-recent-icon ${esc(sev)}">${icon}</span>
    <span class="v7-recent-copy"><b>${esc(title)}</b><span>${esc(where)}</span><small>${age(when)}</small></span>
    <span class="v7-recent-state${cls}">${tag}</span>`;
  return item.resolved
    ?`<div class="v7-recent-row">${inner}</div>`
    :`<button type="button" class="v7-recent-row" data-open-occurrence="${o.id}" aria-label="Abrir ${esc(title)} no mapa">${inner}</button>`;
}
function renderMobileHomeDashboard(){
  const activeGroups=groupOccurrences(state.occurrences);
  const now=Date.now();
  const recentWindow=[...state.occurrences,...state.recentResolved].filter(o=>{
    const t=Date.parse(o.created_at||o.resolved_at||"");
    return Number.isFinite(t)&&now-t<=24*60*60*1000;
  });
  const recent24=groupOccurrences(recentWindow).length;
  if($("#v7Reports24h"))$("#v7Reports24h").textContent=recent24;
  if($("#v7ReportsCaption"))$("#v7ReportsCaption").textContent=recent24===1?"1 registro recente":`${recent24} registros recentes`;
  if($("#v7ActiveCount"))$("#v7ActiveCount").textContent=activeGroups.length;
  if($("#v7ActiveStatus"))$("#v7ActiveStatus").textContent=activeGroups.length===0?"Tudo sob controle":activeGroups.length===1?"1 situação em monitoramento":`${activeGroups.length} situações em monitoramento`;

  const activeItems=activeGroups.map(g=>({
    occurrence:g.items[0],
    severity:highestSeverity(g.items),
    when:g.items[0]?.created_at,
    resolved:false
  }));
  const resolvedItems=state.recentResolved.map(o=>({
    occurrence:o,
    severity:o.severity||"attention",
    when:o.resolved_at||o.created_at,
    resolved:true
  }));
  const recent=[...activeItems,...resolvedItems]
    .filter(x=>x.occurrence)
    .sort((a,b)=>Date.parse(b.when||0)-Date.parse(a.when||0))
    .slice(0,3);
  const host=$("#v7RecentList");
  if(host)host.innerHTML=recent.length
    ?recent.map(mobileRecentRow).join("")
    :'<div class="v7-recent-empty">Nenhuma ocorrência recente no momento.</div>';
}

function renderAll(){
  renderStatus();
  renderProfile();
  renderOccurrences();
  renderAlertsPage();
  renderLocations();
  renderDesktopMonitoring();
  renderDesktopSeverity();
  renderDesktopRecent();
  renderReports();
  renderMobileHomeDashboard();
  renderMapMarkers();
}
function renderProfile(){
  const p=state.profile;
  if(!p){$("#residentLine").textContent="Entre para continuar.";return;}
  $("#helloTitle").textContent=`Olá, ${p.first_name}`;
  $("#residentLine").textContent=`${p.condominiums?.name||""} • ${p.house_or_lot}`;
  if($("#desktopHelloTitle"))$("#desktopHelloTitle").textContent=`Olá, ${p.first_name}`;
  if($("#desktopResidentLine"))$("#desktopResidentLine").textContent=`${p.condominiums?.name||""} • ${p.house_or_lot}`;
  const initials=(p.first_name[0]+p.last_name[0]).toUpperCase();
  if($("#desktopAvatar"))$("#desktopAvatar").textContent=initials;
  if($("#desktopAccountName"))$("#desktopAccountName").textContent=p.first_name;
  if($("#desktopAccountRole"))$("#desktopAccountRole").textContent=state.isAdmin?"Administrador":(p.condominiums?.name||"Morador");
  if($("#mobileAvatar"))$("#mobileAvatar").textContent=initials;
  const legacy=state.user?.is_anonymous===true;
  $("#profileView").innerHTML=`<div class="initials">${esc(initials)}</div><h2>${esc(p.first_name)} ${esc(p.last_name)}</h2><p>${esc(p.condominiums?.name||"")}</p><small>Casa/lote ${esc(p.house_or_lot)}</small><span class="profile-access-state">${legacy?"Acesso antigo • sem PIN":"Acesso com PIN"}</span>`;
  $("#upgradeLegacyBtn").hidden=!legacy;
  if($("#adminEntryBtn"))$("#adminEntryBtn").hidden=!state.isAdmin;
  if($("#desktopAdminNav"))$("#desktopAdminNav").hidden=!state.isAdmin;
}
function locationById(id){return state.locations.find(l=>String(l.id)===String(id))||null;}
function focusOccurrenceOnMap(id){
  const first=state.occurrences.find(x=>String(x.id)===String(id));if(!first)return;
  const gid=groupIdOf(first),items=gid?state.occurrences.filter(o=>groupIdOf(o)===gid):[first];
  navigate("map");
  setTimeout(()=>{
    const targets=[];
    for(const o of items){
      const meta=o._meta||null;let target=null;
      if(meta?.mode==="segment"&&o.location_id){const pts=avenuePointsByLocationId(o.location_id);if(pts)target=selectedSegmentMidpoint(pts,{startRatio:meta.startRatio,endRatio:meta.endRatio,span:Number.isFinite(Number(meta.span))?Number(meta.span):undefined,wrap:!!meta.wrap});}
      else if(o.exact_map_x!=null&&o.exact_map_y!=null)target=normalizedToLatLng(o.exact_map_x,o.exact_map_y);
      else if(o.location_id){const loc=locationById(o.location_id);if(loc)target=coord(loc);}
      if(target)targets.push(target);
    }
    if(state.maps.full&&targets.length>1)state.maps.full.fitBounds(L.latLngBounds(targets),{padding:[70,70],maxZoom:.55,animate:true});
    else if(state.maps.full&&targets.length===1)state.maps.full.flyTo(targets[0],Math.max(state.maps.full.getZoom(),-.15),{duration:.45});
    const names=[...new Set(items.map(locationName).filter(Boolean))];
    showMapFocusCard({title:items.length>1?`${occurrenceLabels[first.occurrence_type]||"Ocorrência"} • ${items.length} locais`:(occurrenceLabels[first.occurrence_type]||"Ocorrência"),description:noteText(first)||names.join(" • "),status:highestSeverity(items)||"alert",category:"occurrence",locationId:first.location_id||null,typeLabel:items.length>1?"Ocorrência em vários locais":(first._meta?.mode==="segment"?"Trecho alagado":(first.exact_map_x!=null?"Ponto exato":"Ocorrência ativa")),timeLabel:age(first.created_at),photos:occurrencePhotoList(items)});
  },180);
}
function occurrenceGroupCard(group,allowEdit=false){
  const items=group.items,o=items[0],own=items.every(x=>x.reporter_id===state.user?.id);
  const cond=o.reporter_condominium?` • ${esc(o.reporter_condominium)}`:"",person=o.reporter_first_name?`${esc(o.reporter_first_name)}${cond}`:"Morador";
  const severity=highestSeverity(items),names=[...new Set(items.map(locationName).filter(Boolean))];
  const hasSegment=items.some(x=>x._meta?.mode==="segment"),pointCount=items.filter(x=>x.exact_map_x!=null&&x.exact_map_y!=null).length;
  const modeTag=items.length>1?`<span class="exact-location-tag">⌖ ${items.length} locais no mapa</span>`:(hasSegment?'<span class="exact-location-tag">↔ trecho delimitado no mapa</span>':(pointCount?'<span class="exact-location-tag">⌖ ponto exato no mapa</span>':''));
  const locLine=names.length<=2?names.join(" + "):`${names.slice(0,2).join(" + ")} +${names.length-2}`;
  const photos=occurrencePhotoList(items).filter(ph=>ph?.url);
  const photoStrip=photos.length?`<div class="event-photo-strip">${photos.slice(0,3).map((ph,i)=>`<button type="button" class="event-photo-thumb" data-view-photo="${esc(ph.url)}" aria-label="Abrir foto ${i+1}"><img src="${esc(ph.url)}" alt="" loading="lazy"></button>`).join("")}</div>`:"";
  return `<article class="event-card occurrence-clickable" data-open-occurrence="${o.id}" role="button" tabindex="0" aria-label="Abrir ocorrência no mapa"><div class="event-icon ${severity}">${occurrenceIconMarkup(o.occurrence_type)}</div><div><h3>${esc(occurrenceLabels[o.occurrence_type]||"Ocorrência")}</h3><p><b>${esc(locLine||"Local informado")}</b>${o.avenue_condition?` • ${esc(conditionLabels[o.avenue_condition])}`:""}</p>${noteText(o)?`<p>${esc(noteText(o))}</p>`:""}${photoStrip}${modeTag}<small>${person} • ${age(o.created_at)}</small></div>${allowEdit&&own?`<div class="event-owner-actions"><button class="edit-occurrence-btn" data-edit-occurrence="${o.id}" type="button">Editar</button><button class="delete-occurrence-inline" data-delete-occurrence="${o.id}" type="button">Apagar</button></div>`:""}</article>`;
}
function occurrenceCard(o,allowEdit=false){return occurrenceGroupCard({id:groupIdOf(o),items:[o]},allowEdit);}
function alertCard(a){
  return `<article class="event-card"><div class="event-icon ${a.severity}">!</div><div>
  <h3>${esc(a.title)}</h3><p><b>${esc(a.monitored_locations?.name||"Deltaville")}</b></p>
  <p>${esc(a.message)}</p><small>${esc(a.source_type)} • ${age(a.created_at)}</small></div></article>`;
}
function renderOccurrences(){
  const groups=groupOccurrences(state.occurrences);
  const totalActive=groups.length+state.alerts.length;
  const criticalActive=
    groups.filter(g=>highestSeverity(g.items)==="critical").length+
    state.alerts.filter(a=>a.severity==="critical").length;

  $("#homeCount").textContent=totalActive;
  $("#occurrenceCount").textContent=groups.length;
  if($("#desktopAlertCount"))$("#desktopAlertCount").textContent=totalActive;
  if($("#desktopOccurrenceCount"))$("#desktopOccurrenceCount").textContent=groups.length;
  if($("#desktopCriticalCount"))$("#desktopCriticalCount").textContent=criticalActive;
  if($("#topCriticalCount"))$("#topCriticalCount").textContent=criticalActive;

  const badgeText=totalActive>9?"9+":String(totalActive);
  for(const id of ["desktopAlertBadge","desktopBellBadge"]){
    const el=$("#"+id);
    if(el){el.hidden=totalActive===0;el.textContent=badgeText;}
  }

  $("#homeOccurrences").innerHTML=groups.length
    ?groups.slice(0,6).map(g=>occurrenceGroupCard(g,true)).join("")
    :'<div class="empty desktop-empty-state"><b>Tudo tranquilo no momento</b><span>Nenhuma ocorrência comunitária ativa agora.</span></div>';
  renderDesktopMonitoring();
  renderDesktopSeverity();
  renderDesktopRecent();
  renderReports();
  renderMobileHomeDashboard();
}
function renderAlertsPage(){
  let items=[...groupOccurrences(state.occurrences).map(g=>({kind:"occ",severity:highestSeverity(g.items),date:g.items[0]?.created_at,html:occurrenceGroupCard(g,true)})),...state.alerts.map(a=>({kind:"alert",severity:a.severity,date:a.created_at,html:alertCard(a)}))].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(state.alertFilter!=="all")items=items.filter(i=>i.severity===state.alertFilter);
  const totalActive=groupOccurrences(state.occurrences).length+state.alerts.length;
  $("#alertsCount").textContent=totalActive;$("#alertsPageList").innerHTML=items.length?items.map(i=>i.html).join(""):'<div class="empty">Nenhum alerta ativo neste filtro.</div>';
  $("#notifyDot").hidden=totalActive===0;if($("#navAlertBadge")){$("#navAlertBadge").hidden=totalActive===0;$("#navAlertBadge").textContent=totalActive>9?"9+":String(totalActive);}
}
function renderLocations(){
  $("#locationsList").innerHTML=state.locations.map(l=>{
    const st=statusForLocation(l.id);
    const color=st==="normal"?"#10B981":st==="attention"?"#F4B740":st==="alert"?"#F27A2C":"#E13B4B";
    return `<button type="button" class="location-row" data-focus-location="${esc(l.id)}"><i style="background:${color}"></i><div><b>${esc(l.name)}</b><span>${l.category==="lake"?"Lago":l.category==="river"?"Rio":"Avenida"} • ${severityLabels[st]||"Normal"}</span></div></button>`;
  }).join("");
}
function renderStatus(){
  state.occurrences=state.occurrences.filter(activeOccurrence);
  state.alerts=state.alerts.filter(a=>(!a.starts_at||new Date(a.starts_at)<=new Date())&&(!a.ends_at||new Date(a.ends_at)>new Date()));
  const all=[...state.occurrences,...state.alerts];
  const st=highestSeverity(all);
  const incomplete=!navigator.onLine||state.connectionDegraded||!state.sourceUpdatedAt?.occurrences||!state.sourceUpdatedAt?.alerts;
  const text=incomplete?(st==="normal"?"Dados não confirmados":`${severityLabels[st]} • último registro`):(severityLabels[st]||"Normal");
  $("#overallStatus").textContent=text;
  $("#overallStatus").style.color=st==="normal"?"#10B981":st==="attention"?"#B17D00":st==="alert"?"#D45E18":"#C52F42";
  $("#overallPill").className=`status-pill ${st}`; $("#overallPill").textContent=`● ${text}`;
  const reasons={normal:"Nenhuma ocorrência ou alerta ativo informado.",attention:"Há registros que pedem atenção.",alert:"Há situação de alerta ativa.",critical:"Há ocorrência crítica ativa."};
  $("#statusReason").textContent=incomplete?"Últimos registros disponíveis; conexão pendente.":reasons[st];
  if($("#desktopOverallStatus")){
    $("#desktopOverallStatus").textContent=text;
    $("#desktopOverallStatus").className=st;
  }
  if($("#desktopStatusReason"))$("#desktopStatusReason").textContent=incomplete?"Últimos registros disponíveis; conexão pendente.":reasons[st];
}


function allowedLocationsForType(type){
  if(type==="avenue_flooding")return state.locations.filter(l=>l.category==="avenue");
  if(type==="lakes_full")return state.locations.filter(l=>l.category==="lake");
  if(type==="river_level"||type==="river_overflow")return state.locations.filter(l=>l.category==="river");
  if(isCommunityProblemType(type))return [...state.locations];
  return [];
}
function allowedReportLocationIds(type){
  if(isWeatherScopeType(type)){
    return new Set([
      ...state.condominiums.filter(c=>c.active!==false).map(c=>condominiumToken(c.id)),
      "whole"
    ]);
  }
  if(isCommunityProblemType(type)){
    return new Set([
      ...state.locations.map(l=>String(l.id)),
      ...state.condominiums.filter(c=>c.active!==false).map(c=>condominiumToken(c.id)),
      "whole","other"
    ]);
  }
  return new Set([
    ...allowedLocationsForType(type).map(l=>String(l.id)),
    "other"
  ]);
}
function typeLabel(type){return occurrenceLabels[type]||"Ocorrência";}
function setOccurrenceType(type,{keepLocations=false}={}){
  $("#occurrenceType").value=type||"";
  $$("#typeChips [data-occ-type]").forEach(b=>b.classList.toggle("selected",b.dataset.occType===type));
  if(!keepLocations){
    const allowed=allowedReportLocationIds(type);
    state.reportLocationIds=state.reportLocationIds.filter(id=>allowed.has(String(id)));
    state.reportDamageTypes=[];
  }
  renderLocationChips();
  renderDamageUI();
  updateReportReadyState();
}
function renderDamageUI(){
  const type=$("#occurrenceType")?.value||"";
  const block=$("#damageBlock");
  if(block)block.hidden=type!=="wind_damage";
  $$("[data-damage-type]").forEach(btn=>{
    btn.classList.toggle("selected",state.reportDamageTypes.includes(btn.dataset.damageType));
  });
}
function toggleDamageType(type){
  const idx=state.reportDamageTypes.indexOf(type);
  if(idx>=0)state.reportDamageTypes.splice(idx,1);
  else state.reportDamageTypes.push(type);
  renderDamageUI();
  updateReportReadyState();
}
function renderLocationChips(){
  const wrap=$("#locationChips");if(!wrap)return;
  const type=$("#occurrenceType").value;
  if(!type){wrap.innerHTML="";$("#locationBlock").hidden=true;return;}
  $("#locationBlock").hidden=false;

  const weather=isWeatherScopeType(type);
  const title=$("#locationBlockTitle"),helper=$("#locationBlockHelper");
  if(title)title.textContent=weather?"Em quais condomínios?":"Onde?";
  if(helper)helper.textContent=weather?"Selecione um ou mais, ou o bairro inteiro.":"Você pode marcar mais de um local.";

  if(weather){
    const condos=state.condominiums.filter(c=>c.active!==false);
    wrap.innerHTML=
      `<button type="button" class="location-chip whole-neighborhood ${state.reportLocationIds.includes("whole")?"selected":""}" data-report-location="whole"><span>⌂</span>Bairro inteiro</button>`+
      condos.map(c=>{
        const id=condominiumToken(c.id);
        const selected=state.reportLocationIds.includes(id);
        return `<button type="button" class="location-chip condo-chip ${selected?"selected":""}" data-report-location="${esc(id)}"><span>⌂</span>${esc(c.name)}</button>`;
      }).join("");

    $("#locationSelect").innerHTML='<option value=""></option>'+
      condos.map(c=>`<option value="${esc(condominiumToken(c.id))}">${esc(c.name)}</option>`).join("")+
      '<option value="whole">Bairro inteiro</option>';
    $("#locationSelect").value=state.reportLocationIds[0]||"";
    $("#customLocationWrap").hidden=true;
    $("#conditionBlock").hidden=true;
    $("#avenueConditionWrap").hidden=true;
    $("#segmentPickBtn").hidden=true;

    // Fenômenos gerais não precisam de ponto exato; evita complexidade desnecessária.
    if($("#mapToolsBlock"))$("#mapToolsBlock").hidden=true;
  }else if(isCommunityProblemType(type)){
    const condos=state.condominiums.filter(c=>c.active!==false);
    const locs=allowedLocationsForType(type);
    if(title)title.textContent="Onde está o problema?";
    if(helper)helper.textContent="Escolha um local, condomínio, bairro inteiro ou marque o ponto exato no mapa.";

    wrap.innerHTML=
      `<button type="button" class="location-chip whole-neighborhood ${state.reportLocationIds.includes("whole")?"selected":""}" data-report-location="whole"><span>⌂</span>Bairro inteiro</button>`+
      condos.map(c=>{
        const id=condominiumToken(c.id),selected=state.reportLocationIds.includes(id);
        return `<button type="button" class="location-chip condo-chip ${selected?"selected":""}" data-report-location="${esc(id)}"><span>⌂</span>${esc(c.name)}</button>`;
      }).join("")+
      locs.map(loc=>{
        const selected=state.reportLocationIds.some(id=>String(id)===String(loc.id));
        const icon=loc.category==="avenue"?"⌁":loc.category==="lake"?"≈":"≋";
        return `<button type="button" class="location-chip ${selected?"selected":""}" data-report-location="${esc(loc.id)}"><span>${icon}</span>${esc(loc.name)}</button>`;
      }).join("")+
      `<button type="button" class="location-chip ${state.reportLocationIds.includes("other")?"selected":""}" data-report-location="other"><span>＋</span>Outro local</button>`;

    $("#locationSelect").innerHTML='<option value=""></option>'+
      condos.map(c=>`<option value="${esc(condominiumToken(c.id))}">${esc(c.name)}</option>`).join("")+
      locs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join("")+
      '<option value="whole">Bairro inteiro</option><option value="other">Outro</option>';
    $("#locationSelect").value=state.reportLocationIds[0]||"";
    const other=state.reportLocationIds.includes("other");
    $("#customLocationWrap").hidden=!other;
    if(other&&state.reportCustomLocation&&!$("#customLocation").value)$("#customLocation").value=state.reportCustomLocation;
    $("#conditionBlock").hidden=true;
    $("#avenueConditionWrap").hidden=true;
    $("#segmentPickBtn").hidden=true;
    if($("#mapToolsBlock"))$("#mapToolsBlock").hidden=false;
  }else{
    const locs=allowedLocationsForType(type);
    wrap.innerHTML=locs.map(loc=>{
      const selected=state.reportLocationIds.some(id=>String(id)===String(loc.id));
      const icon=loc.category==="avenue"?"⌁":loc.category==="lake"?"≈":"≋";
      return `<button type="button" class="location-chip ${selected?"selected":""}" data-report-location="${esc(loc.id)}"><span>${icon}</span>${esc(loc.name)}</button>`;
    }).join("")+`<button type="button" class="location-chip ${state.reportLocationIds.includes("other")?"selected":""}" data-report-location="other"><span>＋</span>Outro local</button>`;

    const first=state.reportLocationIds.find(id=>id!=="other")||"";
    $("#locationSelect").innerHTML='<option value=""></option>'+locs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join("")+'<option value="other">Outro</option>';
    $("#locationSelect").value=state.reportLocationIds.includes("other")?"other":first;
    const other=state.reportLocationIds.includes("other");
    $("#customLocationWrap").hidden=!other;
    if(other&&state.reportCustomLocation&&!$("#customLocation").value)$("#customLocation").value=state.reportCustomLocation;
    const avenue=type==="avenue_flooding";
    $("#conditionBlock").hidden=!avenue;
    $("#avenueConditionWrap").hidden=!avenue;
    $("#segmentPickBtn").hidden=!(avenue&&state.reportLocationIds.filter(id=>id!=="other").length===1&&!other);
    if($("#mapToolsBlock"))$("#mapToolsBlock").hidden=false;
  }

  updateSelectedPointUI();
}
function toggleReportLocation(id){
  id=String(id);
  if(id==="whole"){
    state.reportLocationIds=state.reportLocationIds.includes("whole")?[]:["whole"];
  }else{
    // Se o usuário escolheu um condomínio/local específico, "bairro inteiro" deixa de valer.
    state.reportLocationIds=state.reportLocationIds.filter(x=>x!=="whole");
    const idx=state.reportLocationIds.findIndex(x=>String(x)===id);
    if(idx>=0)state.reportLocationIds.splice(idx,1);
    else state.reportLocationIds.push(id);
  }
  if(id==="other"&&!state.reportLocationIds.includes("other"))state.reportCustomLocation="";
  renderLocationChips();
  updateReportReadyState();
}
function updateReportReadyState(){
  const type=$("#occurrenceType")?.value||"",locationCount=state.reportLocationIds.length;
  const customOk=!state.reportLocationIds.includes("other")||($("#customLocation")?.value.trim().length>0);
  const avenueOk=type!=="avenue_flooding"||!!$("#avenueCondition")?.value;
  const damageOk=type!=="wind_damage"||state.reportDamageTypes.length>0;
  const ready=!!type&&(locationCount>0||(!isWeatherScopeType(type)&&state.selectedPoints.length>0))&&customOk&&avenueOk&&damageOk;
  if($("#submitReport"))$("#submitReport").disabled=!ready;

  const summary=$("#publishSummary");
  if(summary){
    if(!type){summary.hidden=true;return;}
    const locNames=state.reportLocationIds.map(reportLocationName).filter(Boolean);
    const pointCount=isWeatherScopeType(type)?0:state.selectedPoints.length;
    const damageText=type==="wind_damage"&&state.reportDamageTypes.length?`${state.reportDamageTypes.length} ${state.reportDamageTypes.length===1?"tipo de dano":"tipos de dano"}`:"";
    const bits=[
      `<b>${esc(typeLabel(type))}</b>`,
      locNames.length?`${locNames.length} ${locNames.length===1?"área":"áreas"}`:"",
      damageText,
      pointCount?`${pointCount} ${pointCount===1?"ponto":"pontos"} no mapa`:""
    ].filter(Boolean);
    summary.innerHTML=bits.join("<span>•</span>");
    summary.hidden=false;
  }
}
function severityFromText(text){
  const n=normText(text);
  if(/\b(intransitavel|nao passa|nao da para passar|impossivel|sem passagem|transbordando|muito perigoso|critico)\b/.test(n))return"critical";
  if(/ainda da para passar|ainda passa|passa com cuidado|pouca agua/.test(n))return"attention";
  if(/\b(alagada|alagado|inundada|inundado|forte|bloqueada|bloqueado|alerta)\b/.test(n))return"alert";
  return"attention";
}
function conditionFromText(text){
  const n=normText(text);
  if(/intransitavel|nao passa|nao da para passar|impossivel|sem passagem/.test(n))return"impassable";
  if(/parcial|meia pista|bloquead|ainda da para passar|ainda passa|passa com cuidado/.test(n))return"partially_blocked";
  if(/alag|inund/.test(n))return"flooding";
  if(/acumul|poca|subindo/.test(n))return"water_accumulating";
  return"flooding";
}
function condominiumMatchesFromText(text){
  const n=normText(text);
  if(/bairro inteiro|todo o bairro|todo bairro|deltaville inteiro|todo deltaville|todos os condominios|todos condominios/.test(n))return ["whole"];
  const ids=[];
  for(const condo of state.condominiums.filter(c=>c.active!==false)){
    const name=normText(condo.name);
    if(n.includes(name))ids.push(condominiumToken(condo.id));
  }
  return ids;
}
function locationMatchesFromText(text,type){
  if(isWeatherScopeType(type))return condominiumMatchesFromText(text);

  const n=normText(text),ids=[];
  if(isCommunityProblemType(type)){
    for(const id of condominiumMatchesFromText(text))if(!ids.includes(id))ids.push(id);
  }
  const addName=fragment=>{const loc=state.locations.find(l=>normText(l.name).includes(fragment));if(loc&&!ids.includes(loc.id))ids.push(loc.id);};
  if(/wilson/.test(n))addName("wilson castelo branco");
  if(/beira rio/.test(n))addName("beira rio");
  if(/egidio|richartz/.test(n))addName("egidio abelino richartz");
  if(/avenida deltaville|av deltaville/.test(n))addName("av. deltaville");
  if(type==="lakes_full"){
    if(/comercial/.test(n))addName("lagos av. comercial");
    if(/\bblue\b/.test(n))addName("lagos rodovia - blue");
    if(/\bgarden\b/.test(n))addName("lagos rodovia - garden");
    if(/deltaville/.test(n)&&!/avenida deltaville|av deltaville/.test(n))addName("lagos av. deltaville");
  }
  if((type==="river_level"||type==="river_overflow")&&/rio|biguacu/.test(n))addName("rio biguacu");
  for(const loc of allowedLocationsForType(type)){
    const ln=normText(loc.name).replace(/^av\.?\s*/,"").replace(/^lagos?\s*/,"");
    if(ln.length>6&&n.includes(ln)&&!ids.includes(loc.id))ids.push(loc.id);
  }
  return ids;
}
function aliasesForLocation(loc){
  const n=normText(loc?.name||""),aliases=[n];
  if(n.includes("wilson castelo branco"))aliases.push("wilson");
  if(n.includes("beira rio"))aliases.push("beira rio");
  if(n.includes("egidio abelino richartz"))aliases.push("egidio","richartz");
  if(n.includes("av. deltaville"))aliases.push("avenida deltaville","av deltaville");
  if(n.includes("lagos av. comercial"))aliases.push("lago comercial","comercial");
  if(n.includes("lagos rodovia - blue"))aliases.push("lago blue","blue");
  if(n.includes("lagos rodovia - garden"))aliases.push("lago garden","garden");
  if(n.includes("lagos av. deltaville"))aliases.push("lago deltaville");
  if(n.includes("rio biguacu"))aliases.push("rio","biguacu");
  return aliases;
}
function smartDetailsByLocation(text,locationIds,type){
  const clauses=String(text).split(/[.;\n]+|\bmas\b|\bporem\b|\bporém\b|\benquanto\b/i).map(x=>x.trim()).filter(Boolean),details={};
  for(const id of locationIds){
    if(isCondominiumToken(id)||id==="whole")continue;
    const loc=locationById(id);if(!loc)continue;const aliases=aliasesForLocation(loc);
    let detail={severity:severityFromText(text),condition:type==="avenue_flooding"?conditionFromText(text):null};
    for(const clause of clauses){const cn=normText(clause);if(aliases.some(a=>cn.includes(normText(a))))detail={severity:severityFromText(clause),condition:type==="avenue_flooding"?conditionFromText(clause):null};}
    details[id]=detail;
  }
  return details;
}
function damageTypesFromText(text){
  const n=normText(text),out=[];
  if(/arvore|galho/.test(n))out.push("tree");
  if(/telhado|destelh|estrutura|muro|cobertura/.test(n))out.push("roof");
  if(/poste|fiacao|fiação|energia|sem luz|eletric/.test(n))out.push("power");
  if(/carro|veiculo|veículo|automovel|automóvel/.test(n))out.push("vehicle");
  if(/dano|estrago|danific/.test(n)&&!out.length)out.push("other");
  return [...new Set(out)];
}
function smartParseDescription(text){
  const n=normText(text);let type="";
  if(/granizo/.test(n))type="hail";
  else if(/lampada|luminaria|iluminacao|poste apagado|sem luz na rua|luz da rua/.test(n))type="public_lighting";
  else if(/bueiro|boca de lobo|drenagem|ralo entup/.test(n))type="drainage_clogged";
  else if(/buraco|asfalto|pavimento|pista quebrada/.test(n))type="road_damage";
  else if(/placa|sinalizacao|sinalização|faixa apagada/.test(n))type="signage_issue";
  else if(/calcada|calçada|passeio|obstrucao na calcada|obstrução na calçada/.test(n))type="sidewalk_obstruction";
  else if(/falta de energia|sem energia|poste caido|poste caiu|fiacao|fiação|fio caido|fio caiu/.test(n))type="power_outage";
  else if(/esgoto|mau cheiro|vazamento de esgoto/.test(n))type="sewer_issue";
  else if(/lixo|entulho|descarte irregular|sujeira acumulada/.test(n))type="waste_accumulation";
  else if(/falta de agua|falta d agua|sem agua|vazamento de agua|cano rompido/.test(n))type="water_supply";
  else if(/muro quebrado|estrutura danificada|guarda corpo|equipamento quebrado|estrutura quebrada/.test(n))type="infrastructure_damage";
  else if(/arvore caiu|arvore caida|queda de arvore|galho caido|galho quebrado|arvore inclinada/.test(n)&&!/vendaval|vento forte|rajada/.test(n))type="tree_hazard";
  else if(/vendaval|vento forte|rajada/.test(n))type=/dano|estrago|danific|destelh|arvore caiu|queda de arvore|poste caiu|sem energia/.test(n)?"wind_damage":"wind_no_damage";
  else if(/rio/.test(n)&&/transbord/.test(n))type="river_overflow";
  else if(/rio|biguacu/.test(n)&&/subindo|nivel|cheio|enchendo/.test(n))type="river_level";
  else if(/lago/.test(n)&&/cheio|enchendo|transbord|nivel alto/.test(n))type="lakes_full";
  else if(/alag|inund|agua na via|rua cheia|avenida cheia/.test(n))type="avenue_flooding";
  else if(/chuva forte|chuva intensa|temporal|muita chuva/.test(n))type="heavy_rain_flood_risk";

  let severity=severityFromText(text);
  if(type==="wind_damage"&&severityRank[severity]<severityRank.alert)severity="alert";

  const condition=type==="avenue_flooding"?conditionFromText(text):null;
  const locationIds=type?locationMatchesFromText(text,type):[];
  const damageTypes=type==="wind_damage"?damageTypesFromText(text):[];
  const locationDetails=smartDetailsByLocation(text,locationIds,type);
  const overallSeverity=Object.values(locationDetails).reduce((best,d)=>severityRank[d.severity]>severityRank[best]?d.severity:best,severity);

  return {type,severity:overallSeverity,condition,locationIds,custom:"",text,locationDetails,damageTypes};
}
function applySmartParse(result){
  if(!result?.type){$("#reportError").textContent="Não consegui identificar o tipo. Toque em “Ajustar” e escolha manualmente.";$("#manualReportFields").hidden=false;return;}
  $("#reportError").textContent="";
  state.reportSource="smart";
  state.smartParsed=true;
  state.smartLocationDetails=result.locationDetails||{};
  state.reportLocationIds=[...result.locationIds];
  state.reportCustomLocation=result.custom||"";
  state.reportDamageTypes=[...(result.damageTypes||[])];
  setOccurrenceType(result.type,{keepLocations:true});
  if(result.condition)$("#avenueCondition").value=result.condition;
  const sev=$(`input[name="severity"][value="${result.severity}"]`);if(sev)sev.checked=true;
  $("#notes").value=result.text||"";if(result.custom)$("#customLocation").value=result.custom;renderLocationChips();
  $("#smartResultTitle").textContent=typeLabel(result.type);
  const smartLocationCount=result.locationIds.length;
  const damageChip=result.type==="wind_damage"&&result.damageTypes?.length?`<span class="smart-chip">${result.damageTypes.length} ${result.damageTypes.length===1?"dano":"danos"}</span>`:"";
  $("#smartSummaryChips").innerHTML=[
    `<span class="smart-chip ${result.severity}">${severityLabels[result.severity]}</span>`,
    result.condition?`<span class="smart-chip">${esc(conditionLabels[result.condition])}</span>`:"",
    smartLocationCount?`<span class="smart-chip">${smartLocationCount} ${smartLocationCount===1?"área":"áreas"}</span>`:"",
    damageChip
  ].filter(Boolean).join("");
  const locBox=$("#smartLocations");
  locBox.innerHTML=smartLocationCount?result.locationIds.map(id=>{
    const d=result.locationDetails?.[id];
    const detail=[d?.severity?severityLabels[d.severity]:"",d?.condition?conditionLabels[d.condition]:""].filter(Boolean).join(" • ");
    return `<span>⌖ ${esc(reportLocationName(id)||"Local")}${detail?` <i>${esc(detail)}</i>`:""}</span>`;
  }).join(""):'<span class="smart-needs-location">Local não identificado — toque em Ajustar.</span>';
  $("#smartResult").hidden=false;
  $("#manualReportFields").hidden=mobileReportLayout()?false:true;
  renderDamageUI();
  updateReportReadyState();
  if(!state.reportLocationIds.length||(result.type==="wind_damage"&&!state.reportDamageTypes.length)){
    $("#manualReportFields").hidden=false;
    $("#locationBlock").hidden=false;
    renderLocationChips();
    renderDamageUI();
  }
}
function mobileReportLayout(){
  return window.matchMedia("(max-width:1179px)").matches;
}
function showMobileReportCategories(){
  if(!mobileReportLayout())return;
  const manual=$("#manualReportFields");
  if(manual){
    manual.hidden=false;
    renderLocationChips();
    updateReportReadyState();
  }
}

function analyzeSmartDescription(){
  const text=$("#smartDescription").value.trim();
  if(text.length<4){$("#reportError").textContent="Descreva rapidamente o que está acontecendo.";return;}
  applySmartParse(smartParseDescription(text));
}
function setReportMode(mode){
  const editing=mode==="edit";$("#reportKicker").textContent=editing?"EDITAR REGISTRO":"NOVO REGISTRO";$("#reportTitle").textContent=editing?"Editar ocorrência":"Registrar ocorrência";$("#submitReport").textContent=editing?"Salvar":"Publicar";$("#deleteOccurrenceBtn").hidden=!editing;if($("#smartComposer"))$("#smartComposer").hidden=editing;
}
function resetReportState({preserveMap=false}={}){
  state.reportLocationIds=[];state.reportCustomLocation="";state.reportSource="manual";state.smartParsed=false;state.smartLocationDetails={};state.reportDamageTypes=[];state.editingOccurrenceId=null;state.editingOccurrenceGroupId=null;state.editingOccurrenceIds=[];
  resetReportPhotos();
  $("#reportForm")?.reset();$("#occurrenceType").value="";$("#smartDescription").value="";$("#smartResult").hidden=true;$("#manualReportFields").hidden=true;$("#locationChips").innerHTML="";$("#locationBlock").hidden=true;$("#conditionBlock").hidden=true;$("#customLocationWrap").hidden=true;$("#publishSummary").hidden=true;$("#reportError").textContent="";
  if(!preserveMap){clearSelectedPoint({silent:true});clearSegmentSelection({silent:true});}updateReportReadyState();
}
function restoreOccurrenceGroup(items){
  clearSelectedPoint({silent:true});clearSegmentSelection({silent:true});state.reportLocationIds=[];const first=items[0];
  revokeReportPhotoPreviews();
  state.reportPhotos=occurrencePhotoList(items).slice(0,3).map(ph=>({...ph,kind:"existing"}));
  state.removedPhotoIds=[];
  renderReportPhotos();
  state.smartLocationDetails={};
  state.reportDamageTypes=[...(first?._meta?.damageTypes||[])];
  const weatherEdit=isWeatherScopeType(first?.occurrence_type);
  for(const o of items){
    if(o.location_id){
      if(!state.reportLocationIds.includes(o.location_id))state.reportLocationIds.push(o.location_id);
      state.smartLocationDetails[o.location_id]={severity:o.severity,condition:o.avenue_condition||null};
    }
    if(!o.location_id&&o.custom_location){
      if(weatherEdit){
        const normalized=normText(o.custom_location);
        if(normalized.includes("bairro deltaville")||o._meta?.scope==="whole"){
          if(!state.reportLocationIds.includes("whole"))state.reportLocationIds.push("whole");
        }else{
          const condo=state.condominiums.find(c=>normText(c.name)===normalized);
          if(condo){
            const token=condominiumToken(condo.id);
            if(!state.reportLocationIds.includes(token))state.reportLocationIds.push(token);
          }
        }
      }else{
        if(!state.reportLocationIds.includes("other"))state.reportLocationIds.push("other");
        state.reportCustomLocation=o.custom_location;
        $("#customLocation").value=o.custom_location;
      }
    }
    if(o.exact_map_x!=null&&o.exact_map_y!=null){const ll=normalizedToLatLng(o.exact_map_x,o.exact_map_y);state.selectedPoints.push({lat:Number(ll[0]),lng:Number(ll[1]),map_x:Number(o.exact_map_x),map_y:Number(o.exact_map_y),loc:o.location_id?locationById(o.location_id):null});}
  }
  state.selectedPoint=state.selectedPoints.at(-1)||null;renderSelectedPointMarkers();
  const seg=items.find(o=>o._meta?.mode==="segment");if(seg?.location_id){state.selectedSegment={avenueId:seg.location_id,startRatio:Number(seg._meta.startRatio)||0,endRatio:Number(seg._meta.endRatio)||0,span:Number.isFinite(Number(seg._meta.span))?Number(seg._meta.span):undefined,wrap:!!seg._meta.wrap};renderSelectedSegmentLayers();}
  $("#occurrenceType").value=first.occurrence_type;setOccurrenceType(first.occurrence_type,{keepLocations:true});if(first.avenue_condition)$("#avenueCondition").value=first.avenue_condition;const sev=$(`input[name="severity"][value="${first.severity}"]`);if(sev)sev.checked=true;$("#notes").value=noteText(first)||"";$("#manualReportFields").hidden=false;$("#smartResult").hidden=true;renderLocationChips();renderDamageUI();updateSelectedPointUI();updateReportReadyState();
}
function openReport(source="general"){
  if(!state.profile){showAccess("login");toast("Entre no aplicativo primeiro.");return;}
  const keepMap=state.selectedPoints.length>0||!!state.selectedSegment;resetReportState({preserveMap:keepMap});setReportMode("new");
  if(keepMap){
    for(const p of state.selectedPoints)if(p.loc&&!state.reportLocationIds.includes(p.loc.id))state.reportLocationIds.push(p.loc.id);
    const inferred=state.selectedPoints[0]?.loc;if(inferred){const type=inferred.category==="avenue"?"avenue_flooding":inferred.category==="lake"?"lakes_full":inferred.category==="river"?"river_level":"";if(type)setOccurrenceType(type,{keepLocations:true});}
    if(state.selectedSegment){if(!state.reportLocationIds.includes(state.selectedSegment.avenueId))state.reportLocationIds.push(state.selectedSegment.avenueId);setOccurrenceType("avenue_flooding",{keepLocations:true});}
    $("#manualReportFields").hidden=false;renderLocationChips();
  }
  $("#reportModal").hidden=false;
  showMobileReportCategories();
  updateReportReadyState();
}
function openEditOccurrence(id){
  const first=state.occurrences.find(x=>String(x.id)===String(id));if(!first||first.reporter_id!==state.user?.id){toast("Você só pode editar suas próprias ocorrências.");return;}
  const gid=groupIdOf(first),items=gid?state.occurrences.filter(o=>groupIdOf(o)===gid):[first];
  state.editingOccurrenceId=first.id;state.editingOccurrenceGroupId=gid;state.editingOccurrenceIds=items.map(o=>o.id);setReportMode("edit");$("#reportForm").reset();restoreOccurrenceGroup(items);$("#reportModal").hidden=false;
}
function closeModal(id){
  $("#"+id).hidden=true;
  if(id==="reportModal"){
    state.editingOccurrenceId=null;state.editingOccurrenceGroupId=null;state.editingOccurrenceIds=[];setReportMode("new");
  }
}

async function submitProfile(e){
  e.preventDefault();
  if(!state.user||!state.profile)return;
  const data={
    first_name:$("#editFirstName").value.trim(),
    last_name:$("#editLastName").value.trim(),
    condominium_id:$("#editCondominium").value,
    house_or_lot:$("#editHouseLot").value.trim()
  };
  const errEl=$("#editProfileError"); errEl.textContent="";
  if(!data.first_name||!data.last_name||!data.condominium_id||!data.house_or_lot){errEl.textContent="Preencha todos os campos.";return;}
  if(!validHouseLot(data.house_or_lot)){errEl.textContent=houseLotError();return;}
  data.house_or_lot=String(Number(normalizeHouseLotInput(data.house_or_lot)));
  try{
    const {error}=await db.from("profiles").update(data).eq("user_id",state.user.id);
    if(error)throw error;
    await loadProfile();renderProfile();closeModal("profileModal");
    toast("Cadastro atualizado.");
  }catch(err){console.error(err);errEl.textContent="Não foi possível salvar. Tente novamente.";}
}

function handleInstall(){
  const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone===true;
  if(standalone){toast("O Monitora Deltaville já está instalado neste aparelho.");return;}
  if(state.installPrompt){
    state.installPrompt.prompt();
    state.installPrompt.userChoice.finally(()=>{state.installPrompt=null;});
    return;
  }
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(ios){
    alert("No iPhone: abra o Monitora Deltaville no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.");
  }else{
    alert("Abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.");
  }
}
function locationCompatibleWithType(type,loc){
  if(!loc)return false;if(type==="avenue_flooding")return loc.category==="avenue";if(type==="lakes_full")return loc.category==="lake";if(type==="river_level"||type==="river_overflow")return loc.category==="river";return true;
}
function buildReportTargets(){
  const type=$("#occurrenceType").value,targets=[],represented=new Set();

  if(isWeatherScopeType(type)){
    for(const raw of state.reportLocationIds){
      const id=String(raw);
      if(id==="whole"){
        const n=neighborhoodNormalized();
        targets.push({location_id:null,custom_location:"Bairro Deltaville",exact_map_x:n.map_x,exact_map_y:n.map_y,scope:"whole"});
        continue;
      }
      if(isCondominiumToken(id)){
        const condo=condominiumByToken(id);
        if(!condo)continue;
        const n=condominiumNormalized(condo.name);
        targets.push({location_id:null,custom_location:condo.name,exact_map_x:n.map_x,exact_map_y:n.map_y,scope:"condominium",condominiumId:condo.id});
      }
    }
    return targets;
  }

  if(type==="avenue_flooding"&&state.selectedSegment){
    const locId=String(state.selectedSegment.avenueId);
    if(state.reportLocationIds.some(id=>String(id)===locId)){
      const pts=avenuePointsByLocationId(locId);if(pts){const mid=selectedSegmentMidpoint(pts,state.selectedSegment),n=latLngToNormalized({lat:mid[0],lng:mid[1]});targets.push({location_id:locId,custom_location:null,exact_map_x:n.map_x,exact_map_y:n.map_y,segment:{startRatio:state.selectedSegment.startRatio,endRatio:state.selectedSegment.endRatio,span:Number(state.selectedSegment.span)||0,wrap:!!state.selectedSegment.wrap}});represented.add(locId);}
    }
  }
  state.selectedPoints.forEach((point,index)=>{
    const loc=point.loc&&locationCompatibleWithType(type,point.loc)?point.loc:null,locId=loc?String(loc.id):null;
    if(locId&&represented.has(locId)&&String(state.selectedSegment?.avenueId)===locId)return;
    targets.push({location_id:locId,custom_location:locId?null:`Ponto ${index+1} marcado no mapa`,exact_map_x:point.map_x,exact_map_y:point.map_y,pointIndex:index+1});if(locId)represented.add(locId);
  });
  for(const raw of state.reportLocationIds){
    const id=String(raw);
    if(id==="whole"){
      const n=neighborhoodNormalized();
      targets.push({location_id:null,custom_location:"Bairro Deltaville",exact_map_x:n.map_x,exact_map_y:n.map_y,scope:"whole"});
      continue;
    }
    if(isCondominiumToken(id)){
      const condo=condominiumByToken(id);if(!condo)continue;
      const n=condominiumNormalized(condo.name);
      targets.push({location_id:null,custom_location:condo.name,exact_map_x:n.map_x,exact_map_y:n.map_y,scope:"condominium",condominiumId:condo.id});
      continue;
    }
    if(id==="other"){targets.push({location_id:null,custom_location:$("#customLocation").value.trim()||state.reportCustomLocation||"Deltaville",exact_map_x:null,exact_map_y:null});continue;}
    if(represented.has(id))continue;const loc=locationById(id);if(!loc||!locationCompatibleWithType(type,loc))continue;targets.push({location_id:id,custom_location:null,exact_map_x:null,exact_map_y:null});represented.add(id);
  }
  if(!targets.length&&["hail","wind_damage","wind_no_damage","heavy_rain_flood_risk"].includes(type))targets.push({location_id:null,custom_location:"Deltaville",exact_map_x:null,exact_map_y:null});
  return targets;
}
function makeOccurrencePayloads(){
  const type=$("#occurrenceType").value;if(!type)throw new Error("Escolha ou descreva o que aconteceu.");
  const targets=buildReportTargets();if(!targets.length)throw new Error("Informe pelo menos um local ou marque um ponto no mapa.");
  const globalSeverity=$('input[name="severity"]:checked')?.value||"attention",globalCondition=type==="avenue_flooding"?($("#avenueCondition").value||"flooding"):null,note=$("#notes").value.trim()||$("#smartDescription").value.trim()||null,groupId=targets.length>1?(state.editingOccurrenceGroupId||makeGroupId()):null;
  return targets.map((t,index)=>{
    const detail=t.location_id?state.smartLocationDetails?.[t.location_id]:null,severity=detail?.severity||globalSeverity,avenueCondition=type==="avenue_flooding"?(detail?.condition||globalCondition):null;
    const meta={
      ...(groupId?{groupId,groupTotal:targets.length,groupIndex:index+1}:{}),
      source:state.reportSource,
      ...(t.scope?{scope:t.scope}:{}),
      ...(t.condominiumId?{condominiumId:t.condominiumId}:{}),
      ...(type==="wind_damage"&&state.reportDamageTypes.length?{damageTypes:[...state.reportDamageTypes]}:{})
    };
    if(t.segment){meta.mode="segment";meta.startRatio=t.segment.startRatio;meta.endRatio=t.segment.endRatio;meta.span=Number(t.segment.span)||0;meta.wrap=!!t.segment.wrap;}else if(t.pointIndex){meta.mode="point";meta.pointIndex=t.pointIndex;}
    return {location_id:t.location_id,custom_location:t.custom_location,occurrence_type:type,avenue_condition:avenueCondition,severity,notes:encodeOccurrenceNotes(note,meta),exact_map_x:t.exact_map_x,exact_map_y:t.exact_map_y,reporter_id:state.user.id};
  });
}
async function submitReport(e){
  e.preventDefault();
  const btn=$("#submitReport");
  btn.disabled=true;
  $("#reportError").textContent="";
  let photoWarning="";
  try{
    const payloads=makeOccurrencePayloads();
    const oldIds=[...state.editingOccurrenceIds];
    let primaryOccurrenceId=null;

    if(oldIds.length){
      if(oldIds.length===1&&payloads.length===1){
        const update={...payloads[0]};
        delete update.reporter_id;
        const {data,error}=await db.from("occurrences")
          .update(update)
          .eq("id",oldIds[0])
          .eq("reporter_id",state.user.id)
          .select("id")
          .single();
        if(error)throw error;
        primaryOccurrenceId=data.id;

        try{
          await removeMarkedExistingPhotos();
          await uploadNewReportPhotos(primaryOccurrenceId);
        }catch(photoErr){
          console.error("Falha nas fotos:",photoErr);
          photoWarning=" Alterações salvas, mas não foi possível concluir todas as fotos.";
        }
      }else{
        const {data:newRows,error:insertError}=await db.from("occurrences")
          .insert(payloads)
          .select("id");
        if(insertError)throw insertError;
        const newIds=(newRows||[]).map(r=>r.id);
        primaryOccurrenceId=newIds[0]||null;
        if(!primaryOccurrenceId)throw new Error("Não foi possível criar a ocorrência atualizada.");

        try{
          await moveExistingPhotosToOccurrence(primaryOccurrenceId);
          await removeMarkedExistingPhotos();
        }catch(photoMoveErr){
          console.error(photoMoveErr);
          if(newIds.length){
            try{await db.from("occurrences").delete().in("id",newIds).eq("reporter_id",state.user.id);}catch(_){}
          }
          throw new Error("Não foi possível preservar as fotos da ocorrência. Tente novamente.");
        }

        const {error:deleteError}=await db.from("occurrences")
          .delete()
          .in("id",oldIds)
          .eq("reporter_id",state.user.id);
        if(deleteError)throw deleteError;

        try{
          await uploadNewReportPhotos(primaryOccurrenceId);
        }catch(photoErr){
          console.error("Falha no upload das novas fotos:",photoErr);
          photoWarning=" Ocorrência atualizada, mas alguma foto nova não foi enviada.";
        }
      }

      toast(`Ocorrência atualizada.${photoWarning}`);
    }else{
      const {data:newRows,error}=await db.from("occurrences")
        .insert(payloads)
        .select("id");
      if(error)throw error;
      primaryOccurrenceId=newRows?.[0]?.id||null;
      if(!primaryOccurrenceId)throw new Error("Não foi possível concluir o registro.");

      // O envio push é independente do salvamento da ocorrência.
      sendOccurrencePush((newRows||[]).map(r=>r.id)).catch(err=>console.warn("Push não enviado:",err));

      try{
        await uploadNewReportPhotos(primaryOccurrenceId);
      }catch(photoErr){
        console.error("Falha no upload das fotos:",photoErr);
        photoWarning=" A ocorrência foi publicada, mas alguma foto não foi enviada.";
      }

      toast(payloads.length>1
        ?`${payloads.length} locais publicados em uma ocorrência.${photoWarning}`
        :`Ocorrência publicada.${photoWarning}`);
    }

    closeModal("reportModal");
    clearSelectedPoint({silent:true});
    clearSegmentSelection({silent:true});
    resetReportState({preserveMap:false});
    await loadDataSafe();
    renderAll();
  }catch(err){
    console.error(err);
    $("#reportError").textContent=err.message||"Não foi possível salvar.";
    updateReportReadyState();
  }finally{
    btn.disabled=false;
  }
}
async function deleteOwnOccurrenceById(id){
  const first=state.occurrences.find(x=>String(x.id)===String(id));
  if(!first||first.reporter_id!==state.user?.id){toast("Você só pode apagar suas próprias ocorrências.");return;}
  const gid=groupIdOf(first);
  const items=gid?state.occurrences.filter(o=>groupIdOf(o)===gid):[first];
  const ids=items.map(o=>o.id);
  const label=ids.length>1?`Apagar esta ocorrência com ${ids.length} locais?`:"Apagar esta ocorrência?";
  if(!confirm(`${label} Essa ação não pode ser desfeita.`))return;
  try{
    const photos=occurrencePhotoList(items);
    const paths=photos.map(ph=>ph.storage_path).filter(Boolean);
    if(paths.length){
      try{
        const {error:storageError}=await db.storage.from("occurrence-photos").remove(paths);
        if(storageError)console.warn("Não foi possível remover todos os arquivos de foto:",storageError);
      }catch(err){console.warn(err);}
    }
    const {error}=await db.from("occurrences")
      .delete()
      .in("id",ids)
      .eq("reporter_id",state.user.id);
    if(error)throw error;
    toast("Ocorrência apagada.");
    await loadDataSafe();
    renderAll();
  }catch(err){
    console.error(err);
    toast("Não foi possível apagar a ocorrência.");
  }
}

async function deleteEditingOccurrence(){
  const ids=state.editingOccurrenceIds.length?state.editingOccurrenceIds:(state.editingOccurrenceId?[state.editingOccurrenceId]:[]);
  if(!ids.length)return;
  if(!confirm(`${ids.length>1?`Apagar esta ocorrência com ${ids.length} locais?`:"Apagar esta ocorrência?"} Essa ação não pode ser desfeita.`))return;
  const btn=$("#deleteOccurrenceBtn");btn.disabled=true;
  try{
    const items=state.occurrences.filter(o=>ids.includes(o.id));
    const photos=occurrencePhotoList(items);
    const paths=photos.map(ph=>ph.storage_path).filter(Boolean);
    if(paths.length){
      try{
        const {error:storageError}=await db.storage.from("occurrence-photos").remove(paths);
        if(storageError)console.warn("Não foi possível remover todos os arquivos de foto:",storageError);
      }catch(err){console.warn(err);}
    }

    const {error}=await db.from("occurrences")
      .delete()
      .in("id",ids)
      .eq("reporter_id",state.user.id);
    if(error)throw error;

    closeModal("reportModal");
    clearSelectedPoint({silent:true});
    clearSegmentSelection({silent:true});
    resetReportState({preserveMap:false});
    toast("Ocorrência apagada.");
    await loadDataSafe();renderAll();
  }catch(err){
    console.error(err);
    $("#reportError").textContent="Não foi possível apagar a ocorrência.";
  }finally{
    btn.disabled=false;
  }
}

let realtimeRefreshTimer=null;
const realtimePendingSources=new Set();
function scheduleRealtimeRefresh(keys=["occurrences","recentResolved","alerts"]){
  keys.forEach(key=>realtimePendingSources.add(key));
  if(document.visibilityState!=="visible"||!navigator.onLine){state.realtimeDirty=true;return;}
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer=setTimeout(async()=>{
    if(dataLoadInFlight)await dataLoadInFlight;
    const sources=[...realtimePendingSources];realtimePendingSources.clear();
    if(sources.length)await loadDataSafe(sources);
    renderAll();
  },1000);
}
function subscribeRealtime(){
  if(state.realtimeChannel)db.removeChannel(state.realtimeChannel).catch(()=>{});
  state.realtimeChannel=db.channel("monitora-community")
    .on("postgres_changes",{event:"*",schema:"public",table:"occurrences"},payload=>{
      scheduleRealtimeRefresh(["occurrences","recentResolved"]);
      // Ocorrências novas usam Web Push no servidor; evitamos duplicar notificações em primeiro plano.
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"alerts"},payload=>{
      scheduleRealtimeRefresh(["alerts"]);
      if(payload.eventType==="INSERT")notifyLocal("Novo alerta no Monitora Deltaville",payload.new?.title||"Há um novo alerta ativo.");
    }).subscribe();
}
window.addEventListener("offline",()=>{renderConnection();if(state.initialized)renderStatus();});
window.addEventListener("online",async()=>{
  if(!state.initialized){await bootstrap();return;}
  await loadDataSafe();renderAll();await loadRiverStatus();
});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&state.initialized){
    renderConnection();renderStatus();
    if(state.realtimeDirty){state.realtimeDirty=false;scheduleRealtimeRefresh();}
  }
});
// Keep expiry semantics accurate even without database events.
setInterval(()=>{if(state.initialized&&document.visibilityState==="visible"){renderStatus();renderAll();}},60000);
// Offline submissions are never queued or reported as successful.
document.addEventListener("submit",event=>{
  if(!navigator.onLine){event.preventDefault();event.stopImmediatePropagation();toast("Sem conexão. Reconecte para enviar; seus campos continuam preenchidos.");}
},true);
function startSmartVoice(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Recognition){toast("Use o microfone do teclado do iPhone para ditar a ocorrência.");return;}
  const rec=new Recognition();rec.lang="pt-BR";rec.interimResults=false;rec.maxAlternatives=1;
  const btn=$("#smartMicBtn");if(btn){btn.disabled=true;btn.textContent="Ouvindo…";}
  rec.onresult=e=>{const spoken=e.results?.[0]?.[0]?.transcript||"";if(spoken){const field=$("#smartDescription");field.value=(field.value?field.value+" ":"")+spoken;analyzeSmartDescription();}};
  rec.onerror=()=>toast("Não consegui ouvir. Você pode digitar a ocorrência.");
  rec.onend=()=>{if(btn){btn.disabled=false;btn.textContent="◉ Falar";}};
  try{rec.start();}catch(_){if(btn){btn.disabled=false;btn.textContent="◉ Falar";}}
}

document.addEventListener("click",e=>{
  const viewPhoto=e.target.closest("[data-view-photo]");
  if(viewPhoto){e.stopPropagation();openPhotoViewer(viewPhoto.dataset.viewPhoto);return;}
  const removePhoto=e.target.closest("[data-remove-report-photo]");
  if(removePhoto){e.stopPropagation();removeReportPhotoAt(Number(removePhoto.dataset.removeReportPhoto));return;}
  const nav=e.target.closest("[data-nav]");if(nav){navigate(nav.dataset.nav);return;}
  if(e.target.closest("#homeReport,#navReport,[data-desktop-report]")){openReport();return;}
  if(e.target.closest("#mapReport")){openReport("map");return;}
  if(e.target.closest("#reportHereBtn")){if(state.multiPointMode){state.multiPointMode=false;setPointPickMode(false,{multi:false});openReport("map");}else{prefillOccurrenceFromSelectedPoint();openReport("map");}return;}
  if(e.target.closest("#reportSegmentBtn")){openReport("map");return;}
  const close=e.target.closest("[data-close]");if(close){closeModal(close.dataset.close==="report"?"reportModal":"profileModal");return;}
  const removeOccurrence=e.target.closest("[data-delete-occurrence]");if(removeOccurrence){e.preventDefault();e.stopPropagation();deleteOwnOccurrenceById(removeOccurrence.dataset.deleteOccurrence);return;}
  const edit=e.target.closest("[data-edit-occurrence]");if(edit){e.stopPropagation();openEditOccurrence(edit.dataset.editOccurrence);return;}
  const occ=e.target.closest("[data-open-occurrence]");if(occ){focusOccurrenceOnMap(occ.dataset.openOccurrence);return;}
  const focus=e.target.closest("[data-focus-location]");if(focus){focusLocationById(focus.dataset.focusLocation);return;}
  const mf=e.target.closest("[data-filter]");if(mf){$$("[data-filter]").forEach(x=>x.classList.remove("selected"));mf.classList.add("selected");state.filter=mf.dataset.filter;hideMapFocusCard();renderMapMarkers();return;}
  const af=e.target.closest("[data-alert-filter]");if(af){$$("[data-alert-filter]").forEach(x=>x.classList.remove("selected"));af.classList.add("selected");state.alertFilter=af.dataset.alertFilter;renderAlertsPage();return;}
  const am=e.target.closest("[data-access-mode]");if(am){switchAccessMode(am.dataset.accessMode);return;}
  const typeBtn=e.target.closest("[data-occ-type]");if(typeBtn){
    state.reportSource="manual";state.smartParsed=false;
    const type=typeBtn.dataset.occType;
    if(isWeatherScopeType(type)){clearSelectedPoint({silent:true});clearSegmentSelection({silent:true});}
    setOccurrenceType(type);
    if(type==="wind_damage"){
      const alertRadio=$('input[name="severity"][value="alert"]');
      if(alertRadio)alertRadio.checked=true;
    }
    updateReportReadyState();return;
  }
  const locBtn=e.target.closest("[data-report-location]");if(locBtn){toggleReportLocation(locBtn.dataset.reportLocation);return;}
  const damageBtn=e.target.closest("[data-damage-type]");if(damageBtn){toggleDamageType(damageBtn.dataset.damageType);return;}
});
document.addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const occ=e.target.closest?.("[data-open-occurrence]");if(!occ||e.target.closest("[data-edit-occurrence]"))return;e.preventDefault();focusOccurrenceOnMap(occ.dataset.openOccurrence);});

$$(".numeric-field").forEach(input=>{
  input.addEventListener("input",()=>{
    const clean=normalizeHouseLotInput(input.value);
    if(input.value!==clean)input.value=clean;
    input.classList.remove("invalid");
  });
  input.addEventListener("blur",()=>{
    if(input.value&&!validHouseLot(input.value))input.classList.add("invalid");
    else input.classList.remove("invalid");
  });
});

$$(".pin-field").forEach(input=>{
  input.addEventListener("input",()=>{
    const clean=String(input.value||"").replace(/\D/g,"").slice(0,6);
    if(input.value!==clean)input.value=clean;
  });
});

$$(".password-eye").forEach(btn=>{
  btn.addEventListener("click",e=>{
    e.preventDefault();
    e.stopPropagation();
    togglePinVisibility(btn);
  });
});

// v7.0.1 — direct navigation bindings for iOS/PWA reliability
$("[data-nav]").forEach(btn=>{
  if(btn.dataset.directNavBound==="1")return;
  btn.dataset.directNavBound="1";
  btn.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    navigate(btn.dataset.nav);
  });
});

$("#editProfileForm").addEventListener("submit",submitProfile);
$("#reportForm").addEventListener("submit",submitReport);
$("#loginForm").addEventListener("submit",handleLogin);
$("#registerForm").addEventListener("submit",handleRegister);
$("#legacyForm").addEventListener("submit",handleLegacyClaim);
$("#legacyAccessBtn").addEventListener("click",()=>switchAccessMode("legacy"));
$("#adminEntryBtn")?.addEventListener("click",()=>navigate("admin"));
$("#adminRefreshBtn")?.addEventListener("click",loadAdminData);
$("#adminAlertForm")?.addEventListener("submit",publishAdminAlert);
$("#adminOccurrencesList")?.addEventListener("click",event=>{
  const resolveBtn=event.target.closest("[data-admin-resolve]");
  const deleteBtn=event.target.closest("[data-admin-delete]");
  if(resolveBtn)adminResolveOccurrence(resolveBtn.dataset.adminResolve);
  if(deleteBtn)adminDeleteOccurrence(deleteBtn.dataset.adminDelete);
});
$("#editProfileBtn").addEventListener("click",()=>{const p=state.profile;if(!p)return;$("#editFirstName").value=p.first_name;$("#editLastName").value=p.last_name;$("#editCondominium").value=p.condominium_id;setHouseValue("editHouseLot",p.house_or_lot);$("#profileModal").hidden=false;});
$("#upgradeLegacyBtn").addEventListener("click",()=>{prefillLegacyFromProfile();showAccess("legacy");});
$("#logoutBtn").addEventListener("click",logoutAndSwitch);
$("#notifyBtn").addEventListener("click",()=>navigate("alerts"));
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.installPrompt=e;});
$("#installBtn").addEventListener("click",handleInstall);
$("#pushToggle")?.addEventListener("click",togglePushNotifications);
$$("[data-push-level]").forEach(btn=>btn.addEventListener("click",()=>setPushMinimumSeverity(btn.dataset.pushLevel)));

$("#takePhotoBtn")?.addEventListener("click",()=>$("#photoCameraInput")?.click());
$("#choosePhotoBtn")?.addEventListener("click",()=>$("#photoLibraryInput")?.click());
$("#photoCameraInput")?.addEventListener("change",async e=>{
  await addReportPhotoFiles(e.target.files);
  e.target.value="";
});
$("#photoLibraryInput")?.addEventListener("change",async e=>{
  await addReportPhotoFiles(e.target.files);
  e.target.value="";
});
$("#photoViewerClose")?.addEventListener("click",closePhotoViewer);
$("#photoViewerX")?.addEventListener("click",closePhotoViewer);

$("#smartAnalyzeBtn")?.addEventListener("click",analyzeSmartDescription);
$("#smartMicBtn")?.addEventListener("click",startSmartVoice);
$("#smartAdjustBtn")?.addEventListener("click",()=>{$("#manualReportFields").hidden=false;renderLocationChips();updateReportReadyState();});
$("#manualReportToggle")?.addEventListener("click",()=>{const box=$("#manualReportFields");box.hidden=!box.hidden;if(!box.hidden){renderLocationChips();updateReportReadyState();}});
$("#smartDescription")?.addEventListener("input",()=>{if(state.smartParsed){state.smartParsed=false;$("#smartResult").hidden=true;}});
$("#customLocation")?.addEventListener("input",e=>{state.reportCustomLocation=e.target.value.trim();updateReportReadyState();});
$("#avenueCondition")?.addEventListener("change",()=>{state.smartLocationDetails={};state.reportSource="manual";updateReportReadyState();});
$$('input[name="severity"]').forEach(el=>el.addEventListener("change",()=>{state.smartLocationDetails={};state.reportSource="manual";updateReportReadyState();}));

$("#pickPointBtn").addEventListener("click",()=>{navigate("map");const next=!state.pointPickMode;setPointPickMode(next,{multi:false});if(next)toast("Toque no ponto exato ou pressione e segure.");});
$("#goPickPointBtn")?.addEventListener("click",()=>{closeModal("reportModal");navigate("map");setPointPickMode(true,{multi:true});toast("Marque quantos pontos precisar. Depois toque em “Concluir”.");});
$("#segmentPickBtn")?.addEventListener("click",startSegmentPickFromReport);
$("#clearSegmentBtn")?.addEventListener("click",()=>{clearSegmentSelection();updateReportReadyState();});
$("#clearMapSegmentBtn")?.addEventListener("click",()=>clearSegmentSelection());
$("#clearMapPointBtn").addEventListener("click",()=>clearSelectedPoint());
$("#clearReportPointBtn")?.addEventListener("click",()=>clearSelectedPoint());
$("#deleteOccurrenceBtn").addEventListener("click",deleteEditingOccurrence);


if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(console.warn));
decorateOccurrenceTypeButtons();
initTheme();
bootstrap();


/* v5.0.2 — UX review hotfixes */
(function(){
  const bindProfileShortcut=()=>{
    const trigger=document.querySelector('.desktop-profile-trigger');
    if(!trigger||trigger.dataset.boundProfileNav==='1')return;
    trigger.dataset.boundProfileNav='1';
    const open=(e)=>{
      e.preventDefault();
      e.stopPropagation();
      navigate('profile');
    };
    trigger.addEventListener('click',open);
    trigger.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){ open(e); }
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindProfileShortcut,{once:true});
  else bindProfileShortcut();
})();

