/* v5.1.0: extracted without changing the shared application state contract. */
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
function renderWeatherSnapshot(snapshot){
  if(!snapshot)return;
  const rainText=`${Number(snapshot.rain||0).toFixed(1)} mm`;
  const chanceText=`${Number(snapshot.prob||0)}%`;
  const tempText=`${Math.round(Number(snapshot.temp)||0)}°`;
  $("#rain6h").textContent=rainText;
  if($("#rainChance"))$("#rainChance").textContent=`até ${chanceText} de chance`;
  $("#weatherTemp").textContent=tempText;
  $("#weatherHeadline").textContent="Biguaçu agora";
  $("#topWeatherRain").textContent=rainText;
  $("#weatherDetail").textContent=snapshot.detail||"Previsão local";
  if($("#v7WeatherTemp"))$("#v7WeatherTemp").textContent=tempText;
  if($("#v7WeatherSummary"))$("#v7WeatherSummary").textContent=snapshot.short_summary||snapshot.detail||"Previsão local";
  if($("#topWeatherIcon"))$("#topWeatherIcon").textContent=snapshot.icon||"🌤️";
  if($("#desktopRain6h"))$("#desktopRain6h").textContent=rainText;
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
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code,is_day&hourly=precipitation,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=America%2FSao_Paulo`;
    const r=await fetch(url);
    if(!r.ok)throw new Error('weather');
    const w=await r.json();
    const nowIdx=Math.max(0,w.hourly.time.findIndex(t=>new Date(t)>=new Date()));
    const rain=w.hourly.precipitation.slice(nowIdx,nowIdx+6).reduce((a,b)=>a+(Number(b)||0),0);
    const prob=Math.max(...w.hourly.precipitation_probability.slice(nowIdx,nowIdx+6).map(Number),0);
    const temp=Math.round(Number(w.current.temperature_2m)||0);
    const max=Math.round(Number(w.daily?.temperature_2m_max?.[0])||temp);
    const min=Math.round(Number(w.daily?.temperature_2m_min?.[0])||temp);
    let summary='Sem chuva significativa nas próximas 6h';
    if(rain>=20) summary='Chuva forte prevista nas próximas 6h';
    else if(rain>=5) summary='Há previsão de chuva nas próximas 6h';
    else if(prob>=50) summary='Chance de chuva nas próximas 6h';
    $("#rain6h").textContent=`${rain.toFixed(1)} mm`;
    if($("#rainChance")) $("#rainChance").textContent=`até ${prob}% de chance`;
    $("#weatherTemp").textContent=`${temp}°`;
    $("#weatherHeadline").textContent='Biguaçu agora';
    $("#topWeatherRain").textContent=`${rain.toFixed(1)} mm`;
    const weatherDetail=`${summary} • ${prob}% • ${max}°/${min}°`;
    const weatherIcon=weatherIconForCode(w.current.weather_code,w.current.is_day);
    $("#weatherDetail").textContent=weatherDetail;
    if($("#v7WeatherTemp"))$("#v7WeatherTemp").textContent=`${temp}°`;
    if($("#v7WeatherSummary"))$("#v7WeatherSummary").textContent=summary;
    if($("#topWeatherIcon"))$("#topWeatherIcon").textContent=weatherIcon;
    if($("#desktopRain6h"))$("#desktopRain6h").textContent=`${rain.toFixed(1)} mm`;
    try{
      localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify({
        saved_at:Date.now(),rain,prob,temp,detail:weatherDetail,short_summary:summary,icon:weatherIcon
      }));
    }catch(_){}
  }catch(e){
    state.weatherUnavailable=true;
    console.warn(e);
    let restored=false;
    try{
      const cached=JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)||"null");
      if(cached){
        renderWeatherSnapshot(cached);
        if($("#weatherDetail"))$("#weatherDetail").textContent=`${cached.detail||"Previsão salva"} • atualização anterior`;
        restored=true;
      }
    }catch(_){}
    if(!restored){
      $("#rain6h").textContent="—";
      if($("#rainChance"))$("#rainChance").textContent="Previsão indisponível";
      $("#weatherTemp").textContent="—";
      $("#weatherHeadline").textContent="Biguaçu agora";
      $("#topWeatherRain").textContent="—";
      $("#weatherDetail").textContent="Previsão temporariamente indisponível";
      if($("#v7WeatherTemp"))$("#v7WeatherTemp").textContent="—";
      if($("#v7WeatherSummary"))$("#v7WeatherSummary").textContent="Previsão indisponível";
      if($("#topWeatherIcon"))$("#topWeatherIcon").textContent="🌥️";
    }
  }
  renderPushSettings();
  renderSources();
}



