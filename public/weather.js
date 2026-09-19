/* v6.7.0: previsão local com chuva nas próximas 6h e detalhes expansíveis. */
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

const WEATHER_CACHE_KEY="monitora_weather_v1";
let weatherRefreshTimer=null;

function weatherHasNumber(value){
  return value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value));
}
function weatherSetText(selector,value){
  const el=$(selector);
  if(el)el.textContent=value;
}
function renderWeatherSnapshot(snapshot){
  if(!snapshot)return;

  const rainText=weatherHasNumber(snapshot.rain)?`${Number(snapshot.rain).toFixed(1)} mm`:"—";
  const chanceText=weatherHasNumber(snapshot.prob)?`${Math.round(Number(snapshot.prob))}%`:"—";
  const tempText=weatherHasNumber(snapshot.temp)?`${Math.round(Number(snapshot.temp))}°`:"—";
  const currentRainText=weatherHasNumber(snapshot.currentRain)?`${Number(snapshot.currentRain).toFixed(1)} mm`:"—";
  const feelsText=weatherHasNumber(snapshot.feelsLike)?`Sensação ${Math.round(Number(snapshot.feelsLike))}°`:"Sensação —";
  const humidityText=weatherHasNumber(snapshot.humidity)?`Umidade ${Math.round(Number(snapshot.humidity))}%`:"Umidade —";
  const windText=weatherHasNumber(snapshot.wind)?`Vento ${Math.round(Number(snapshot.wind))} km/h`:"Vento —";
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

  // Card principal: prioriza exatamente a chuva prevista nas próximas 6 horas.
  weatherSetText("#v7WeatherRain",rainText);
  weatherSetText("#v7WeatherChance",chanceText==="—"?"Chance —":`${chanceText} de chance`);

  // Painel expandido.
  weatherSetText("#v7WeatherDetailSummary",summary);
  weatherSetText("#v7WeatherTemp",tempText);
  weatherSetText("#v7WeatherFeels",feelsText);
  weatherSetText("#v7WeatherRainDetail",rainText);
  weatherSetText("#v7WeatherChanceDetail",chanceText==="—"?"Chance —":`Até ${chanceText} de chance`);
  weatherSetText("#v7WeatherNowRain",currentRainText);
  weatherSetText("#v7WeatherHumidity",humidityText);
  weatherSetText("#v7WeatherMinMax",minMaxText);
  weatherSetText("#v7WeatherWind",windText);
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
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${currentFields}&hourly=precipitation,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=America%2FSao_Paulo`;
    const r=await fetch(url);
    if(!r.ok)throw new Error("weather");
    const w=await r.json();

    let nowIdx=w.hourly.time.findIndex(t=>new Date(t)>=new Date());
    if(nowIdx<0)nowIdx=Math.max(0,w.hourly.time.length-6);

    const nextRain=(w.hourly.precipitation||[]).slice(nowIdx,nowIdx+6);
    const nextProbability=(w.hourly.precipitation_probability||[]).slice(nowIdx,nowIdx+6);
    const rain=nextRain.reduce((a,b)=>a+(Number(b)||0),0);
    const prob=Math.max(...nextProbability.map(Number).filter(Number.isFinite),0);

    const temp=Number(w.current?.temperature_2m);
    const currentRain=Number(w.current?.precipitation);
    const humidity=Number(w.current?.relative_humidity_2m);
    const feelsLike=Number(w.current?.apparent_temperature);
    const wind=Number(w.current?.wind_speed_10m);
    const max=Number(w.daily?.temperature_2m_max?.[0]);
    const min=Number(w.daily?.temperature_2m_min?.[0]);

    let summary="Sem chuva significativa nas próximas 6h";
    if(rain>=20)summary="Chuva forte prevista nas próximas 6h";
    else if(rain>=5)summary="Há previsão de chuva nas próximas 6h";
    else if(prob>=50)summary="Chance de chuva nas próximas 6h";

    const weatherIcon=weatherIconForCode(w.current?.weather_code,w.current?.is_day);
    const tempLabel=Number.isFinite(temp)?`${Math.round(temp)}°`:"—";
    const maxLabel=Number.isFinite(max)?`${Math.round(max)}°`:"—";
    const minLabel=Number.isFinite(min)?`${Math.round(min)}°`:"—";
    const weatherDetail=`${summary} • ${Math.round(prob)}% • ${maxLabel}/${minLabel} • agora ${tempLabel}`;

    const snapshot={
      saved_at:Date.now(),
      rain,prob,temp,max,min,currentRain,humidity,feelsLike,wind,
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
        humidity:null,feelsLike:null,wind:null,
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
