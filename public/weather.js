/* v7.0.63: Google Weather para previsão e avisos; Open-Meteo permanece como fallback de previsão. */
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

function weatherConditionLabel(code,isDay=1){
  const c=Number(code),day=Number(isDay)===1;
  if(c===0)return day?"Céu limpo":"Céu limpo";
  if(c===1)return "Predominantemente limpo";
  if(c===2)return "Parcialmente nublado";
  if(c===3)return "Nublado";
  if([45,48].includes(c))return "Neblina";
  if([51,53,55,56,57].includes(c))return "Garoa";
  if([61,63,66,80,81].includes(c))return "Chuva";
  if([65,67,82].includes(c))return "Chuva forte";
  if([71,73,75,77,85,86].includes(c))return "Precipitação de inverno";
  if([95,96,99].includes(c))return "Tempestade";
  return "Condições variáveis";
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

let lastWeatherSnapshot=null;

function weatherEscapeHtml(value){
  return String(value??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function weatherEventLabel(event){
  const labels={
    storm:"Tempestade",
    hail:"Granizo",
    heavy_rain:"Chuva intensa",
    wind:"Vento forte / rajadas",
    lightning:"Raios",
    tornado:"Tornado / tromba d’água",
    ACID_RAIN:"Chuva ácida",
    AVALANCHE:"Avalanche",
    BLIZZARD:"Nevasca",
    BLOWING_SNOW:"Neve com vento",
    COASTAL_FLOOD:"Inundação costeira",
    COASTAL_HAZARD:"Perigo costeiro",
    COLD:"Frio intenso",
    CYCLONE:"Ciclone",
    DROUGHT:"Seca",
    EXTRATROPICAL_CYCLONE:"Ciclone extratropical",
    FIRE_WEATHER:"Risco de incêndio",
    FLASH_FLOOD:"Inundação repentina",
    FLOOD:"Inundação",
    FOG:"Nevoeiro",
    FREEZING:"Congelamento",
    FREEZING_AIR_TEMPERATURE:"Temperatura congelante",
    FREEZING_DRIZZLE:"Garoa congelante",
    FREEZING_RAIN:"Chuva congelante",
    FROST:"Geada",
    GALE:"Ventania",
    GLAZE:"Gelo superficial",
    HAIL:"Granizo",
    HAZARDOUS_SEAS:"Mar perigoso",
    HEAT:"Calor intenso",
    HUMIDITY:"Umidade elevada",
    HURRICANE:"Furacão",
    ICE_STORM:"Tempestade de gelo",
    LAKE_EFFECT_SNOW:"Neve por efeito de lago",
    MONSOON:"Monção",
    MUDDY_FLOOD:"Enxurrada com lama",
    OUTFLOW:"Rajadas de saída",
    RAIN:"Chuva",
    RIVER_FLOODING:"Cheia de rio",
    SEVERE_THUNDERSTORM_WARNING:"Alerta de tempestade severa",
    SNOW:"Neve",
    SNOWSQUALL:"Rajada de neve",
    STORM:"Tempestade",
    STORM_SURGE:"Maré de tempestade",
    THUNDER:"Trovões",
    THUNDERSTORM:"Tempestade",
    TORNADO:"Tornado",
    TORNADO_WARNING:"Alerta de tornado",
    TROPICAL_CYCLONE:"Ciclone tropical",
    TROPICAL_CYCLONE_WARNINGS_AND_WATCHES:"Alertas de ciclone tropical",
    TROPICAL_DISTURBANCE:"Distúrbio tropical",
    TROPICAL_STORM:"Tempestade tropical",
    TYPHOON:"Tufão",
    WIND:"Vento forte",
    WIND_CHILL:"Sensação térmica de frio",
    WIND_WAVE:"Ondas por vento",
    WINTER_STORM:"Tempestade de inverno",
    WILDFIRE:"Incêndio florestal",
    BUSHFIRE:"Incêndio em vegetação",
    FIRE:"Incêndio",
    LANDSLIDE:"Deslizamento",
    EARTHQUAKE:"Terremoto",
    DUST_STORM:"Tempestade de poeira",
    AFTERSHOCK:"Réplica de terremoto",
    TSUNAMI:"Tsunami",
    VOLCANIC_ASH:"Cinzas vulcânicas",
    VOLCANIC_ERUPTION:"Erupção vulcânica",
    RADIATION:"Radiação"
  };
  const key=String(event||"").trim().toUpperCase();
  const withoutEvent=key.endsWith("_EVENT")?key.slice(0,-6):key;
  return labels[key]||labels[withoutEvent]||"Aviso meteorológico";
}

function weatherTranslateAlertTitle(raw,eventLabel="Aviso meteorológico"){
  let text=String(raw||"").trim();
  if(!text)return eventLabel;

  const replacements=[
    [/\bred alert\b/gi,"Alerta vermelho"],
    [/\borange alert\b/gi,"Alerta laranja"],
    [/\byellow alert\b/gi,"Alerta amarelo"],
    [/\bgreen alert\b/gi,"Alerta verde"],
    [/\bextreme alert\b/gi,"Alerta extremo"],
    [/\bsevere thunderstorm(s)?\b/gi,"tempestade severa"],
    [/\bthunderstorm(s)?\b/gi,"tempestade"],
    [/\bheavy rain\b/gi,"chuva intensa"],
    [/\bfreezing rain\b/gi,"chuva congelante"],
    [/\bflash flood(ing)?\b/gi,"inundação repentina"],
    [/\bflood(ing)?\b/gi,"inundação"],
    [/\bstrong wind(s)?\b/gi,"vento forte"],
    [/\bwind gust(s)?\b/gi,"rajadas de vento"],
    [/\bhail\b/gi,"granizo"],
    [/\btornado\b/gi,"tornado"],
    [/\blandslide(s)?\b/gi,"deslizamento"],
    [/\brain\b/gi,"chuva"],
    [/\bstorm(s)?\b/gi,"tempestade"],
    [/\bwarning\b/gi,"alerta"],
    [/\bwatch\b/gi,"vigilância"]
  ];
  for(const [pattern,replacement] of replacements)text=text.replace(pattern,replacement);

  text=text.replace(/\s*:\s*/g,": ").replace(/\s{2,}/g," ").trim();
  if(text===raw&&eventLabel&&eventLabel!=="Aviso meteorológico")return eventLabel;
  return text||eventLabel;
}

function weatherAlertDisplayTitle(notice){
  const raw=String(notice?.title||"").trim();
  const eventLabel=(notice?.events||[]).map(weatherEventLabel).find(Boolean)||"Aviso meteorológico";
  return weatherTranslateAlertTitle(raw,eventLabel);
}

function weatherAlertDisplayParts(notice){
  const title=weatherAlertDisplayTitle(notice);
  const parts=title.split(":");
  if(parts.length>1){
    return {
      headline:parts.shift().trim()||"Alerta",
      detail:parts.join(":").trim()||"Aviso meteorológico"
    };
  }
  return {headline:"Alerta",detail:title||"Aviso meteorológico"};
}

function weatherOfficialSeverity(notice){
  if(notice?.risk==="very_high")return "critical";
  if(notice?.risk==="high")return "alert";
  if(notice?.risk==="moderate")return "attention";
  return notice?.status==="active"?"alert":"attention";
}

function weatherOfficialTime(iso){
  if(!iso)return "—";
  const d=new Date(iso);
  if(Number.isNaN(d.getTime()))return "—";
  return d.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}

function renderOfficialWeatherAlerts(data){
  const desktopWrap=document.getElementById("desktopWeatherAlerts");
  const mobileWrap=document.getElementById("v7WeatherOfficialAlerts");
  const lists=[
    document.getElementById("desktopWeatherAlertList"),
    document.getElementById("v7WeatherAlertList")
  ].filter(Boolean);
  const topBadge=document.getElementById("topWeatherOfficialAlert");
  const notice=(data?.active||[])[0]||(data?.upcoming||[])[0]||null;

  if(topBadge){
    if(notice&&!data?.error){
      const parts=weatherAlertDisplayParts(notice);
      topBadge.innerHTML=`<b>${weatherEscapeHtml(parts.headline)}</b><span>${weatherEscapeHtml(parts.detail)}</span>`;
      topBadge.className=`top-weather-official-badge weather-compact__alert ${weatherOfficialSeverity(notice)}`;
      topBadge.hidden=false;
      topBadge.title=weatherAlertDisplayTitle(notice);
    }else{
      topBadge.hidden=true;
      topBadge.textContent="";
      topBadge.className="top-weather-official-badge weather-compact__alert";
      topBadge.removeAttribute("title");
    }
  }

  const hasNotice=!!notice&&!data?.error;
  if(desktopWrap)desktopWrap.hidden=!hasNotice;
  if(mobileWrap)mobileWrap.hidden=!hasNotice;

  if(lists.length){
    let alertHtml="";
    if(hasNotice){
      const n=notice;
      const severity=weatherOfficialSeverity(n);
      const titleParts=weatherAlertDisplayParts(n);
      const events=titleParts.detail&&titleParts.detail!=="Aviso meteorológico"
        ?titleParts.detail
        :(n.events||[]).map(weatherEventLabel).join(" • ");
      const timing=n.status==="active"
        ?`Ativo até ${weatherOfficialTime(n.ends_at)}`
        :`Previsto a partir de ${weatherOfficialTime(n.starts_at)}`;
      const risk=n.risk==="very_high"?"Risco muito alto":n.risk==="high"?"Risco alto":n.risk==="moderate"?"Risco moderado":n.risk==="low"?"Risco baixo":"Aviso meteorológico";
      const source=n.source_name||"Fonte oficial";
      const sourceLine=`${source} • ${timing}`;
      alertHtml=`
        <div class="weather-sheet-alert ${severity}">
          <span class="weather-sheet-alert__icon" aria-hidden="true">!</span>
          <span class="weather-sheet-alert__copy">
            <strong>${weatherEscapeHtml(weatherAlertDisplayTitle(n))}</strong>
            <span>${weatherEscapeHtml(events||risk)}</span>
            <small>${weatherEscapeHtml(sourceLine)}</small>
          </span>
          ${n.source_url?`<a class="weather-sheet-alert__open" href="${weatherEscapeHtml(n.source_url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir fonte oficial">›</a>`:""}
        </div>
      `;
    }
    lists.forEach(host=>host.innerHTML=alertHtml);
  }

  const mobileRisk=document.getElementById("v7WeatherRisk");
  if(mobileRisk){
    if(notice){
      const labels=(notice.events||[]).map(weatherEventLabel);
      mobileRisk.textContent=`Alerta: ${labels.length?labels.join(", "):notice.title}`;
      mobileRisk.hidden=false;
      mobileRisk.classList.add("official");
    }else{
      mobileRisk.classList.remove("official");
      const s=lastWeatherSnapshot;
      let trend="";
      if(s?.hailRisk&&s?.windRisk)trend="Possibilidade de granizo e rajadas fortes";
      else if(s?.hailRisk)trend="Possibilidade de granizo";
      else if(s?.windRisk)trend="Possibilidade de vendaval";
      else if(s?.windAttention)trend=`Rajadas até ${Math.round(Number(s.maxGust)||0)} km/h`;
      mobileRisk.textContent=trend;
      mobileRisk.hidden=!trend;
    }
  }
}

function renderDesktopWeatherAlerts(snapshot){
  lastWeatherSnapshot=snapshot;
  const hailCard=document.getElementById("desktopWeatherHailCard");
  const windCard=document.getElementById("desktopWeatherWindCard");
  const rainCard=document.getElementById("desktopWeatherRainCard");
  const rainNowCard=document.getElementById("desktopWeatherRainNowCard");

  hailCard?.classList.toggle("has-alert",!!snapshot.hailRisk);
  windCard?.classList.toggle("has-alert",!!snapshot.windRisk);
  windCard?.classList.toggle("has-attention",!snapshot.windRisk&&!!snapshot.windAttention);
  rainCard?.classList.toggle("has-alert",weatherHasNumber(snapshot.rain)&&Number(snapshot.rain)>=20);
  rainCard?.classList.toggle("has-attention",weatherHasNumber(snapshot.rain)&&Number(snapshot.rain)>=5&&Number(snapshot.rain)<20);
  rainNowCard?.classList.toggle("has-attention",weatherHasNumber(snapshot.currentRain)&&Number(snapshot.currentRain)>0);

  renderOfficialWeatherAlerts(state.weatherAlerts||null);
}

function renderWeatherSnapshot(snapshot){
  if(!snapshot)return;
  if(snapshot.alerts){
    state.weatherAlerts=snapshot.alerts;
    renderOfficialWeatherAlerts(state.weatherAlerts);
    if(typeof renderAlertsPage==="function")renderAlertsPage();
    if(typeof renderOccurrences==="function")renderOccurrences();
    if(typeof renderSources==="function")renderSources();
  }

  const rainText=weatherHasNumber(snapshot.rain)?`${Number(snapshot.rain).toFixed(1)} mm`:"—";
  const chanceText=weatherHasNumber(snapshot.prob)?`${Math.round(Number(snapshot.prob))}%`:"—";
  const tempText=weatherHasNumber(snapshot.temp)?`${Math.round(Number(snapshot.temp))}°`:"—";
  const currentRainText=weatherHasNumber(snapshot.currentRain)?`${Number(snapshot.currentRain).toFixed(1)} mm`:"—";
  const currentPrecipChance=weatherHasNumber(snapshot.currentPrecipProbability)?`${Math.round(Number(snapshot.currentPrecipProbability))}%`:"—";
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
  weatherSetText("#weatherHeadline","Deltaville");
  weatherSetText("#topWeatherRain",rainText);
  weatherSetText("#weatherDetail",snapshot.detail||summary);
  const compactIcon=$("#topWeatherIcon");
  if(compactIcon)compactIcon.innerHTML=weatherIconMarkup(snapshot.weatherCode,snapshot.isDay);
  weatherSetText("#desktopRain6h",rainText);

  // Card principal: condição atual + temperatura + chuva para 6h.
  const cardIcon=$("#v7WeatherIcon");
  if(cardIcon)cardIcon.innerHTML=weatherIconMarkup(snapshot.weatherCode,snapshot.isDay);
  weatherSetText("#v7WeatherTemp",tempText);
  weatherSetText("#v7WeatherRain",rainText);
  weatherSetText("#v7WeatherChance",chanceText==="—"?"Chance —":`${chanceText} de chance`);

  let riskText="";
  if(snapshot.hailRisk&&snapshot.windRisk)riskText="Tendência do modelo: granizo e rajadas fortes possíveis";
  else if(snapshot.hailRisk)riskText="Tendência do modelo: possibilidade de granizo";
  else if(snapshot.windRisk)riskText="Tendência do modelo: possibilidade de vendaval";
  else if(snapshot.windAttention)riskText=`Tendência do modelo: rajadas até ${Math.round(Number(snapshot.maxGust)||0)} km/h`;
  weatherSetText("#v7WeatherRisk",riskText);
  weatherSetHidden("#v7WeatherRisk",!riskText);

  // Painel expandido.
  weatherSetText("#v7WeatherDetailSummary",summary);
  weatherSetText("#v7WeatherRainDetail",rainText);
  weatherSetText("#v7WeatherChanceDetail",chanceText==="—"?"Chance —":`Até ${chanceText} de chance`);
  weatherSetText("#v7WeatherNowRain",currentRainText);
  weatherSetText("#v7WeatherNowRainDetail",currentPrecipChance==="—"?`Estimativa da última hora • ${snapshot.conditionText||weatherConditionLabel(snapshot.weatherCode,snapshot.isDay)}`:`${currentPrecipChance} de chance • ${snapshot.conditionText||weatherConditionLabel(snapshot.weatherCode,snapshot.isDay)}`);
  weatherSetText("#v7WeatherHail",snapshot.hailRisk?"Possível":"Sem indicação");
  weatherSetText("#v7WeatherHailDetail",snapshot.hailRisk?"Possibilidade nas próximas 6h":"Sem indicação no momento");
  weatherSetText("#v7WeatherWind6h",wind6hText);
  weatherSetText("#v7WeatherWindStatus",
    snapshot.windRisk?"Risco de vendaval":
    snapshot.windAttention?"Rajadas fortes previstas":
    weatherHasNumber(snapshot.maxGust)?"Sem rajadas fortes":"Previsão indisponível"
  );

  // Painel detalhado do desktop.
  weatherSetText("#desktopWeatherRain",rainText);
  weatherSetText("#desktopWeatherChance",chanceText==="—"?"Chance —":`Até ${chanceText} de chance`);
  weatherSetText("#desktopWeatherNowRain",currentRainText);
  weatherSetText("#desktopWeatherNowRainDetail",currentPrecipChance==="—"?`Estimativa da última hora • ${snapshot.conditionText||weatherConditionLabel(snapshot.weatherCode,snapshot.isDay)}`:`${currentPrecipChance} de chance • ${snapshot.conditionText||weatherConditionLabel(snapshot.weatherCode,snapshot.isDay)}`);
  weatherSetText("#desktopWeatherHail",snapshot.hailRisk?"Possível":"Sem indicação");
  weatherSetText("#desktopWeatherHailDetail",snapshot.hailRisk?"Possibilidade nas próximas 6h":"Sem indicação no momento");
  weatherSetText("#desktopWeatherWind6h",wind6hText);
  weatherSetText("#desktopWeatherWindStatus",
    snapshot.windRisk?"Risco de vendaval":
    snapshot.windAttention?"Rajadas fortes previstas":
    weatherHasNumber(snapshot.maxGust)?"Sem rajadas fortes":"Previsão indisponível"
  );

  const provider=snapshot.source_label||(snapshot.source==="google_weather"?"Google Weather":snapshot.source==="open_meteo"?"Open-Meteo":"Previsão");
  const condition=snapshot.conditionText||weatherConditionLabel(snapshot.weatherCode,snapshot.isDay);
  weatherSetText("#topWeatherCondition",condition);
  const providerTime=snapshot.provider_updated_at?new Date(snapshot.provider_updated_at).getTime():Number(snapshot.saved_at||Date.now());
  const providerDate=new Date(Number.isFinite(providerTime)?providerTime:Date.now());
  const updatedClock=providerDate.toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"});
  const updatedText=`Atualizado às ${updatedClock}`;
  const rangeText=weatherHasNumber(snapshot.max)&&weatherHasNumber(snapshot.min)
    ?`Máx. ${Math.round(Number(snapshot.max))}° • Mín. ${Math.round(Number(snapshot.min))}°`
    :"Máx. — • Mín. —";

  weatherSetText("#desktopWeatherProviderLine",`Atualizado pelo ${provider}`);
  weatherSetText("#desktopWeatherSourceLabel",provider);
  weatherSetText("#desktopWeatherUpdated",updatedText);
  weatherSetText("#desktopWeatherCondition",condition);
  weatherSetText("#desktopWeatherHeroTemp",tempText);
  weatherSetText("#desktopWeatherHeroRange",rangeText);
  const desktopHeroIcon=$("#desktopWeatherHeroIcon");
  if(desktopHeroIcon)desktopHeroIcon.innerHTML=weatherIconMarkup(snapshot.weatherCode,snapshot.isDay);

  weatherSetText("#v7WeatherProvider",`Atualizado pelo ${provider}`);
  weatherSetText("#v7WeatherUpdated",updatedText);
  weatherSetText("#v7WeatherCondition",condition);
  weatherSetText("#v7WeatherHeroTemp",tempText);
  weatherSetText("#v7WeatherHeroRange",rangeText);
  const mobileHeroIcon=$("#v7WeatherHeroIcon");
  if(mobileHeroIcon)mobileHeroIcon.innerHTML=weatherIconMarkup(snapshot.weatherCode,snapshot.isDay);

  renderDesktopWeatherAlerts(snapshot);
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

async function loadGoogleWeatherSnapshot(){
  const response=await fetch("/api/weather",{cache:"no-store",headers:{"Accept":"application/json"}});
  if(!response.ok)throw new Error("google_weather_"+response.status);
  const data=await response.json();
  if(!data?.ok||!data?.weather)throw new Error(data?.error||"google_weather_invalid");
  const snapshot=data.weather;
  snapshot.saved_at=Date.now();
  snapshot.alerts=data.alerts||{source:"google_weather",notices:[],active:[],upcoming:[]};
  snapshot.source="google_weather";
  snapshot.source_label="Google Weather";
  snapshot.icon=weatherIconForCode(snapshot.weatherCode,snapshot.isDay);
  return snapshot;
}

async function loadOpenMeteoWeatherSnapshot(){
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
  if(!r.ok)throw new Error("open_meteo_"+r.status);
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
  const stormRisk=nextCodes.some(code=>code===95||code===96||code===99);
  const hailRisk=nextCodes.some(code=>code===96||code===99);
  const windRisk=Number.isFinite(maxGust)&&maxGust>=60;
  const windAttention=Number.isFinite(maxGust)&&maxGust>=50;

  const temp=Number(w.current?.temperature_2m);
  const currentRain=Number(w.current?.precipitation);
  const currentPrecipProbability=nextProbability.length?Number(nextProbability[0]):null;
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

  return {
    source:"open_meteo",
    source_label:"Open-Meteo",
    fallback:true,
    saved_at:Date.now(),
    rain,prob,temp,max,min,currentRain,currentPrecipProbability,humidity,feelsLike,wind,
    weatherCode,isDay,maxWind,maxGust,stormRisk,hailRisk,windRisk,windAttention,
    detail:weatherDetail,
    short_summary:summary,
    icon:weatherIcon
  };
}

async function loadWeather(){
  state.weatherUnavailable=false;
  let snapshot=null;

  try{
    snapshot=await loadGoogleWeatherSnapshot();
  }catch(googleError){
    console.warn("Google Weather indisponível; usando fallback:",googleError);
    try{
      snapshot=await loadOpenMeteoWeatherSnapshot();
    }catch(fallbackError){
      console.warn("Open-Meteo fallback indisponível:",fallbackError);
    }
  }

  if(snapshot){
    renderWeatherSnapshot(snapshot);
    try{localStorage.setItem(WEATHER_CACHE_KEY,JSON.stringify(snapshot));}catch(_){}
  }else{
    state.weatherUnavailable=true;
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
        source:"unavailable",
        source_label:"Previsão indisponível",
        rain:null,prob:null,temp:null,max:null,min:null,currentRain:null,
        humidity:null,feelsLike:null,wind:null,weatherCode:2,isDay:1,
        maxWind:null,maxGust:null,stormRisk:false,hailRisk:false,windRisk:false,windAttention:false,
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


function bindDesktopWeatherPanel(){
  const trigger=document.getElementById("desktopWeatherTrigger");
  const panel=document.getElementById("desktopWeatherPanel");
  const close=document.getElementById("desktopWeatherClose");
  if(!trigger||!panel||trigger.dataset.weatherBound==="1")return;

  trigger.dataset.weatherBound="1";

  const positionPanel=()=>{
    if(panel.hidden)return;
    const rect=trigger.getBoundingClientRect();
    const maxWidth=Math.min(570,Math.max(360,window.innerWidth-24));
    const width=Math.min(Math.max(rect.width,540),maxWidth);
    let left=rect.left+rect.width/2-width/2;
    left=Math.max(16,Math.min(left,window.innerWidth-width-16));
    panel.style.setProperty("--desktop-weather-left",left+"px");
    panel.style.setProperty("--desktop-weather-top",(rect.bottom+10)+"px");
    panel.style.setProperty("--desktop-weather-width",width+"px");
  };

  const setOpen=open=>{
    panel.hidden=!open;
    trigger.setAttribute("aria-expanded",String(open));
    document.body.classList.toggle("desktop-weather-expanded",open);
    if(open){
      positionPanel();
      requestAnimationFrame(positionPanel);
    }
  };

  trigger.addEventListener("click",event=>{
    event.stopPropagation();
    setOpen(panel.hidden);
  });

  close?.addEventListener("click",event=>{
    event.stopPropagation();
    setOpen(false);
    trigger.focus({preventScroll:true});
  });

  panel.addEventListener("click",event=>event.stopPropagation());

  document.addEventListener("click",()=>{
    if(!panel.hidden)setOpen(false);
  });

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!panel.hidden){
      setOpen(false);
      trigger.focus({preventScroll:true});
    }
  });

  window.addEventListener("resize",positionPanel,{passive:true});
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",bindDesktopWeatherPanel,{once:true});
}else{
  bindDesktopWeatherPanel();
}

