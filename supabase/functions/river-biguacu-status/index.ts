import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.113.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function trendFrom(deltaM:number|null, tolerance:number){
  if(deltaM===null || !Number.isFinite(deltaM)) return "unknown";
  if(Math.abs(deltaM) <= tolerance) return "stable";
  return deltaM > 0 ? "rising" : "falling";
}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="GET") return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const admin=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false}});
    const {data:source,error:sourceError}=await admin.from("river_sources")
      .select("id,slug,source_name,station_name,station_code,page_url,polling_minutes,stale_after_minutes,trend_stable_delta_m,enabled,ingestion_enabled,endpoint_url,response_format,notes")
      .eq("slug","epagri-ciram-rio-biguacu").maybeSingle();
    if(sourceError) throw sourceError;
    if(!source) return json({error:"SOURCE_NOT_FOUND"},404);

    const stationIdentifier=source.station_code || source.station_name;
    const {data:threshold}=await admin.from("river_level_thresholds")
      .select("attention_level_m,alert_level_m,critical_level_m,enabled,is_official,configured_from")
      .eq("source_id",source.id).eq("station_identifier",stationIdentifier).maybeSingle();

    const from7d=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const {data:rows,error:rowsError}=await admin.from("river_level_measurements")
      .select("level_m,precipitation_mm,measured_at,received_at,quality_status")
      .eq("source_id",source.id).eq("station_identifier",stationIdentifier)
      .gte("measured_at",from7d).order("measured_at",{ascending:true});
    if(rowsError) throw rowsError;

    const {data:lastSync}=await admin.from("river_sync_runs")
      .select("status,started_at,finished_at,http_status,measurements_received,measurements_inserted,error_code,error_message,meta")
      .eq("source_id",source.id).order("started_at",{ascending:false}).limit(1).maybeSingle();

    const measurements=rows||[];
    const latest=measurements.length?measurements[measurements.length-1]:null;
    const latestTime=latest?new Date(latest.measured_at).getTime():null;
    const staleMinutes=latest?Math.max(0,(Date.now()-latestTime!)/60000):null;
    const receivedAgeMinutes=latest?Math.max(0,(Date.now()-new Date(latest.received_at).getTime())/60000):null;
    const stale=latest?staleMinutes!>source.stale_after_minutes:true;

    function nearestAround(msAgo:number,maxDiffMinutes:number){
      if(!latest||latestTime===null) return null;
      const target=latestTime-msAgo;
      let best:any=null,bestDiff=Infinity;
      for(const m of measurements){
        const t=new Date(m.measured_at).getTime();
        if(t>=latestTime) continue;
        const d=Math.abs(t-target);
        if(d<bestDiff){best=m;bestDiff=d;}
      }
      return best && bestDiff<=maxDiffMinutes*60*1000 ? best : null;
    }

    const ref1h=nearestAround(60*60*1000,15);
    const delta1h=latest&&ref1h?Number(latest.level_m)-Number(ref1h.level_m):null;
    const trend=trendFrom(delta1h,Number(source.trend_stable_delta_m||0.02));

    let state="unknown";
    if(latest && threshold?.enabled){
      const level=Number(latest.level_m);
      if(threshold.critical_level_m!=null && level>=Number(threshold.critical_level_m)) state="critical";
      else if(threshold.alert_level_m!=null && level>=Number(threshold.alert_level_m)) state="alert";
      else if(threshold.attention_level_m!=null && level>=Number(threshold.attention_level_m)) state="attention";
      else state="normal";
    }

    const windows=[1,3,6,12,24,168].map(h=>{
      if(latestTime===null)return {hours:h,count:0,min_m:null,max_m:null,delta_m:null};
      const from=latestTime-h*60*60*1000;
      const subset=measurements.filter(m=>{
        const t=new Date(m.measured_at).getTime();
        return t>=from&&t<=latestTime;
      });
      if(!subset.length) return {hours:h,count:0,min_m:null,max_m:null,delta_m:null};
      const vals=subset.map(m=>Number(m.level_m));
      return {hours:h,count:subset.length,min_m:Math.min(...vals),max_m:Math.max(...vals),delta_m:vals.length>1?vals[vals.length-1]-vals[0]:null};
    });

    let connectionState = !source.endpoint_url || !source.ingestion_enabled ? "source_not_configured" : latest ? (stale?"stale":"ok") : "no_data";
    if(lastSync?.status==="error" && (!latest || (Date.now()-new Date(lastSync.started_at).getTime())<Number(source.stale_after_minutes||120)*60000)){
      connectionState="degraded";
    }

    return json({
      source:{
        name:source.source_name,page_url:source.page_url,station_name:source.station_name,station_code:source.station_code,
        endpoint_configured:Boolean(source.endpoint_url),ingestion_enabled:source.ingestion_enabled,response_format:source.response_format,
        polling_minutes:source.polling_minutes,stale_after_minutes:source.stale_after_minutes
      },
      connection_state:connectionState,
      last_sync:lastSync||null,
      latest:latest?{
        level_m:Number(latest.level_m),precipitation_mm:latest.precipitation_mm==null?null:Number(latest.precipitation_mm),
        measured_at:latest.measured_at,received_at:latest.received_at,quality_status:latest.quality_status,
        stale,stale_minutes:Math.round(staleMinutes||0),received_age_minutes:Math.round(receivedAgeMinutes||0)
      }:null,
      trend,variation_1h_interval_minutes:ref1h&&latestTime?Math.round((latestTime-new Date(ref1h.measured_at).getTime())/60000):null,variation_1h_m:delta1h,variation_1h_available:Boolean(ref1h),status:state,
      thresholds:{
        enabled:Boolean(threshold?.enabled),official:Boolean(threshold?.is_official),
        attention_m:threshold?.attention_level_m??null,alert_m:threshold?.alert_level_m??null,
        critical_m:threshold?.critical_level_m??null,configured_from:threshold?.configured_from??null
      },
      windows,
      series:measurements.map(m=>({t:m.measured_at,v:Number(m.level_m),p:m.precipitation_mm==null?null:Number(m.precipitation_mm),q:m.quality_status}))
    });
  }catch(error){
    console.error("river-biguacu-status",error instanceof Error?error.message:String(error));
    return json({error:"RIVER_STATUS_FAILED"},500);
  }
});

