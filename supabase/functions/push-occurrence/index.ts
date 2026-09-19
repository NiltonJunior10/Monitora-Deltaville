import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.113.0";
import { sendPushBatch } from "npm:@mmmike/web-push@1.0.1/send";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_SUBJECT = "https://wdyvfuzmntqbldxxzokd.supabase.co";

const severityRank: Record<string, number> = { attention: 1, alert: 2, critical: 3 };
const severityLabel: Record<string, string> = { attention: "Atenção", alert: "Alerta", critical: "Crítico" };
const typeLabel: Record<string, string> = {
  avenue_flooding: "Alagamento em avenida",
  lakes_full: "Lago cheio",
  heavy_rain_flood_risk: "Chuva intensa / risco de alagamento",
  hail: "Granizo",
  wind_damage: "Vendaval com danos",
  wind_no_damage: "Vendaval",
  river_level: "Nível do Rio Biguaçu",
  river_overflow: "Transbordamento do Rio Biguaçu",
  public_lighting: "Iluminação pública",
  drainage_clogged: "Bueiro / drenagem",
  tree_hazard: "Árvore / galhos",
  road_damage: "Buraco / pavimento",
  power_outage: "Energia / poste",
  sewer_issue: "Esgoto / vazamento",
  waste_accumulation: "Lixo / entulho",
  signage_issue: "Sinalização",
  sidewalk_obstruction: "Calçada / obstrução",
  water_supply: "Abastecimento de água",
  infrastructure_damage: "Estrutura danificada",
  other_neighborhood_issue: "Outro problema",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json","Cache-Control":"no-store" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "UNAUTHORIZED" }, 401);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "UNAUTHORIZED" }, 401);

    const body = await req.json();
    const ids = Array.isArray(body?.occurrence_ids) ? body.occurrence_ids.map(String).filter(Boolean).slice(0, 20) : [];
    if (!ids.length) return json({ error: "MISSING_OCCURRENCE_IDS" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const [{data:secretData,error:secretError},{data:cfg,error:cfgError}] = await Promise.all([
      admin.rpc("get_runtime_secret",{p_name:"monitora_vapid_private_v2"}),
      admin.from("app_runtime_config").select("value").eq("key","push_vapid_public_key").maybeSingle()
    ]);
    if(secretError || !secretData) throw new Error("VAPID_SECRET_UNAVAILABLE");
    if(cfgError || !cfg?.value) throw new Error("VAPID_PUBLIC_UNAVAILABLE");
    const VAPID_PRIVATE_KEY=String(secretData);
    const VAPID_PUBLIC_KEY=String(cfg.value);

    const { data: rows, error: occError } = await admin
      .from("occurrences")
      .select("id,reporter_id,location_id,custom_location,occurrence_type,severity,created_at,monitored_locations(name)")
      .in("id", ids);
    if (occError) throw occError;
    if (!rows?.length) return json({ error: "NOT_FOUND" }, 404);
    if (rows.some((r: any) => r.reporter_id !== userData.user.id)) return json({ error: "FORBIDDEN" }, 403);

    const newest = Math.max(...rows.map((r: any) => new Date(r.created_at).getTime()));
    if (!Number.isFinite(newest) || Date.now() - newest > 10 * 60 * 1000) return json({ error: "STALE_OCCURRENCE" }, 409);

    const maxSeverity = rows.reduce((best: string, r: any) => (severityRank[r.severity] || 0) > (severityRank[best] || 0) ? r.severity : best, "attention");
    const first = rows[0] as any;
    const locations = [...new Set(rows.map((r: any) => r.monitored_locations?.name || r.custom_location).filter(Boolean))];
    const title = `${severityLabel[maxSeverity] || "Ocorrência"} no Deltaville`;
    const type = typeLabel[first.occurrence_type] || "Nova ocorrência";
    const place = locations.length === 1 ? locations[0] : locations.length > 1 ? `${locations.slice(0,2).join(" + ")}${locations.length > 2 ? ` +${locations.length-2}` : ""}` : "Deltaville";
    const notificationBody = `${type} • ${place}`;

    const { data: subscriptions, error: subError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth,min_severity,vapid_public_key")
      .eq("enabled", true)
      .eq("vapid_public_key",VAPID_PUBLIC_KEY)
      .neq("user_id", userData.user.id);
    if (subError) throw subError;

    const eligible = (subscriptions || []).filter((s: any) => (severityRank[maxSeverity] || 0) >= (severityRank[s.min_severity] || 99));
    if (!eligible.length) return json({ ok: true, delivered: 0, eligible: 0 });

    const pushSubscriptions = eligible.map((s: any) => ({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }));
    const vapid = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
    const url = `/?occurrence=${encodeURIComponent(first.id)}`;
    const result = await sendPushBatch(
      pushSubscriptions,
      { title, body: notificationBody, url, tag: `occurrence-${first.id}` },
      vapid,
      { ttl: maxSeverity === "critical" ? 7200 : 3600, urgency: maxSeverity === "critical" ? "high" : maxSeverity === "alert" ? "normal" : "low", concurrency: 50 }
    );

    if (result.gone?.length) {
      const goneEndpoints = result.gone.map((x: any) => typeof x === "string" ? x : x.endpoint).filter(Boolean);
      if (goneEndpoints.length) await admin.from("push_subscriptions").delete().in("endpoint", goneEndpoints);
    }

    return json({ ok: true, delivered: result.delivered || 0, eligible: eligible.length, failed: result.failed?.length || 0 });
  } catch (error) {
    console.error("push-occurrence", error instanceof Error ? error.message : String(error));
    return json({ error: "PUSH_FAILED" }, 500);
  }
});

