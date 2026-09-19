/* v5.1.0: extracted without changing the shared application state contract. */
function showAccess(mode="login"){
  $("#accessOverlay").hidden=false;
  switchAccessMode(mode);
}
function switchAccessMode(mode){
  maskAllPins();
  $$("[data-access-panel]").forEach(p=>p.hidden=p.dataset.accessPanel!==mode);
  $$("[data-access-mode]").forEach(b=>b.classList.toggle("selected",b.dataset.accessMode===mode));
  $("#accessTabs").hidden=mode==="legacy";
  const titles={
    login:["Entrar no aplicativo","Sem e-mail. Use seu condomínio, casa/lote e PIN."],
    register:["Criar cadastro","Cadastre-se uma vez e use o mesmo acesso no navegador ou app instalado."],
    legacy:["Recuperar cadastro anterior","Crie um PIN para continuar usando o cadastro que já existe."]
  };
  $("#accessTitle").textContent=titles[mode][0];
  $("#accessSubtitle").textContent=titles[mode][1];
}
function normalizeHouseLotInput(value){
  return String(value||"").replace(/\D/g,"");
}
function validHouseLot(value){
  const raw=normalizeHouseLotInput(value);
  if(!raw)return false;
  const n=Number(raw);
  return Number.isInteger(n)&&n>=1&&n<=500;
}
function houseLotError(){
  return "Informe um número de casa/lote entre 1 e 500.";
}
function maskAllPins(){
  $$(".pin-field").forEach(input=>input.type="password");
  $$(".password-eye").forEach(btn=>{
    btn.setAttribute("aria-pressed","false");
    btn.setAttribute("aria-label","Mostrar PIN");
    btn.classList.remove("showing");
  });
}
function togglePinVisibility(button){
  const id=button?.dataset?.toggleSecret;
  const input=id?$("#"+id):null;
  if(!input)return;
  const show=input.type==="password";
  input.type=show?"text":"password";
  button.setAttribute("aria-pressed",show?"true":"false");
  button.setAttribute("aria-label",show?"Ocultar PIN":"Mostrar PIN");
  button.classList.toggle("showing",show);
  input.focus({preventScroll:true});
  try{input.setSelectionRange(input.value.length,input.value.length);}catch(_){}
}

function accessErrorMessage(code){
  const m={
    INVALID_ACCESS:"Não foi possível entrar. Confira condomínio, casa/lote e PIN.",
    TOO_MANY_ATTEMPTS:"Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
    PIN_WEAK:"Escolha um PIN sem sequências ou números repetidos.",
    ACCOUNT_NOT_FOUND:"Cadastro não encontrado para esse condomínio e casa/lote.",
    PIN_INCORRECT:"PIN incorreto.",
    PIN_INVALID:"O PIN deve ter exatamente 6 números.",
    ACCOUNT_EXISTS:"Este morador já possui um acesso com PIN. Use “Já tenho cadastro”.",
    UNIT_FULL:"Esta casa/lote já possui 2 moradores cadastrados.",
    PIN_ALREADY_USED:"O outro morador desta casa/lote já usa esse PIN. Escolha um PIN diferente.",
    LEGACY_ACCOUNT:"Encontramos um cadastro da versão anterior. Use “Meu cadastro foi feito antes do PIN”.",
    LEGACY_NOT_MATCHED:"Não encontramos um cadastro antigo com esses dados. Confira nome, sobrenome, condomínio e casa/lote.",
    NAME_INVALID:"Informe nome e sobrenome corretamente.",
    MISSING_FIELDS:"Preencha todos os campos.",
    ACCOUNT_SETUP_FAILED:"Não foi possível finalizar o acesso. Tente novamente.",
    CREATE_USER_FAILED:"Não foi possível criar o acesso agora."
  };
  return m[code]||"Não foi possível concluir. Confira os dados e tente novamente.";
}
async function residentAccess(payload){
  const {data,error}=await db.functions.invoke("resident-access",{body:payload});
  if(error){
    let code;
    try{ code=(await error.context?.json())?.error; }catch(_){}
    throw new Error(code||"REQUEST_FAILED");
  }
  if(data?.error)throw new Error(data.error);
  return data;
}
async function applyReturnedSession(session){
  if(!session?.access_token||!session?.refresh_token)throw new Error("SESSION_INVALID");
  const {data,error}=await db.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
  if(error)throw error;
  state.user=data.user;
  await loadLookups();
  await loadProfile();
  await startSignedInApp();
}
async function handleLogin(e){
  e.preventDefault(); const err=$("#loginError");err.textContent="";
  const house=$("#loginHouseLot").value.trim();
  if(!validHouseLot(house)){err.textContent=houseLotError();$("#loginHouseLot").focus();return;}
  try{
    const payload={action:"login",condominium_id:$("#loginCondominium").value,house_or_lot:String(Number(normalizeHouseLotInput(house))),pin:$("#loginPin").value.trim()};
    const data=await residentAccess(payload);
    await applyReturnedSession(data.session);
    toast("Acesso realizado.");
  }catch(e){
    const code=["ACCOUNT_NOT_FOUND","PIN_INCORRECT","LEGACY_ACCOUNT"].includes(e.message)?"INVALID_ACCESS":e.message;
    err.textContent=accessErrorMessage(code);
  }
}
async function handleRegister(e){
  e.preventDefault();const err=$("#registerError");err.textContent="";
  const pin=$("#registerPin").value.trim(),pin2=$("#registerPin2").value.trim();
  const house=$("#registerHouseLot").value.trim();
  if(!validHouseLot(house)){err.textContent=houseLotError();$("#registerHouseLot").focus();return;}
  if(pin!==pin2){err.textContent="Os PINs não são iguais.";return;}
  try{
    const payload={action:"register",first_name:$("#registerFirstName").value.trim(),last_name:$("#registerLastName").value.trim(),condominium_id:$("#registerCondominium").value,house_or_lot:String(Number(normalizeHouseLotInput(house))),pin};
    const data=await residentAccess(payload);
    await applyReturnedSession(data.session);
    toast("Cadastro criado. Guarde seu PIN.");
  }catch(e){
    if(e.message==="LEGACY_ACCOUNT"){prefillLegacyFromRegister();switchAccessMode("legacy");}
    err.textContent=accessErrorMessage(e.message);
  }
}
function prefillLegacyFromRegister(){
  $("#legacyFirstName").value=$("#registerFirstName").value;
  $("#legacyLastName").value=$("#registerLastName").value;
  $("#legacyCondominium").value=$("#registerCondominium").value;
  setHouseValue("legacyHouseLot",$("#registerHouseLot").value);
}
function prefillLegacyFromProfile(){
  const p=state.profile;if(!p)return;
  $("#legacyFirstName").value=p.first_name;
  $("#legacyLastName").value=p.last_name;
  $("#legacyCondominium").value=p.condominium_id;
  setHouseValue("legacyHouseLot",p.house_or_lot);
}
async function handleLegacyClaim(e){
  e.preventDefault();const err=$("#legacyError");err.textContent="";
  const pin=$("#legacyPin").value.trim(),pin2=$("#legacyPin2").value.trim();
  const house=$("#legacyHouseLot").value.trim();
  if(!validHouseLot(house)){err.textContent=houseLotError();$("#legacyHouseLot").focus();return;}
  if(pin!==pin2){err.textContent="Os PINs não são iguais.";return;}
  try{
    const payload={action:"claim_legacy",first_name:$("#legacyFirstName").value.trim(),last_name:$("#legacyLastName").value.trim(),condominium_id:$("#legacyCondominium").value,house_or_lot:String(Number(normalizeHouseLotInput(house))),pin};
    const data=await residentAccess(payload);
    await applyReturnedSession(data.session);
    toast("Cadastro recuperado. Agora você pode usar o mesmo PIN em outros aparelhos.");
  }catch(e){err.textContent=accessErrorMessage(e.message);}
}
async function logoutAndSwitch(){
  const legacy=state.user?.is_anonymous===true;
  const msg=legacy?"Este cadastro ainda não tem PIN. Se sair, para recuperá-lo depois você deverá usar a opção de cadastro anterior. Deseja sair?":"Sair deste usuário e voltar para a tela de acesso?";
  if(!confirm(msg))return;
  try{localStorage.removeItem(snapshotKey());}catch(_){}
  try{await disablePushNotifications({silent:true});}catch(e){console.warn("Falha ao remover push:",e);}
  try{
    if(state.realtimeChannel)await db.removeChannel(state.realtimeChannel);
    await db.auth.signOut({scope:"local"});
  }catch(e){console.warn(e);}
  location.reload();
}

