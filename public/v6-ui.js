/* Monitora Deltaville v6.0 — progressive UI enhancements */
(()=>{
  "use strict";

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const mobileMQ=window.matchMedia("(max-width:1179px)");

  function vibrate(pattern=10){
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(_){}
  }

  function toastSafe(message){
    try{
      if(typeof toast==="function"){ toast(message); return; }
    }catch(_){}
    const el=q("#toast");
    if(!el)return;
    el.textContent=message;
    el.hidden=false;
    clearTimeout(toastSafe.timer);
    toastSafe.timer=setTimeout(()=>{el.hidden=true;},1800);
  }

  function installMobileAlert(){
    const topbar=q(".topbar");
    if(!topbar||q(".v6-mobile-alert"))return;
    const button=document.createElement("button");
    button.type="button";
    button.className="v6-mobile-alert";
    button.dataset.nav="alerts";
    button.setAttribute("aria-label","Abrir alertas");
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><i></i>';
    topbar.appendChild(button);
  }

  function simplifyMobileTabBar(){
    const homeTab=q('.bottom-nav [data-nav="home"]');
    const homeLabel=homeTab&&q("b",homeTab);
    if(homeLabel)homeLabel.textContent="Painel";

    const alertTab=q(".bottom-nav .nav-alerts");
    if(alertTab){
      alertTab.dataset.nav="alerts";
      const icon=q(".nav-icon",alertTab);
      const label=q("b",alertTab);
      if(icon)icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><i class="nav-badge" id="navAlertBadge" hidden>0</i>';
      if(label)label.textContent="Alertas";
    }
  }

  let weatherMarker=null;
  let weatherHost=null;
  function setupWeatherPortal(){
    const weather=q(".topbar>.top-weather");
    const home=q('[data-page="home"]');
    const topbar=q(".topbar");
    if(!weather||!home||!topbar)return;

    if(!weatherMarker){
      weatherMarker=document.createComment("v6-weather-origin");
      topbar.insertBefore(weatherMarker,weather);
    }
    if(!weatherHost){
      weatherHost=document.createElement("div");
      weatherHost.className="v6-mobile-weather";
      const status=q(".status-card",home);
      if(status)status.insertAdjacentElement("afterend",weatherHost);
      else home.prepend(weatherHost);
    }

    const move=()=>{
      if(mobileMQ.matches){
        if(weather.parentElement!==weatherHost)weatherHost.appendChild(weather);
      }else if(weather.parentElement===weatherHost){
        weatherMarker.parentNode.insertBefore(weather,weatherMarker.nextSibling);
      }
    };
    move();
    mobileMQ.addEventListener?.("change",move);
  }

  function setupLargeTitle(){
    const main=q("main");
    if(!main)return;
    let ticking=false;
    const update=()=>{
      document.body.classList.toggle("v6-scrolled",main.scrollTop>22);
      ticking=false;
    };
    main.addEventListener("scroll",()=>{
      if(!ticking){ticking=true;requestAnimationFrame(update);}
    },{passive:true});
    update();
  }

  function setupMobileRedistribution(){
    const community=q("#v7CommunityReport");
    if(community&&community.dataset.bound!=="1"){
      community.dataset.bound="1";
      community.addEventListener("click",()=>{
        vibrate(8);
        q("#navReport")?.click();
      });
    }

    const weatherButton=q("[data-v7-weather-details]");
    const weatherDetails=q("#v7WeatherDetails");
    if(weatherButton&&weatherDetails&&weatherButton.dataset.bound!=="1"){
      weatherButton.dataset.bound="1";
      weatherButton.addEventListener("click",()=>{
        const open=weatherDetails.hidden;
        weatherDetails.hidden=!open;
        weatherButton.setAttribute("aria-expanded",String(open));
        document.body.classList.toggle("v7-weather-expanded",open);
        vibrate(7);
        if(open){
          setTimeout(()=>weatherDetails.scrollIntoView({behavior:"smooth",block:"nearest"}),50);
        }
      });
    }

    const weatherClose=q("[data-v7-weather-close]");
    if(weatherClose&&weatherDetails&&weatherClose.dataset.bound!=="1"){
      weatherClose.dataset.bound="1";
      weatherClose.addEventListener("click",()=>{
        weatherDetails.hidden=true;
        weatherButton?.setAttribute("aria-expanded","false");
        document.body.classList.remove("v7-weather-expanded");
        vibrate(6);
        setTimeout(()=>weatherButton?.scrollIntoView({behavior:"smooth",block:"center"}),30);
      });
    }

    const riverButton=q("[data-v7-river-details]");
    if(riverButton&&riverButton.dataset.bound!=="1"){
      riverButton.dataset.bound="1";
      riverButton.addEventListener("click",()=>{
        const open=!document.body.classList.contains("v7-river-expanded");
        document.body.classList.toggle("v7-river-expanded",open);
        riverButton.setAttribute("aria-expanded",String(open));
        vibrate(7);
        if(open){
          setTimeout(()=>q("#riverLevelCard")?.scrollIntoView({behavior:"smooth",block:"start"}),60);
        }
      });
    }

    const riverHead=q("#riverLevelCard .river-level-head");
    if(riverHead&&!q(".v7-river-collapse",riverHead)){
      const close=document.createElement("button");
      close.type="button";
      close.className="v7-river-collapse";
      close.textContent="Fechar";
      close.addEventListener("click",()=>{
        document.body.classList.remove("v7-river-expanded");
        riverButton?.setAttribute("aria-expanded","false");
        vibrate(6);
        setTimeout(()=>q(".v7-summary-card.river")?.scrollIntoView({behavior:"smooth",block:"center"}),30);
      });
      riverHead.appendChild(close);
    }

    const tabs=qa("[data-v7-alert-tab]");
    if(tabs.length){
      tabs.forEach(btn=>{
        if(btn.dataset.bound==="1")return;
        btn.dataset.bound="1";
        btn.addEventListener("click",()=>{
          const sources=btn.dataset.v7AlertTab==="sources";
          const page=q('[data-page="alerts"]');
          page?.classList.toggle("v7-sources-mode",sources);
          tabs.forEach(other=>{
            const active=other===btn;
            other.classList.toggle("active",active);
            other.setAttribute("aria-selected",String(active));
          });
          vibrate(6);
        });
      });
    }
  }

  function setupPinDots(){
    qa(".pin-field").forEach(input=>{
      if(input.dataset.v6Pin==="1")return;
      input.dataset.v6Pin="1";
      const wrap=input.closest(".secure-input-wrap");
      if(!wrap)return;
      const dots=document.createElement("div");
      dots.className="v6-pin-dots";
      dots.setAttribute("aria-hidden","true");
      dots.innerHTML="<i></i><i></i><i></i><i></i><i></i><i></i>";
      wrap.parentElement?.insertBefore(dots,wrap);
      wrap.parentElement?.classList.add("v6-pin-label");
      const paint=()=>{
        const len=String(input.value||"").replace(/\D/g,"").slice(0,6).length;
        qa("i",dots).forEach((dot,index)=>dot.classList.toggle("filled",index<len));
      };
      input.addEventListener("input",paint);
      input.addEventListener("focus",()=>vibrate(6));
      paint();
    });
  }

  const PRIMARY_TYPES=new Set([
    "avenue_flooding","river_level","wind_no_damage","hail","tree_hazard","other_neighborhood_issue"
  ]);

  function setupTypeGrid(){
    const grid=q("#typeChips");
    if(!grid||grid.dataset.v6Ready==="1")return;
    grid.dataset.v6Ready="1";
    qa("[data-occ-type]",grid).forEach(btn=>{
      if(!PRIMARY_TYPES.has(btn.dataset.occType))btn.classList.add("v6-secondary-type");
    });
    const more=document.createElement("button");
    more.type="button";
    more.className="v6-more-types";
    more.textContent="Ver todos os tipos";
    grid.insertAdjacentElement("afterend",more);
    more.addEventListener("click",()=>{
      const open=grid.classList.toggle("v6-show-all");
      more.textContent=open?"Mostrar menos":"Ver todos os tipos";
      vibrate(7);
    });
  }

  const wizard={
    step:1,
    max:4,
    ready:false,
    progress:null,
    title:null,
    actions:null,
    back:null,
    next:null,
    stepNodes:new Map()
  };

  function stepHeading(step){
    return [
      "",
      "O que aconteceu?",
      "Onde aconteceu?",
      "Qual a gravidade?",
      "Detalhes finais"
    ][step]||"Nova ocorrência";
  }

  function tagStep(el,step){
    if(!el)return;
    el.classList.add("v6-report-step");
    el.dataset.v6Step=String(step);
    if(!wizard.stepNodes.has(step))wizard.stepNodes.set(step,[]);
    wizard.stepNodes.get(step).push(el);
  }

  function buildReportWizard(){
    if(wizard.ready)return;
    const modal=q("#reportModal"), form=q("#reportForm"), manual=q("#manualReportFields");
    const head=q("#reportModal .sheet-head");
    if(!modal||!form||!manual||!head)return;

    wizard.progress=document.createElement("div");
    wizard.progress.className="v6-report-progress";
    wizard.progress.setAttribute("aria-label","Progresso da ocorrência");
    wizard.progress.innerHTML="<i></i><i></i><i></i><i></i>";
    head.insertAdjacentElement("afterend",wizard.progress);

    wizard.title=document.createElement("div");
    wizard.title.className="v6-report-step-title";
    wizard.title.innerHTML="<span>1</span><b>O que aconteceu?</b>";
    wizard.progress.insertAdjacentElement("afterend",wizard.title);

    manual.hidden=false;
    const blocks=qa(":scope > .compact-block",manual);
    const typeBlock=blocks[0]||null;
    const severityBlock=blocks.find(el=>q(".severity-v4",el))||null;
    const note=q(".note-v4",manual);
    const photo=q("#reportPhotoSection");
    tagStep(typeBlock,1);
    [q("#locationBlock"),q("#damageBlock"),q("#conditionBlock"),q("#mapToolsBlock")].forEach(el=>tagStep(el,2));
    tagStep(severityBlock,3);
    tagStep(note,4);
    tagStep(photo,4);

    wizard.actions=document.createElement("div");
    wizard.actions.className="v6-report-actions";
    wizard.actions.innerHTML='<button type="button" class="secondary v6-report-back">Voltar</button><button type="button" class="primary v6-report-next">Continuar</button>';
    const summary=q("#publishSummary");
    form.insertBefore(wizard.actions,summary||q("#reportError")||q("#submitReport"));
    wizard.back=q(".v6-report-back",wizard.actions);
    wizard.next=q(".v6-report-next",wizard.actions);

    wizard.back.addEventListener("click",()=>{if(wizard.step>1){vibrate(6);showReportStep(wizard.step-1);}});
    wizard.next.addEventListener("click",()=>{
      if(validateReportStep(wizard.step)){
        vibrate(8);
        showReportStep(Math.min(wizard.max,wizard.step+1));
      }
    });

    q("#submitReport")?.addEventListener("click",()=>vibrate([12,28,12]));
    form.addEventListener("change",()=>setTimeout(()=>refreshReportWizard(),0));
    form.addEventListener("input",()=>setTimeout(()=>refreshReportWizard(),0));

    wizard.ready=true;
    setupTypeGrid();
    showReportStep(1);
  }

  function hasSelectedLocation(){
    if(q("#locationBlock")?.hidden)return true;
    if(q("#locationChips .selected"))return true;
    const summary=(q("#multiPointSummary")?.textContent||"").toLowerCase();
    if(summary&&!summary.includes("nenhum"))return true;
    return false;
  }

  function validateReportStep(step){
    const error=q("#reportError");
    if(error)error.textContent="";
    if(step===1&&!q("#occurrenceType")?.value){
      if(error)error.textContent="Escolha o tipo de ocorrência.";
      toastSafe("Escolha o que aconteceu.");
      return false;
    }
    if(step===2){
      if(!hasSelectedLocation()){
        if(error)error.textContent="Informe onde aconteceu.";
        toastSafe("Escolha o local ou marque no mapa.");
        return false;
      }
      const condition=q("#avenueCondition");
      const conditionBlock=q("#conditionBlock");
      if(conditionBlock&&!conditionBlock.hidden&&condition&&!condition.value){
        if(error)error.textContent="Informe a situação da via.";
        toastSafe("Informe a situação da via.");
        return false;
      }
      const damage=q("#damageBlock");
      if(damage&&!damage.hidden&&!q("#damageChips .selected")){
        if(error)error.textContent="Selecione ao menos um dano observado.";
        toastSafe("Selecione o dano observado.");
        return false;
      }
    }
    return true;
  }

  function showReportStep(step){
    if(!wizard.ready)return;
    wizard.step=Math.max(1,Math.min(wizard.max,step));
    qa(".v6-report-step").forEach(el=>{
      const active=Number(el.dataset.v6Step)===wizard.step;
      el.classList.toggle("v6-step-active",active);
    });
    qa("i",wizard.progress).forEach((bar,index)=>bar.classList.toggle("active",index<wizard.step));
    const num=q("span",wizard.title), title=q("b",wizard.title);
    if(num)num.textContent=String(wizard.step);
    if(title)title.textContent=stepHeading(wizard.step);
    if(wizard.back)wizard.back.style.visibility=wizard.step===1?"hidden":"visible";
    if(wizard.next)wizard.next.style.display=wizard.step===wizard.max?"none":"block";
    const submit=q("#submitReport");
    if(submit)submit.style.display=wizard.step===wizard.max?"block":"none";
    const summary=q("#publishSummary");
    if(summary)summary.style.display=wizard.step===wizard.max&&!summary.hidden?"flex":"none";
    const expiry=q(".report-expiry-v4");
    if(expiry)expiry.style.display=wizard.step===wizard.max?"block":"none";
    const del=q("#deleteOccurrenceBtn");
    if(del)del.style.display=!del.hidden?"block":"none";
    q("#reportModal .report-sheet-v4")?.scrollTo({top:0,behavior:"smooth"});
  }

  function refreshReportWizard(){
    if(!wizard.ready)return;
    manualAlwaysOpen();
    qa(".v6-report-step").forEach(el=>{
      if(Number(el.dataset.v6Step)!==wizard.step)el.classList.remove("v6-step-active");
      else if(!el.hidden)el.classList.add("v6-step-active");
    });
    const summary=q("#publishSummary");
    if(summary)summary.style.display=wizard.step===wizard.max&&!summary.hidden?"flex":"none";
    const submit=q("#submitReport");
    if(submit)submit.style.display=wizard.step===wizard.max?"block":"none";
    const del=q("#deleteOccurrenceBtn");
    if(del)del.style.display=!del.hidden?"block":"none";
  }

  function manualAlwaysOpen(){
    const manual=q("#manualReportFields");
    if(manual)manual.hidden=false;
  }

  function resetWizardForOpen(){
    buildReportWizard();
    manualAlwaysOpen();
    if(q("#reportModal")?.hidden===false){
      showReportStep(1);
      setupTypeGrid();
      setTimeout(refreshReportWizard,0);
    }
  }

  function observeReportModal(){
    const modal=q("#reportModal");
    if(!modal)return;
    const observer=new MutationObserver(()=>{
      if(!modal.hidden)resetWizardForOpen();
    });
    observer.observe(modal,{attributes:true,attributeFilter:["hidden"]});
    document.addEventListener("click",event=>{
      if(event.target.closest("#homeReport,#navReport,[data-desktop-report],#mapReport,#mapFocusReportBtn")){
        setTimeout(resetWizardForOpen,30);
      }
      if(event.target.closest("[data-occ-type],.severity-v4 label,.location-chip,[data-damage-type]"))vibrate(7);
    },true);
  }

  function setupMapSheetSwipe(){
    const card=q("#mapFocusCard");
    if(!card)return;
    let startY=null;
    card.addEventListener("pointerdown",e=>{startY=e.clientY;},{passive:true});
    card.addEventListener("pointerup",e=>{
      if(startY==null)return;
      const delta=e.clientY-startY;
      startY=null;
      if(delta>72){
        vibrate(6);
        q("#mapFocusCloseBtn")?.click();
      }
    },{passive:true});
  }

  function setupPullToRefresh(){
    const main=q("main");
    if(!main||q(".v6-pull-indicator"))return;
    const indicator=document.createElement("div");
    indicator.className="v6-pull-indicator";
    indicator.textContent="↻";
    document.body.appendChild(indicator);
    let startY=0,pulling=false,eligible=false;

    main.addEventListener("touchstart",e=>{
      if(!mobileMQ.matches||document.body.classList.contains("map-open"))return;
      eligible=main.scrollTop<=0;
      if(!eligible)return;
      startY=e.touches[0].clientY;
      pulling=true;
    },{passive:true});

    main.addEventListener("touchmove",e=>{
      if(!pulling||!eligible)return;
      const delta=e.touches[0].clientY-startY;
      indicator.classList.toggle("visible",delta>45);
    },{passive:true});

    main.addEventListener("touchend",async e=>{
      if(!pulling||!eligible)return;
      const endY=e.changedTouches?.[0]?.clientY||startY;
      const delta=endY-startY;
      pulling=false;eligible=false;
      if(delta<85){indicator.classList.remove("visible");return;}
      indicator.classList.add("visible","refreshing");
      vibrate(9);
      try{
        if(typeof loadDataSafe==="function")await loadDataSafe();
        if(typeof renderAll==="function")renderAll();
        if(typeof loadRiverStatus==="function")await loadRiverStatus();
        toastSafe("Atualizado agora");
      }catch(_){toastSafe("Não foi possível atualizar agora.");}
      indicator.classList.remove("refreshing");
      setTimeout(()=>indicator.classList.remove("visible"),450);
    },{passive:true});
  }

  function syncAlertDot(){
    const dot=q(".v6-mobile-alert i");
    if(!dot)return;
    const count=Number(q("#alertsCount")?.textContent||q("#navAlertBadge")?.textContent||0);
    dot.hidden=count<=0;
  }

  function watchDynamicUI(){
    const alerts=q("#alertsCount");
    if(alerts){
      const observer=new MutationObserver(()=>syncAlertDot());
      observer.observe(alerts,{subtree:true,childList:true,characterData:true});
    }
  }

  function boot(){
    const tasks=[
      installMobileAlert,
      simplifyMobileTabBar,
      setupWeatherPortal,
      setupMobileRedistribution,
      setupLargeTitle,
      setupPinDots,
      buildReportWizard,
      observeReportModal,
      setupMapSheetSwipe,
      setupPullToRefresh,
      watchDynamicUI,
      syncAlertDot
    ];
    for(const task of tasks){
      try{ task(); }
      catch(error){ console.warn("v6 enhancement skipped:",task.name,error); }
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else setTimeout(boot,0);
})();