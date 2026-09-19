const CACHE="monitora-deltaville-v605-ios27";
const APP_SHELL=[
  "https://unpkg.com/@supabase/supabase-js@2.113.0",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "./",
  "./index.html",
  "./styles.css?v=605",
  "./stability.css?v=605",
  "./apple-ui.css?v=605",
  "./v6.css?v=605",
  "./auth.js?v=605",
  "./river.js?v=605",
  "./weather.js?v=605",
  "./push.js?v=605",
  "./app.js?v=605",
  "./v6-ui.js?v=605",
  "./stability-core.js?v=605",
  "./theme-init.js?v=605",
  "./manifest.webmanifest",
  "./assets/brand-mark.svg",
  "./assets/logo-horizontal.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/mapa-deltaville-clean.webp",
  "./assets/mapa-entorno-fade.webp"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("monitora-deltaville-")&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request,fallbackUrl){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(!response.ok)throw new Error("Navigation temporarily unavailable");
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch(_){
    return (await cache.match(request)) || (fallbackUrl?await cache.match(fallbackUrl):undefined) || Response.error();
  }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  const network=fetch(request).then(async response=>{
    if(response&&(response.ok||response.type==="opaque")){
      await cache.put(request,response.clone());
    }
    return response;
  }).catch(()=>null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response&&(response.ok||response.type==="opaque"))await cache.put(request,response.clone());
  return response;
}

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;

  const url=new URL(event.request.url);

  // Dados vivos nunca devem ser atendidos por cache do SW.
  if(url.hostname.includes("supabase.co")||url.hostname.includes("open-meteo.com"))return;

  if(event.request.mode==="navigate"){
    event.respondWith(networkFirst(event.request,"./index.html"));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Dependências estáticas de terceiros ficam disponíveis após o primeiro carregamento.
  if(
    url.hostname==="unpkg.com" ||
    url.hostname==="fonts.googleapis.com" ||
    url.hostname==="fonts.gstatic.com"
  ){
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch(_){}
  const title=data.title||"Monitora Deltaville";
  const options={
    body:data.body||"Há uma nova ocorrência na comunidade.",
    icon:"./assets/icon-192.png",
    badge:"./assets/icon-192.png",
    tag:data.tag||"monitora-occurrence",
    renotify:true,
    data:{url:data.url||"./"}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const rawUrl=event.notification.data?.url||"./";
  let target=new URL("./",self.location.origin).href;
  try{const parsed=new URL(rawUrl,self.location.origin);if(parsed.origin===self.location.origin)target=parsed.href;}catch(_){}

  event.waitUntil(
    self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
      const sameOrigin=clients.find(client=>{
        try{return new URL(client.url).origin===self.location.origin;}catch(_){return false;}
      });
      if(sameOrigin){
        return sameOrigin.navigate(target).catch(()=>{}).then(()=>sameOrigin.focus());
      }
      return self.clients.openWindow(target);
    })
  );
});
