const WEATHER_LAT=-27.48755;
const WEATHER_LON=-48.66852;
const GOOGLE_WEATHER_BASE="https://weather.googleapis.com/v1";
const WEATHER_CACHE_ORIGIN="https://monitora-weather-cache.internal";

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      ...headers
    }
  });
}

function weatherNumber(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function weatherConditionToCode(type){
  const t=String(type||"").toUpperCase();
  if(t==="CLEAR")return 0;
  if(t==="MOSTLY_CLEAR")return 1;
  if(t==="PARTLY_CLOUDY")return 2;
  if(["MOSTLY_CLOUDY","CLOUDY"].includes(t))return 3;
  if(t.includes("FOG")||t.includes("HAZE"))return 45;
  if(t==="LIGHT_RAIN_SHOWERS"||t==="CHANCE_OF_SHOWERS")return 51;
  if(t==="SCATTERED_SHOWERS"||t==="RAIN_SHOWERS")return 61;
  if(t==="HEAVY_RAIN_SHOWERS")return 82;
  if(t==="LIGHT_RAIN"||t==="LIGHT_TO_MODERATE_RAIN")return 61;
  if(t==="RAIN")return 63;
  if(t==="MODERATE_TO_HEAVY_RAIN"||t==="HEAVY_RAIN"||t==="RAIN_PERIODICALLY_HEAVY")return 65;
  if(t==="HAIL"||t==="HAIL_SHOWERS")return 96;
  if(["THUNDERSTORM","THUNDERSHOWER","LIGHT_THUNDERSTORM_RAIN","SCATTERED_THUNDERSTORMS"].includes(t))return 95;
  if(t==="HEAVY_THUNDERSTORM")return 99;
  if(t==="WIND_AND_RAIN")return 81;
  if(t==="WINDY")return 2;
  return 2;
}

function isHailCondition(type){
  const t=String(type||"").toUpperCase();
  return t==="HAIL"||t==="HAIL_SHOWERS";
}

function isStormCondition(type){
  const t=String(type||"").toUpperCase();
  return ["THUNDERSTORM","THUNDERSHOWER","LIGHT_THUNDERSTORM_RAIN","SCATTERED_THUNDERSTORMS","HEAVY_THUNDERSTORM"].includes(t);
}

async function googleWeatherJson(env,ctx,cacheName,path,params,ttlSeconds){
  const cache=caches.default;
  const cacheKey=new Request(`${WEATHER_CACHE_ORIGIN}/${cacheName}`);
  const cached=await cache.match(cacheKey);
  if(cached)return cached.json();

  const url=new URL(GOOGLE_WEATHER_BASE+path);
  url.searchParams.set("key",env.GOOGLE_WEATHER_API_KEY);
  url.searchParams.set("location.latitude",String(WEATHER_LAT));
  url.searchParams.set("location.longitude",String(WEATHER_LON));
  url.searchParams.set("languageCode","pt-BR");
  for(const [key,value] of Object.entries(params||{}))url.searchParams.set(key,String(value));

  const response=await fetch(url.toString(),{
    headers:{"Accept":"application/json"}
  });
  if(!response.ok){
    const body=await response.text().catch(()=>"");
    throw new Error(`Google Weather ${response.status}: ${body.slice(0,160)}`);
  }

  const body=await response.text();
  const cacheResponse=new Response(body,{
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":`public, max-age=${ttlSeconds}`
    }
  });
  ctx.waitUntil(cache.put(cacheKey,cacheResponse));
  return JSON.parse(body);
}

function buildWeatherSnapshot(current,hourly,daily){
  const hours=(hourly?.forecastHours||[]).slice(0,24);
  const next6=hours.slice(0,6);
  const today=(daily?.forecastDays||[])[0]||null;

  const rain=next6.reduce((sum,h)=>sum+(weatherNumber(h?.precipitation?.qpf?.quantity)||0),0);
  const probabilities=next6.map(h=>weatherNumber(h?.precipitation?.probability?.percent)).filter(Number.isFinite);
  const prob=probabilities.length?Math.max(...probabilities):0;
  const windValues=next6.map(h=>weatherNumber(h?.wind?.speed?.value)).filter(Number.isFinite);
  const gustValues=next6.map(h=>weatherNumber(h?.wind?.gust?.value)).filter(Number.isFinite);
  const maxWind=windValues.length?Math.max(...windValues):null;
  const maxGust=gustValues.length?Math.max(...gustValues):null;
  const conditionTypes=next6.map(h=>h?.weatherCondition?.type).filter(Boolean);
  const stormProbability=Math.max(0,...next6.map(h=>weatherNumber(h?.thunderstormProbability)||0));

  const hailRisk=conditionTypes.some(isHailCondition);
  const stormRisk=conditionTypes.some(isStormCondition)||stormProbability>=40;
  const windRisk=Number.isFinite(maxGust)&&maxGust>=60;
  const windAttention=Number.isFinite(maxGust)&&maxGust>=50;

  const temp=weatherNumber(current?.temperature?.degrees);
  const currentRain=weatherNumber(current?.precipitation?.qpf?.quantity);
  const humidity=weatherNumber(current?.relativeHumidity);
  const feelsLike=weatherNumber(current?.feelsLikeTemperature?.degrees);
  const wind=weatherNumber(current?.wind?.speed?.value);
  const max=weatherNumber(today?.maxTemperature?.degrees);
  const min=weatherNumber(today?.minTemperature?.degrees);
  const weatherType=current?.weatherCondition?.type||"PARTLY_CLOUDY";
  const weatherCode=weatherConditionToCode(weatherType);
  const isDay=current?.isDaytime===false?0:1;
  const conditionText=current?.weatherCondition?.description?.text||"Condição atual";

  let summary="Tempo sem alerta relevante nas próximas 6h";
  if(hailRisk&&windRisk)summary="Possibilidade de granizo e vendaval nas próximas 6h";
  else if(hailRisk)summary="Possibilidade de granizo nas próximas 6h";
  else if(windRisk)summary="Possibilidade de vendaval nas próximas 6h";
  else if(stormRisk)summary="Possibilidade de tempestade nas próximas 6h";
  else if(rain>=20)summary="Chuva forte prevista nas próximas 6h";
  else if(rain>=5)summary="Há previsão de chuva nas próximas 6h";
  else if(prob>=50)summary="Chance de chuva nas próximas 6h";
  else if(windAttention)summary="Rajadas fortes previstas nas próximas 6h";

  const tempLabel=Number.isFinite(temp)?`${Math.round(temp)}°`:"—";
  const maxLabel=Number.isFinite(max)?`${Math.round(max)}°`:"—";
  const minLabel=Number.isFinite(min)?`${Math.round(min)}°`:"—";
  const detail=`${conditionText} • ${summary} • chuva ${rain.toFixed(1)} mm • ${Math.round(prob)}% • ${maxLabel}/${minLabel} • agora ${tempLabel}`;

  return {
    source:"google_weather",
    source_label:"Google Weather",
    saved_at:Date.now(),
    provider_updated_at:current?.currentTime||null,
    rain,prob,temp,max,min,currentRain,humidity,feelsLike,wind,
    weatherCode,isDay,maxWind,maxGust,stormRisk,hailRisk,windRisk,windAttention,
    thunderstormProbability:stormProbability,
    conditionText,
    detail,
    short_summary:summary
  };
}

async function handleWeather(env,ctx){
  if(!env.GOOGLE_WEATHER_API_KEY){
    return json({ok:false,error:"google_weather_not_configured"},503);
  }

  try{
    const [current,hourly,daily]=await Promise.all([
      googleWeatherJson(env,ctx,"current-v1","/currentConditions:lookup",{},15*60),
      googleWeatherJson(env,ctx,"hourly-v1","/forecast/hours:lookup",{hours:24,pageSize:24},30*60),
      googleWeatherJson(env,ctx,"daily-v1","/forecast/days:lookup",{days:1,pageSize:1},6*60*60)
    ]);
    return json({ok:true,weather:buildWeatherSnapshot(current,hourly,daily)},200,{
      "X-Weather-Source":"Google Weather"
    });
  }catch(error){
    console.error("Google Weather proxy:",error);
    return json({ok:false,error:"google_weather_unavailable"},502);
  }
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(request.method==="GET"&&url.pathname==="/api/weather"){
      return handleWeather(env,ctx);
    }
    return env.ASSETS.fetch(request);
  }
};
