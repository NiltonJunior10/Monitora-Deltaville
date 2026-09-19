/* v5.1.0: extracted without changing the shared application state contract. */
function isIOSDevice(){
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
}
function isStandaloneApp(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone===true;
}
function pushSupported(){
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
function base64UrlToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
function subscriptionKeys(subscription){
  const json=subscription.toJSON();
  return {
    endpoint:subscription.endpoint,
    p256dh:json.keys?.p256dh||"",
    auth:json.keys?.auth||""
  };
}
async function invokePushSubscribe(action,subscription,minSeverity=state.pushMinSeverity){
  if(!subscription)return;
  const keys=subscriptionKeys(subscription);
  const {error}=await db.functions.invoke("push-subscribe",{body:{
    action,
    endpoint:keys.endpoint,
    p256dh:keys.p256dh,
    auth:keys.auth,
    min_severity:minSeverity,
    vapid_public_key:PUSH_VAPID_PUBLIC_KEY,
    user_agent:navigator.userAgent
  }});
  if(error)throw error;
}
async function currentBrowserPushSubscription(){
  if(!pushSupported())return null;
  const reg=await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
}
function renderPushSettings(){
  const toggle=$("#pushToggle"),panel=$("#pushLevelPanel"),status=$("#pushStatusText"),help=$("#pushHelp");
  if(!toggle)return;

  const supported=pushSupported();
  const iosNeedsInstall=isIOSDevice()&&!isStandaloneApp();
  const denied=("Notification" in window)&&Notification.permission==="denied";

  toggle.setAttribute("aria-checked",state.pushEnabled?"true":"false");
  toggle.classList.toggle("on",state.pushEnabled);
  toggle.classList.toggle("disabled",!supported||denied||iosNeedsInstall);
  if(panel)panel.hidden=!state.pushEnabled;

  $$("[data-push-level]").forEach(btn=>btn.classList.toggle("selected",btn.dataset.pushLevel===state.pushMinSeverity));

  if(iosNeedsInstall){
    status.textContent="Instale o app para ativar";
    help.textContent="No iPhone, adicione o Monitora à Tela de Início. Depois abra pelo ícone e ative as notificações.";
    toggle.setAttribute("aria-label","Instalar para ativar notificações");
  }else if(!supported){
    status.textContent="Não disponível neste navegador";
    help.textContent="Este aparelho ou navegador não oferece notificações push.";
  }else if(denied){
    status.textContent="Bloqueadas pelo sistema";
    help.textContent="As notificações foram bloqueadas. Reative nas configurações de notificações do aparelho.";
  }else if(state.pushEnabled){
    const labels={attention:"Atenção, Alerta e Crítico",alert:"Alerta e Crítico",critical:"Somente Crítico"};
    status.textContent="Ativas neste aparelho";
    help.textContent=`Recebendo: ${labels[state.pushMinSeverity]||labels.attention}.`;
    toggle.setAttribute("aria-label","Desativar notificações");
  }else{
    status.textContent="Desativadas neste aparelho";
    help.textContent="Ative para receber novas ocorrências mesmo quando o app estiver fechado.";
    toggle.setAttribute("aria-label","Ativar notificações");
  }
}
async function loadPushSettings(){
  try{
    if(!pushSupported()){state.pushEnabled=false;renderPushSettings();return;}
    await loadPushConfig();
    const subscription=await currentBrowserPushSubscription();
    if(subscription && !pushKeyMatches(subscription)){
      state.pushEnabled=false;
      state.pushSubscription=subscription;
      renderPushSettings();
      if($("#pushHelp"))$("#pushHelp").textContent="A chave de segurança foi atualizada. Ative novamente as notificações neste aparelho.";
      return;
    }
    state.pushSubscription=subscription;
    if(!subscription){state.pushEnabled=false;renderPushSettings();return;}

    const {data,error}=await db.from("push_subscriptions")
      .select("min_severity,enabled")
      .eq("endpoint",subscription.endpoint)
      .eq("user_id",state.user.id)
      .maybeSingle();
    if(error)throw error;

    if(data?.enabled){
      state.pushEnabled=true;
      state.pushMinSeverity=data.min_severity||"attention";
      await invokePushSubscribe("subscribe",subscription,state.pushMinSeverity).catch(()=>{});
    }else{
      state.pushEnabled=false;
    }
  }catch(err){
    console.warn("Push settings:",err);
    state.pushEnabled=false;
  }
  renderPushSettings();
}
async function enablePushNotifications(){
  if(isIOSDevice()&&!isStandaloneApp()){
    renderPushSettings();
    handleInstall();
    return;
  }
  if(!pushSupported()){
    toast("Notificações não são compatíveis com este navegador.");
    return;
  }
  if(Notification.permission==="denied"){
    renderPushSettings();
    toast("As notificações estão bloqueadas nas configurações do aparelho.");
    return;
  }

  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission!=="granted"){
    state.pushEnabled=false;
    renderPushSettings();
    return;
  }

  await loadPushConfig();
  const reg=await navigator.serviceWorker.ready;
  let subscription=await reg.pushManager.getSubscription();
  if(subscription&&!pushKeyMatches(subscription)){
    await invokePushSubscribe("unsubscribe",subscription);
    await subscription.unsubscribe();
    subscription=null;
  }
  if(!subscription){
    subscription=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:base64UrlToUint8Array(PUSH_VAPID_PUBLIC_KEY)
    });
  }
  await invokePushSubscribe("subscribe",subscription,state.pushMinSeverity);
  state.pushSubscription=subscription;
  state.pushEnabled=true;
  renderPushSettings();
  try{
    await reg.showNotification("Notificações ativadas",{
      body:"O Monitora Deltaville avisará conforme o grau escolhido.",
      icon:"assets/icon-192.png",
      badge:"assets/icon-192.png",
      tag:"monitora-push-enabled"
    });
  }catch(_){}
}
async function disablePushNotifications({silent=false}={}){
  try{
    const subscription=state.pushSubscription||await currentBrowserPushSubscription();
    if(subscription){
      await invokePushSubscribe("unsubscribe",subscription,state.pushMinSeverity).catch(()=>{});
      await subscription.unsubscribe().catch(()=>{});
    }
  }finally{
    state.pushSubscription=null;
    state.pushEnabled=false;
    renderPushSettings();
    if(!silent)toast("Notificações desativadas neste aparelho.");
  }
}
async function togglePushNotifications(){
  try{
    if(state.pushEnabled)await disablePushNotifications();
    else await enablePushNotifications();
  }catch(err){
    console.error(err);
    toast("Não foi possível alterar as notificações.");
    await loadPushSettings();
  }
}
async function setPushMinimumSeverity(level){
  if(!["attention","alert","critical"].includes(level))return;
  state.pushMinSeverity=level;
  localStorage.setItem("monitora_push_level",level);
  renderPushSettings();
  try{
    if(state.pushEnabled){
      const subscription=state.pushSubscription||await currentBrowserPushSubscription();
      if(subscription)await invokePushSubscribe("subscribe",subscription,level);
    }
  }catch(err){
    console.error(err);
    toast("Não foi possível salvar a preferência.");
  }
}
async function sendOccurrencePush(ids){
  if(!Array.isArray(ids)||!ids.length)return;
  const {error}=await db.functions.invoke("push-occurrence",{body:{occurrence_ids:ids}});
  if(error)throw error;
}
async function notifyLocal(title,body){
  if(!("Notification" in window)||Notification.permission!=="granted"||!("serviceWorker" in navigator))return;
  try{
    const reg=await navigator.serviceWorker.ready;
    await reg.showNotification(title,{body,icon:"assets/icon-192.png",badge:"assets/icon-192.png",tag:"monitora-local"});
  }catch(_){}
}
function handlePushDeepLink(){
  const url=new URL(location.href);
  const occurrenceId=url.searchParams.get("occurrence");
  if(!occurrenceId)return;
  url.searchParams.delete("occurrence");
  history.replaceState({}, "", url.pathname+url.search+url.hash);
  setTimeout(()=>focusOccurrenceOnMap(occurrenceId),300);
}


