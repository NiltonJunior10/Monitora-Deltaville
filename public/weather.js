/* v6.8.0: previsão local completa para chuva, granizo e vento nas próximas 6h. */
function weatherIconForCode(code,isDay=1){
  const c=Number(code), day=Number(isDay)===1;
  if(c===0) return day?"☀️":"🌙";
  if(c===1) return day?"🌤️":"🌙";
  if(c===2) return day?"⛅":"☁️";
  if(c===3) return "☁️";
  if([45,48].includes(c)) return "🌫️";
  if([51,53,55,56,57].includes(c)) return day?"🌦️":"🌧️";
  if([61,63,66,80,81].includes(c)) return "🌦️";
  if([65,67,82].includes(c)) return "🌧️";
  if([71,73,75,77,85,86].includes(c)) return "❄️";
  if([95,96,99].includes(c)) return day?"⛈️":"🌩️";
  return day?"🌤️":"🌙";
}

function weatherIconMarkup(code,isDay=1){
  const c=Number(code), day=Number(isDay)===1;
  const cloud='<path d="M6.2 16.2h10.2a3.6 3.6 0 0 0 .3-7.2 4.8 4.8 0 0 0-9.1 1.2 3 3 0 0 0-1.4 6Z"/>';
  let shape="";
  if(c===0){
    shape=day
      ?'<circle cx="12" cy="12" r="3.5"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"/>'
      :'<path d="M17.8 15.8A7 7 0 0 1 8.2 6.2a7 7 0 1 0 9.6 9.6Z"/>';
  }else if([1,2].includes(c)){
    shape=(day?'<circle cx="8" cy="8" r="2.8"/><path d="M8 3.2v1.3M3.2 8h1.3M11.4 4.6l-.9.9"/>':'')+cloud;
  }else if(c===3){
    shape=cloud;
  }else if([45,48].includes(c)){
    shape=cloud+'<path d="M5 19h14M7 21h10"/>';
  }else if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(c)){
    shape=cloud+'<path d="M8 18.3 7.2 20M12 18.3 11.2 20M16 18.3 15.2 20"/>';
  }else if([71,73,75,77,85,86].includes(c)){
    shape=cloud+'<path d="m8 18 1.3 1.3M9.3 18 8 19.3M14.7 18l1.3 1.3M16 18l-1.3 1.3"/>';
  }else if([95,96,99].includes(c)){
    shape=cloud+'<path d="m12.8 16.8-2.1 3.4h2l-1.2 2"/>'+(c>=96?'<circle cx="17.2" cy="19" r=".9"/>':'');
  }else{
    shape=cloud;
  }
  return `<svg class="weather-condition-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg>`;
}

const WEATHER_CACHE_KEY="monitora_weather_v2";
let weatherRefreshTimer=null;

function weatherHasNumber(value){
  return value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value));
}
function weatherSetText(selector,value){
  const el=$(selector);
  if(el)el.textContent=value;
}
function weatherSetHidden(selector,hidden){
  const el=$(selector);
  if(el)el.hidden=hidden;
}
function renderWeatherSnapshot(snapshot){
  if(!snapshot)return;

  const rainText=weatherHasNumber(snapshot.rain)?`${Number(snapshot.rain).toFixed(1)} mm`:"—";
  const chanceText=weatherHasNumber(snapshot.prob)?`${Math.round(Number(snapshot.prob))}%`:"—";
  const tempText=weatherHasNumber(snapshot.temp)?`${Math.round(Number(snapshot.temp))}°`:"—";
  const currentRainText=weatherHasNumber(snapshot.currentRain)?`${Number(snapshot.currentRain).toFixed(1)} mm`:"—";
  const feelsText=weatherHasNumber(snapshot.feelsLike)?`Sensação ${Math.round(Number(snapshot.feelsLike))}°`:"Sensação —";
  const humidityText=weatherHasNumber(snapshot.humidity)?`Umidade ${Math.round(Number(snapshot.humidity))}%`:"Umidade —";
  const windNowText=weatherHasNumber(snapshot.wind)?`Vento agora ${Math.round(Number(snapshot.wind))} km/h`:"Vento agora —";
  const wind6hText=weatherHasNumber(snapshot.maxGust)?`${Math.round(Number(snapshot.maxGust))} km/h`:"—";
  const minMaxText=weatherHasNumber(snapshot.max)&&weatherHasNumber(snapshot.min)
    ?`${Math.round(Number(snapshot.max))}° / ${Math.round(Number(snapshot.min))}°`
    :"—";
  const summary=snapshot.short_summary||snapshot.detail||"Previsão local";

  weatherSetText("#rain6h",rainText);
  weatherSetText("#rainChance",chanceText==="—"?"Previsão indisponível":`até ${chanceText} de chance`);
  weatherSetText("#weatherTemp",tempText);
  weatherSetText("#weatherHeadline","Biguaçu agora");
  weatherSetText("#topWeatherRain",rainText);
  weatherSetText("#weatherDetail",snapshot.detail||summary);
  weatherSetText("#topWeatherIcon",snapshot.icon||"🌤️");
  weatherSetText("#desktopRain6h",rainText);

  // Card principal: condição atual + temperatura + chuva para 6h.
  const cardIcon=$("#v7WeatherIcon");
  if(cardIcon)cardIcon.innerHTML=weatherIconMarkup(snapshot.weatherCode,snapshot.isDay);
  weatherSetText("#v7WeatherTemp",tempText);
  weatherSetText("#v7WeatherRain",rainText);
  weatherSetText("#v7WeatherChance",chanceText==="—"?"Chance —":`${chanceText} de chance`);

  let riskText="";
  if(snapshot.hailRisk&&snapshot.windRisk)riskText="Granizo e vendaval possíveis";
  else if(snapshot.hailRisk)riskText="Possibilidade de granizo";
  else if(snapshot.windRisk)riskText="Possibilidade de vendaval";
  else if(snapshot.windAttention)riskText=`Rajadas até ${Math.round(Number(snapshot.maxGust)||0)} km/h`;
  weatherSetText("#v7WeatherRisk",riskText);
  weatherSetHidden("#v7WeatherRisk",!riskText);

  // Painel expandido.
  weatherSetText("#v7WeatherDetailSummary",summary);
  weatherSetText("#v7WeatherTempDetail",tempText);
  weatherSetText("#v7WeatherFeels",feelsText);
  weatherSetText("#v7WeatherRainDetail",rainText);
  weatherSetText("#v7WeatherChanceDetail",chanceText==="—"?"Chance —":`Até ${chanceText} de chance`);
  weatherSetText("#v7WeatherNowRain",currentRainText);
  weatherSetText("#v7WeatherHumidity",humidityText);
  weatherSetText("#v7WeatherMinMax",minMaxText);
  weatherSetText("#v7WeatherWind",windNowText);
  weatherSetText("#v7WeatherHail",snapshot.hailRisk?"Possível":"Sem indicação");
  weatherSetText("#v7WeatherHailDetail",snapshot.hailRisk?"Código meteorológico com possibilidade de granizo nas próximas 6h.":"Sem indicação de granizo nas próximas 6h.");
  weatherSetText("#v7WeatherWind6h",wind6hText);
  weatherSetText("#v7WeatherWindStatus",
    snapshot.windRisk?"Risco de vendaval":
    snapshot.windAttention?"Rajadas fortes previstas":
    weatherHasNumber(snapshot.maxGust)?"Sem rajadas fortes previstas":"Previsão indisponível"
  );
}

function loadCachedWeather(){
  try{
    const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||"null");
    if(cached&&Date.now()-Number(cached.saved_at||0)<60*60*1000)renderWeatherSnapshot(cached);
  }catch(_){}
}
function scheduleWeatherRefresh(){
  clearTimeout(weatherRefreshTimer);
  weatherRefreshTimer=setTimeout(async()=>{
    if(document.visibilityState==="visible")await loadWeather();
    scheduleWeatherRefresh();
  },15*60*1000);
}
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    try{
      const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||"null");
      if(!cached||Date.now()-Number(cached.saved_at||0)>10*60*1000)loadWeather();
    }catch(_){loadWeather();}
    loadRiverStatus();
  }
});

async function loadWeather(){
  state.weatherUnavailable=false;
  try{
    const lat=-27.48755, lon=-48.66852;
    const currentFields=[
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "is_day",
      "wind_speed_10m"
    ].join(",");
    const hourlyFields=[
      "precipitation",
      "precipitation_probability",
      "weather_code",
      "wind_speed_10m",
      "wind_gusts_10m"
    ].join(",");
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${currentFields}&hourly=${hourlyFields}&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=America%2FSao_Paulo`;
    const r=await fetch(url);
    if(!r.ok)throw new Error("weather");
    const w=await r.json();

    let nowIdx=w.hourly.time.findIndex(t=>new Date(t)>=new Date());
    if(nowIdx<0)nowIdx=Math.max(0,w.hourly.time.length-6);

    const range=(key)=>(w.hourly?.[key]||[]).slice(nowIdx,nowIdx+6);
    const nextRain=range("precipitation");
    const nextProbability=range("precipitation_probability");
    const nextCodes=range("weather_code").map(Number).filter(Number.isFinite);
    const nextWind=range("wind_speed_10m").map(Number).filter(Number.isFinite);
    const nextGust=range("wind_gusts_10m").map(Number).filter(Number.isFinite);

    const rain=nextRain.reduce((a,b)=>a+(Number(b)||0),0);
    const prob=Math.max(...nextProbability.map(Number).filter(Number.isFinite),0);
    const maxWind=nextWind.length?Math.max(...nextWind):null;
    const maxGust=nextGust.length?Math.max(...nextGust):null;
    const hailRisk=nextCodes.some(code=>code===96||code===99);
    const windRisk=Number.isFinite(maxGust)&&maxGust>=60;
    const windAttention=Number.isFinite(maxGust)&&maxGust>=50;

    const temp=Number(w.current?.temperature_2m);
    const currentRain=Number(w.current?.precipitation);
    const humidity=Number(w.current?.relative_humidity_2m);
    const feelsLike=Number(w.current?.apparent_temperature);
    const wind=Number(w.current?.wind_speed_10m);
    const weatherCode=Number(w.current?.weather_code);
    const isDay=Number(w.current?.is_day);
    const max=Number(w.daily?.temperature_2m_max?.[0]);
    const min=Number(w.daily?.temperature_2m_min?.[0]);

    let summary="Tempo sem alerta relevante nas próximas 6h";
    if(hailRisk&&windRisk)summary="Possibilidade de granizo e vendaval nas próximas 6h";
    else if(hailRisk)summary="Possibilidade de granizo nas próximas 6h";
    else if(windRisk)summary="Possibilidade de vendaval nas próximas 6h";
    else if(rain>=20)summary="Chuva forte prevista nas próximas 6h";
    else if(rain>=5)summary="Há previsão de chuva nas próximas 6h";
    else if(prob>=50)summary="Chance de chuva nas próximas 6h";
    else if(windAttention)summary="Rajadas fortes previstas nas próximas 6h";

    const weatherIcon=weatherIconForCode(weatherCode,isDay);
    const tempLabel=Number.isFinite(temp)?`${Math.round(temp)}°`:"—";
    const maxLabel=Number.isFinite(max)?`${Math.round(max)}°`:"—";
    const minLabel=Number.isFinite(min)?`${Math.round(min)}°`:"—";
    const weatherDetail=`${summary} • chuva ${rain.toFixed(1)} mm • ${Math.round(prob)}% • ${maxLabel}/${minLabel} • agora ${tempLabel}`;

    const snapshot={
      saved_at:Date.now(),
      rain,prob,temp,max,min,currentRain,humidity,feelsLike,wind,
      weatherCode,isDay,maxWind,maxGust,hailRisk,windRisk,windAttention,
      detail:weatherDetail,
      short_summary:summary,
      icon:weatherIcon
    };

    renderWeatherSnapshot(snapshot);
    try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify(snapshot));}catch(_){}
  }catch(e){
    state.weatherUnavailable=true;
    console.warn(e);
    let restored=false;
    try{
      const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||"null");
      if(cached){
        renderWeatherSnapshot(cached);
        weatherSetText("#weatherDetail",`${cached.detail||"Previsão salva"} • atualização anterior`);
        weatherSetText("#v7WeatherDetailSummary",`${cached.short_summary||"Previsão salva"} • dados anteriores`);
        restored=true;
      }
    }catch(_){}

    if(!restored){
      const unavailable={
        rain:null,prob:null,temp:null,max:null,min:null,currentRain:null,
        humidity:null,feelsLike:null,wind:null,weatherCode:2,isDay:1,
        maxWind:null,maxGust:null,hailRisk:false,windRisk:false,windAttention:false,
        detail:"Previsão temporariamente indisponível",
        short_summary:"Previsão indisponível",
        icon:"🌥️"
      };
      renderWeatherSnapshot(unavailable);
    }
  }
  renderPushSettings();
  renderSources();
}
