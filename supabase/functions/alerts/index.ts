// ============================================================
// Supabase Edge Function: /alerts
// GET  → last 80 alerts (newest first)
// DELETE → clear all alerts
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method === "DELETE") {
    await supabase.from("alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  const { data } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  return new Response(JSON.stringify(data || []), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
