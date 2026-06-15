import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

    const [
      { count: total_assets },
      { count: active_alerts },
      { count: convoys_active },
      { count: active_users },
      { count: api_calls_1h },
    ] = await Promise.all([
      sb.from("assets").select("*", { count: "exact", head: true }),
      sb.from("alerts").select("*", { count: "exact", head: true }),
      sb.from("convoys").select("*", { count: "exact", head: true })
        .in("status", ["EN_ROUTE", "PLANNED"]),
      sb.from("user_sessions").select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("login_at", fiveMinAgo),
      sb.from("rate_limits").select("*", { count: "exact", head: true })
        .gte("window_start", oneHourAgo),
    ]);

    const { data, error } = await sb.from("kpi_snapshots").insert({
      snapshot_at:    now.toISOString(),
      active_users:   active_users   ?? 0,
      total_assets:   total_assets   ?? 0,
      active_alerts:  active_alerts  ?? 0,
      convoys_active: convoys_active ?? 0,
      api_calls_1h:   api_calls_1h   ?? 0,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, snapshot: data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
