import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.113.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const client = createClient(url, anonKey, { auth: { persistSession: false } });

function json(body: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, ...extra, "Content-Type": "application/json", "Cache-Control":"no-store" } });
}
function norm(v: string) {
  return (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}
function unitKey(condominiumId: string, house: string) { return `${condominiumId}:${norm(house)}`; }
function weakPin(pin:string){return /^(\d)\1{5}$/.test(pin)||"0123456789012345".includes(pin)||"9876543210987654".includes(pin);}
function validPin(pin: string) { return /^\d{6}$/.test(pin || ""); }

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function requestIp(req:Request){
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0,128);
}
async function reserveAttempt(req:Request,key:string){
  // The unit bucket also limits distributed attempts with spoofed/rotating IPs.
  const buckets=[[await sha256('unit|'+key),20],[await sha256('ip|'+requestIp(req)),60]] as const;
  let retry=0;
  for(const [rateKey,limit] of buckets){
    const {data,error}=await admin.rpc('reserve_access_attempt',{p_key:rateKey,p_limit:limit});
    if(error)throw new Error('RATE_LIMIT_UNAVAILABLE');
    retry=Math.max(retry,Number(data)||0);
  }
  return retry;
}

async function makeSession(email: string, pin: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password: pin });
  if (error || !data.session) throw new Error("INVALID_CREDENTIALS");
  return {
    access_token:data.session.access_token,refresh_token:data.session.refresh_token,
    expires_in:data.session.expires_in,expires_at:data.session.expires_at,user_id:data.user.id
  };
}
async function profilesForUnit(condominiumId: string, house: string) {
  const { data, error } = await admin.from("profiles")
    .select("user_id,first_name,last_name,condominium_id,house_or_lot")
    .eq("condominium_id", condominiumId);
  if (error) throw error;
  return (data || []).filter((p:any)=>norm(p.house_or_lot)===norm(house));
}
async function accountsForUnit(key: string) {
  const { data, error } = await admin.from("login_accounts")
    .select("user_id,auth_email,login_key").eq("login_key", key).order("created_at", { ascending:true });
  if (error) throw error;
  return data || [];
}
async function pinAlreadyUsed(accounts:any[], pin:string) {
  for (const account of accounts) {
    try { await makeSession(account.auth_email, pin); return true; } catch (_) {}
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error:"METHOD_NOT_ALLOWED" },405);

  try {
    const body=await req.json();
    const action=String(body.action||"");
    const condominiumId=String(body.condominium_id||"");
    const house=String(body.house_or_lot||"").trim();
    const pin=String(body.pin||"");
    if(!condominiumId||!house)return json({error:"MISSING_FIELDS"},400);
    if(!validPin(pin))return json({error:"PIN_INVALID"},400);
    if(action!=="login"&&weakPin(pin))return json({error:"PIN_WEAK"},400);

    const key=unitKey(condominiumId,house);
    if(!['login','register','claim_legacy'].includes(action))return json({error:'UNKNOWN_ACTION'},400);
    const retry=await reserveAttempt(req,key);
    if(retry)return json({error:'TOO_MANY_ATTEMPTS',retry_after:retry},429,{'Retry-After':String(retry)});

    if(action==="login"){
      const accounts=await accountsForUnit(key);
      for(const account of accounts){
        try{
          const session=await makeSession(account.auth_email,pin);
          return json({ok:true,session});
        }catch(_){}
      }
      return json({error:"INVALID_ACCESS"},401);
    }

    if(action!=="register"&&action!=="claim_legacy")return json({error:"UNKNOWN_ACTION"},400);
    const first=String(body.first_name||"").trim();
    const last=String(body.last_name||"").trim();
    if(first.length<2||last.length<2)return json({error:"NAME_INVALID"},400);

    const {data:condo}=await admin.from("condominiums").select("id,name,active")
      .eq("id",condominiumId).eq("active",true).maybeSingle();
    if(!condo)return json({error:"CONDOMINIUM_INVALID"},400);

    const unitProfiles=await profilesForUnit(condominiumId,house);
    const unitAccounts=await accountsForUnit(key);
    if(await pinAlreadyUsed(unitAccounts,pin))return json({error:"PIN_ALREADY_USED"},409);

    let legacyProfile:any=null;
    if(action==="claim_legacy"){
      const matches=unitProfiles.filter((p:any)=>norm(p.first_name)===norm(first)&&norm(p.last_name)===norm(last));
      if(matches.length!==1){
          return json({error:"LEGACY_NOT_MATCHED"},404);
      }
      legacyProfile=matches[0];
      if(unitAccounts.some((a:any)=>a.user_id===legacyProfile.user_id))return json({error:"ACCOUNT_EXISTS"},409);
    }else if(unitProfiles.length>=2){
      return json({error:"UNIT_FULL"},409);
    }

    const email=`resident-${crypto.randomUUID()}@monitora.local`;
    const {data:created,error:createError}=await admin.auth.admin.createUser({
      email,password:pin,email_confirm:true,
      user_metadata:{app:"monitora-deltaville",first_name:first,last_name:last}
    });
    if(createError||!created.user)return json({error:"CREATE_USER_FAILED"},500);

    const newId=created.user.id;
    try{
      if(legacyProfile){
        const {error:migrateError}=await admin.rpc("claim_legacy_account_atomic",{
          p_old_user_id:legacyProfile.user_id,
          p_new_user_id:newId,
          p_auth_email:email,
          p_login_key:key
        });
        if(migrateError)throw migrateError;
        await admin.auth.admin.deleteUser(legacyProfile.user_id).catch(()=>{});
      }else{
        const {error:pe}=await admin.from("profiles").insert({
          user_id:newId,first_name:first,last_name:last,condominium_id:condominiumId,house_or_lot:house
        });
        if(pe){
          if(String(pe.message||"").includes("UNIT_FULL"))throw new Error("UNIT_FULL");
          throw pe;
        }
        const {error:le}=await admin.from("login_accounts").insert({
          user_id:newId,condominium_id:condominiumId,house_or_lot:house,login_key:key,auth_email:email
        });
        if(le)throw le;
      }

      return json({ok:true,migrated:!!legacyProfile,session:await makeSession(email,pin)});
    }catch(e){
      await admin.from("login_accounts").delete().eq("user_id",newId).catch(()=>{});
      await admin.from("profiles").delete().eq("user_id",newId).catch(()=>{});
      await admin.auth.admin.deleteUser(newId).catch(()=>{});
      if(e instanceof Error&&e.message==="UNIT_FULL")return json({error:"UNIT_FULL"},409);
      console.error("account setup",e);
      return json({error:"ACCOUNT_SETUP_FAILED"},500);
    }
  }catch(e){
    console.error("resident-access",e instanceof Error?e.message:String(e));
    return json({error:"ACCESS_UNAVAILABLE"},503);
  }
});

