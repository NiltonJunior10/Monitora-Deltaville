import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.113.0";

const URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET, OPTIONS"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"private, max-age=300"}});

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="GET")return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const admin=createClient(URL,SERVICE,{auth:{persistSession:false}});
    const {data,error}=await admin.from("app_runtime_config").select("key,value,updated_at").in("key",["push_vapid_public_key"]);
    if(error)throw error;
    const cfg=Object.fromEntries((data||[]).map((x:any)=>[x.key,x.value]));
    return json({
      push_vapid_public_key:cfg.push_vapid_public_key||null
    });
  }catch(e){
    console.error("app-config",e instanceof Error?e.message:String(e));
    return json({error:"CONFIG_UNAVAILABLE"},500);
  }
});

