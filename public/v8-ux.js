/* Monitora Deltaville — v8-ux.js
   Skeleton (shimmer) enquanto os dados iniciais não chegam.
   - Só marca valores que ainda são "—" ou "Carregando…".
   - Após 8 s sem dado (ex.: rio sem cota oficial) troca o shimmer por um "—" discreto,
     para não parecer que o app está travado.
   Depende apenas de v8.css. Não altera nenhuma lógica do app. */
(function(){
  "use strict";
  var LIMIT_MS = 8000;
  var started = Date.now();
  var IDS = [
    "v7WeatherTemp","v7WeatherRain","v7WeatherChance","v7RiverLevel",
    "weatherTemp","weatherHeadline","topWeatherRain",
    "desktopResidentLine","desktopHelloTitle","v8StatusTitle","v8StatusReason"
  ];
  var els = IDS.map(function(id){return document.getElementById(id);}).filter(Boolean);

  function isPlaceholder(el){
    var t = (el.textContent || "").trim();
    return t === "—" || t === "-" || /^(Carregando|Verificando|Consultando)/i.test(t);
  }
  function mark(el){
    var waiting = isPlaceholder(el);
    if (!waiting) {
      el.classList.remove("v8-skel");
      el.removeAttribute("data-v8-na");
      return;
    }
    if (Date.now() - started < LIMIT_MS) {
      el.classList.add("v8-skel");
    } else {
      el.classList.remove("v8-skel");
      el.setAttribute("data-v8-na","");
    }
  }

  var pending = false;
  function schedule(){
    if (pending) return;
    pending = true;
    requestAnimationFrame(function(){
      pending = false;
      els.forEach(mark);
    });
  }

  els.forEach(function(el){
    mark(el);
    new MutationObserver(schedule).observe(el, {childList:true, characterData:true, subtree:true});
  });
  setTimeout(function(){ els.forEach(mark); }, LIMIT_MS + 50);
})();
