import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SOURCE_PAGE = "https://ciram.epagri.sc.gov.br/index.php/avisos-meteorologicos/";
const SOURCE_NAME = "Epagri/Ciram";
const USER_AGENT = "MonitoraDeltaville/1.0";

let memoryCache: { expires:number; payload:any } | null = null;

function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      ...cors,
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"public, max-age=300"
    }
  });
}

function decodeEntities(input:string){
  const map:Record<string,string>={
    "&nbsp;":" ","&#160;":" ","&amp;":"&","&#039;":"'","&apos;":"'","&lt;":"<","&gt;":">",
    "&aacute;":"á","&Aacute;":"Á","&atilde;":"ã","&Atilde;":"Ã","&acirc;":"â","&Acirc;":"Â",
    "&eacute;":"é","&Eacute;":"É","&ecirc;":"ê","&Ecirc;":"Ê","&iacute;":"í","&Iacute;":"Í",
    "&oacute;":"ó","&Oacute;":"Ó","&ocirc;":"ô","&Ocirc;":"Ô","&otilde;":"õ","&Otilde;":"Õ",
    "&uacute;":"ú","&Uacute;":"Ú","&ccedil;":"ç","&Ccedil;":"Ç","&ndash;":"–","&mdash;":"—"
  };
  let out=input.replace(/&(nbsp|#160|amp|#039|apos|lt|gt|aacute|Aacute|atilde|Atilde|acirc|Acirc|eacute|Eacute|ecirc|Ecirc|iacute|Iacute|oacute|Oacute|ocirc|Ocirc|otilde|Otilde|uacute|Uacute|ccedil|Ccedil|ndash|mdash);/g,m=>map[m]??m);
  out=out.replace(/&quot;/g,String.fromCharCode(34));
  out=out.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
  out=out.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
  return out;
}

function htmlToText(html:string){
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi," ")
      .replace(/<style[\s\S]*?<\/style>/gi," ")
      .replace(/<br\s*\/?\s*>/gi,"\n")
      .replace(/<\/(p|div|li|h1|h2|h3|h4|section|article)>/gi,"\n")
      .replace(/<[^>]+>/g," ")
  )
    .replace(/\r/g,"")
    .split("\n")
    .map(s=>s.replace(/\s+/g," ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractTitle(html:string){
  const m=html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  return m?htmlToText(m[1]).replace(/\n/g," ").trim():"";
}

function extractField(text:string,label:string){
  const re=new RegExp("^"+label+"\\s*:?\\s*(.+)$","im");
  return text.match(re)?.[1]?.trim()||null;
}

function parseBRDate(value:string|null){
  if(!value)return null;
  const m=value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*?(\d{1,2})h(\d{2})/i);
  if(!m)return null;
  const dd=m[1],mm=m[2],yyyy=m[3],hh=m[4],min=m[5];
  const iso=yyyy+"-"+String(mm).padStart(2,"0")+"-"+String(dd).padStart(2,"0")+"T"+String(hh).padStart(2,"0")+":"+String(min).padStart(2,"0")+":00-03:00";
  const d=new Date(iso);
  return Number.isNaN(d.getTime())?null:d.toISOString();
}

function normalize(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

function classifyEvents(title:string,forecast:string){
  const t=normalize(title+" "+forecast);
  const events:string[]=[];
  const add=(x:string)=>{if(!events.includes(x))events.push(x);};
  if(/tempestad|temporal|trovoad/.test(t))add("storm");
  if(/granizo/.test(t))add("hail");
  if(/chuva intensa|chuva forte|chuva volumosa|volumes? elevados?|precipitacao intensa/.test(t))add("heavy_rain");
  if(/vendaval|rajad/.test(t))add("wind");
  if(/raio|descargas? eletr/.test(t))add("lightning");
  if(/tornado|tromba/.test(t))add("tornado");
  return events;
}

function inferRisk(forecast:string){
  const t=normalize(forecast);
  if(/risco\s+(muito\s+alto|extremo)/.test(t))return "very_high";
  if(/risco\s+alto/.test(t))return "high";
  if(/risco\s+moderado/.test(t))return "moderate";
  if(/risco\s+baixo/.test(t))return "low";
  return null;
}

function relevantToBiguacu(regions:string|null){
  if(!regions)return true;
  const r=normalize(regions);
  return /\btodas?\b|santa catarina|grande florianopolis|florianopolis|litoral de sc|todo o estado/.test(r);
}

function looksMaritime(title:string){
  const t=normalize(title);
  return /mar agitado|ressaca|ondas|mare|navegacao/.test(t) && !/temporal|tempestad|granizo|chuva|vendaval/.test(t);
}

async function fetchText(url:string){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(url,{
      headers:{"User-Agent":USER_AGENT,"Accept":"text/html,application/xhtml+xml"},
      signal:controller.signal
    });
    if(!r.ok)throw new Error("HTTP_"+r.status);
    return await r.text();
  }finally{
    clearTimeout(timer);
  }
}

async function readNotice(url:string){
  const html=await fetchText(url);
  const text=htmlToText(html);
  const title=extractTitle(html);
  if(!title||looksMaritime(title))return null;

  const startRaw=extractField(text,"Início")||extractField(text,"Inicio");
  const endRaw=extractField(text,"Fim");
  const regions=extractField(text,"Regiões")||extractField(text,"Regioes");
  const forecast=extractField(text,"Previsão")||extractField(text,"Previsao");
  const system=extractField(text,"Sistema");

  if(!startRaw||!endRaw||!forecast)return null;

  const startsAt=parseBRDate(startRaw);
  const endsAt=parseBRDate(endRaw);
  if(!startsAt||!endsAt)return null;

  const now=Date.now();
  const startMs=new Date(startsAt).getTime();
  const endMs=new Date(endsAt).getTime();
  const status=now>=startMs&&now<=endMs?"active":now<startMs&&startMs-now<=3*24*60*60*1000?"upcoming":"expired";

  return {
    id:url,
    title,
    url,
    source:SOURCE_NAME,
    starts_at:startsAt,
    ends_at:endsAt,
    status,
    regions,
    forecast,
    system,
    events:classifyEvents(title,forecast),
    risk:inferRisk(forecast),
    relevant_to_biguacu:relevantToBiguacu(regions)
  };
}

async function buildPayload(){
  const pageHtml=await fetchText(SOURCE_PAGE);
  const rawLinks=[...pageHtml.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]);
  const links:string[]=[];
  for(const raw of rawLinks){
    let url:string;
    try{url=new URL(raw,SOURCE_PAGE).toString();}catch{continue;}
    if(!/^https:\/\/ciram\.epagri\.sc\.gov\.br\/index\.php\/20\d{2}\/\d{2}\/\d{2}\//i.test(url))continue;
    if(!links.includes(url))links.push(url);
    if(links.length>=8)break;
  }

  const settled=await Promise.allSettled(links.map(readNotice));
  const notices=settled
    .filter((x):x is PromiseFulfilledResult<any>=>x.status==="fulfilled"&&!!x.value)
    .map(x=>x.value)
    .filter(n=>n.status!=="expired")
    .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());

  const relevant=notices.filter(n=>n.relevant_to_biguacu);
  const active=relevant.filter(n=>n.status==="active");
  const upcoming=relevant.filter(n=>n.status==="upcoming");

  return {
    source:{name:SOURCE_NAME,url:SOURCE_PAGE,kind:"official_weather_notices"},
    fetched_at:new Date().toISOString(),
    location:{city:"Biguaçu",state:"SC"},
    active,
    upcoming,
    notices:relevant
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(!["GET","POST"].includes(req.method))return json({error:"METHOD_NOT_ALLOWED"},405);

  try{
    if(memoryCache&&Date.now()<memoryCache.expires)return json(memoryCache.payload);
    const payload=await buildPayload();
    memoryCache={expires:Date.now()+5*60*1000,payload};
    return json(payload);
  }catch(error){
    console.error("epagri-weather-alerts",error instanceof Error?error.message:String(error));
    return json({
      error:"EPAGRI_ALERTS_UNAVAILABLE",
      source:{name:SOURCE_NAME,url:SOURCE_PAGE},
      fetched_at:new Date().toISOString()
    },503);
  }
});
