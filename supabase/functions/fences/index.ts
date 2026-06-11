// ============================================================
// Supabase Edge Function: /fences
// GET  → list all fences
// POST → create a fence  { name, center_lat, center_lon, radius_meters, color }
// DELETE /:id → remove a fence
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  // DELETE /fences?id=<uuid>
  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: cors });
    await supabase.from("fences").delete().eq("id", id);
    await supabase.from("asset_zone_states").delete().eq("fence_id", id);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // POST /fences
  if (req.method === "POST") {
    const body = await req.json();
    const { data, error } = await supabase.from("fences").insert({
      name:          body.name,
      center_lat:    parseFloat(body.center_lat),
      center_lon:    parseFloat(body.center_lon),
      radius_meters: parseFloat(body.radius_meters),
      color:         body.color || "#8B5CF6",
    }).select().single();
    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: cors });
    return new Response(JSON.stringify(data), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
  }

  // GET /fences
  const { data } = await supabase.from("fences").select("*").order("created_at");
  return new Response(JSON.stringify(data || []), { headers: { ...cors, "Content-Type": "application/json" } });
});
