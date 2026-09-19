import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.113.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const levels = new Set(["attention","alert","critical"]);

function json(body: unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});}
function allowedEndpoint(endpoint:string){
  try{
    const u=new URL(endpoint);
    if(u.protocol!=="https:")return false;
    const h=u.hostname.toLowerCase();
    return h==="fcm.googleapis.com" || h.endsWith(".push.services.mozilla.com") || h.endsWith(".push.apple.com") || h==="web.push.apple.com";
  }catch{return false;}
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const auth=req.headers.get("Authorization")||"";
    const token=auth.replace(/^Bearer\s+/i,"");
    if(!token)return json({error:"UNAUTHORIZED"},401);
    const client=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
    const {data:u,error:ue}=await client.auth.getUser(token);
    if(ue||!u.user)return json({error:"UNAUTHORIZED"},401);
    const body=await req.json();
    const action=String(body.action||"subscribe");
    const endpoint=String(body.endpoint||"");
    if(!endpoint||!allowedEndpoint(endpoint))return json({error:"INVALID_ENDPOINT"},400);
    const admin=createClient(url,serviceKey,{auth:{persistSession:false}});

    const {data:cfg,error:cfgErr}=await admin.from("app_runtime_config").select("value").eq("key","push_vapid_public_key").maybeSingle();
    if(cfgErr||!cfg?.value)return json({error:"PUSH_CONFIG_UNAVAILABLE"},503);
    const vapidPublicKey=String(cfg.value);

    if(action==="unsubscribe"){
      const {error}=await admin.from("push_subscriptions").delete().eq("endpoint",endpoint).eq("user_id",u.user.id);
      if(error)throw error;
      return json({ok:true});
    }

    if(action!=="subscribe")return json({error:"UNKNOWN_ACTION"},400);
    if(String(body.vapid_public_key||"")!==vapidPublicKey)return json({error:"VAPID_KEY_MISMATCH"},409);
    const minSeverity=levels.has(String(body.min_severity))?String(body.min_severity):"attention";
    const p256dh=String(body.p256dh||"");
    const authKey=String(body.auth||"");
    if(!p256dh||!authKey)return json({error:"MISSING_KEYS"},400);

    const {error}=await admin.from("push_subscriptions").upsert({
      user_id:u.user.id,
      endpoint,p256dh,auth:authKey,min_severity:minSeverity,enabled:true,
      vapid_public_key:vapidPublicKey,
      user_agent:String(body.user_agent||"").slice(0,500)||null,
      updated_at:new Date().toISOString()
    },{onConflict:"endpoint"});
    if(error)throw error;
    return json({ok:true,min_severity:minSeverity,vapid_public_key:vapidPublicKey});
  }catch(error){
    console.error("push-subscribe",error instanceof Error?error.message:String(error));
    return json({error:"SUBSCRIPTION_FAILED"},500);
  }
});

