import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.113.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOURCE_SLUG = "epagri-ciram-rio-biguacu";
const SOURCE_URL = "https://ciram.epagri.sc.gov.br/graficos/getDataCasan_2284.php";
const STATION_CODE = "2284";
const STATION_NAME = "Biguaçu";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function parseMeasurementTime(value: string): string {
  const m = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`INVALID_MEASURED_AT:${value}`);
  const [, dd, mm, yy, hh, min] = m;
  const year = 2000 + Number(yy);
  return `${year}-${mm}-${dd}T${hh}:${min}:00-03:00`;
}
function numberOrNull(value: unknown): number | null {
  if(value==null||String(value).trim()==="")return null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function sameNumber(a:unknown,b:unknown,tolerance=0.0001){
  if(a==null||b==null)return a==null&&b==null;
  const na=Number(a),nb=Number(b);
  return Number.isFinite(na)&&Number.isFinite(nb)&&Math.abs(na-nb)<=tolerance;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const {data:expectedSecret,error:secretError}=await admin.rpc("get_runtime_secret",{p_name:"monitora_river_sync_secret_v1"});
  if(secretError || !expectedSecret) return json({error:"SYNC_SECRET_UNAVAILABLE"},503);
  const supplied=req.headers.get("x-monitora-sync-secret")||"";
  if(!supplied || supplied!==String(expectedSecret)) return json({error:"UNAUTHORIZED"},401);

  const startedAt = new Date().toISOString();
  let syncRunId: number | null = null;

  try {
    const { data: source, error: sourceError } = await admin
      .from("river_sources")
      .select("id,enabled,ingestion_enabled")
      .eq("slug", SOURCE_SLUG)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return json({ error: "SOURCE_NOT_FOUND" }, 404);
    if (!source.enabled || !source.ingestion_enabled) return json({ ok: false, skipped: "SOURCE_DISABLED" }, 409);

    const { data: run, error: runError } = await admin.from("river_sync_runs").insert({
      source_id: source.id,
      started_at: startedAt,
      status: "started"
    }).select("id").single();
    if(runError)throw runError;
    syncRunId = run?.id ?? null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response: Response;
    try {
      response = await fetch(SOURCE_URL, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "User-Agent": "Monitora-Deltaville/1.1 river-monitor"
        },
        signal: controller.signal
      });
    } finally { clearTimeout(timeout); }

    if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
    const text = await response.text();
    let payload: any;
    try { payload = JSON.parse(text); }
    catch { throw new Error("SOURCE_INVALID_JSON"); }
    if (!payload || !Array.isArray(payload.rows)) throw new Error("SOURCE_SCHEMA_CHANGED");

    const receivedAt = new Date().toISOString();
    const parsed: any[] = [];
    let invalid = 0;

    for (const row of payload.rows) {
      try {
        const c = row?.c;
        if (!Array.isArray(c) || c.length < 3) { invalid++; continue; }
        const measuredAt = parseMeasurementTime(c[0]?.v);
        const levelCm = numberOrNull(c[1]?.v);
        const precipitationMm = numberOrNull(c[2]?.v);
        if (levelCm === null || levelCm < -1000 || levelCm >= 10000) { invalid++; continue; }
        parsed.push({
          source_id: source.id,
          station_identifier: STATION_CODE,
          station_name: STATION_NAME,
          station_code: STATION_CODE,
          level_m: levelCm / 100,
          precipitation_mm: precipitationMm,
          measured_at: measuredAt,
          received_at: receivedAt,
          quality_status: "unverified",
          source_name: "Epagri/Ciram",
          raw_data: row
        });
      } catch (_) { invalid++; }
    }
    if (!parsed.length) throw new Error("NO_VALID_MEASUREMENTS");

    const { data: existing, error: existingError } = await admin
      .from("river_level_measurements")
      .select("id,measured_at,level_m,precipitation_mm")
      .eq("source_id", source.id)
      .eq("station_identifier", STATION_CODE)
      .in("measured_at", parsed.map(x => x.measured_at));
    if (existingError) throw existingError;

    const uniqueParsed=[...new Map(parsed.map(row=>[new Date(row.measured_at).toISOString(),row])).values()];
    const byTime=new Map((existing||[]).map((x:any)=>[new Date(x.measured_at).toISOString(),x]));
    const fresh:any[]=[];
    const corrected:any[]=[];
    let duplicates=0;
    for(const row of uniqueParsed){
      const key=new Date(row.measured_at).toISOString();
      const old:any=byTime.get(key);
      if(!old){fresh.push(row);continue;}
      if(!sameNumber(old.level_m,row.level_m)||!sameNumber(old.precipitation_mm,row.precipitation_mm)){
        corrected.push({...row,id:old.id,quality_status:"corrected"});
      }else duplicates++;
    }

    const changed=[...fresh,...corrected].map(({id,...row})=>row);
    if(changed.length){
      const {error}=await admin.from('river_level_measurements').upsert(changed,{
        onConflict:'source_id,station_identifier,measured_at',ignoreDuplicates:false
      });
      if(error)throw error;
    }

    const latest = parsed.reduce((a, b) => new Date(a.measured_at) > new Date(b.measured_at) ? a : b);
    if (syncRunId !== null) {
      const {error:finishError}=await admin.from("river_sync_runs").update({
        finished_at: new Date().toISOString(), status: "success", http_status: response.status,
        measurements_received: payload.rows.length,
        measurements_inserted: fresh.length + corrected.length,
        error_code: null, error_message: null,
        meta: {
          station_code: STATION_CODE, station_name: STATION_NAME, endpoint: SOURCE_URL,
          rows_valid: parsed.length, rows_new: fresh.length, rows_corrected: corrected.length,
          rows_duplicate: duplicates, rows_invalid: invalid, latest_measured_at: latest.measured_at
        }
      }).eq("id", syncRunId);
      if(finishError)throw finishError;
    }

    return json({
      ok: true, source: "Epagri/Ciram", station: { code: STATION_CODE, name: STATION_NAME },
      rows_received: payload.rows.length, rows_valid: parsed.length,
      rows_inserted: fresh.length, rows_corrected: corrected.length,
      rows_duplicate: duplicates, rows_invalid: invalid,
      latest: { measured_at: latest.measured_at, level_m: latest.level_m, precipitation_mm: latest.precipitation_mm },
      received_at: receivedAt
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("river-biguacu-sync", message);
    if (syncRunId !== null) {
      try {
        await admin.from("river_sync_runs").update({
          finished_at: new Date().toISOString(), status: "error",
          error_code: "SYNC_FAILED", error_message: message
        }).eq("id", syncRunId);
      } catch (_) {}
    }
    return json({ ok: false, error: "SYNC_FAILED" }, 502);
  }
});

