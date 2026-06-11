import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const method = req.method;
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // pathParts example: ["fences"] or ["fences", "uuid"]
    const zoneId = pathParts[pathParts.length - 1] !== "fences" ? pathParts[pathParts.length - 1] : null;

    // ── GET — list all zones ─────────────────────────────────────────────────
    if (method === "GET") {
      const { data, error } = await supabase
        .from("zones")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Auto-seed default zones if empty
      if (!data || data.length === 0) {
        await seedDefaultZones(supabase);
        const { data: seeded } = await supabase.from("zones").select("*");
        return json(seeded ?? []);
      }

      return json(data);
    }

    // ── POST — create a new zone ─────────────────────────────────────────────
    if (method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      // Validate required fields
      const { name, zone_type, center_lat, center_lon, radius_meters } = body as {
        name?: string;
        zone_type?: string;
        center_lat?: number;
        center_lon?: number;
        radius_meters?: number;
      };

      if (!name || typeof name !== "string") {
        return json({ error: "name is required and must be a string" }, 400);
      }
      if (typeof center_lat !== "number" || typeof center_lon !== "number") {
        return json({ error: "center_lat and center_lon must be numbers" }, 400);
      }

      const newZone = {
        name: String(name).slice(0, 100),
        zone_type: String(zone_type ?? "GEOFENCE").toUpperCase(),
        center_lat: Number(center_lat),
        center_lon: Number(center_lon),
        radius_meters: Number(radius_meters ?? 5000),
        color: String(body.color ?? "#00ff88"),
        threat_level: String(body.threat_level ?? "LOW").toUpperCase(),
        description: body.description ? String(body.description).slice(0, 500) : null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("zones")
        .insert(newZone)
        .select()
        .single();

      if (error) throw error;
      return json(data, 201);
    }

    // ── DELETE — remove a zone ───────────────────────────────────────────────
    if (method === "DELETE" && zoneId) {
      const { error } = await supabase.from("zones").delete().eq("id", zoneId);
      if (error) throw error;
      return json({ deleted: true, id: zoneId });
    }

    // ── PUT — update a zone ──────────────────────────────────────────────────
    if (method === "PUT" && zoneId) {
      const body = await req.json().catch(() => ({}));
      const { data, error } = await supabase
        .from("zones")
        .update(body)
        .eq("id", zoneId)
        .select()
        .single();
      if (error) throw error;
      return json(data);
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    console.error("fences fn error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function seedDefaultZones(supabase: ReturnType<typeof createClient>) {
  const zones = [
    { name: "Delhi Cantonment",      zone_type: "RESTRICTED",   center_lat: 28.59, center_lon: 77.13, radius_meters: 8000,  color: "#ff4444", threat_level: "HIGH"   },
    { name: "Rajasthan Desert AO",   zone_type: "OPERATIONAL",  center_lat: 26.50, center_lon: 73.00, radius_meters: 50000, color: "#ff8800", threat_level: "MEDIUM" },
    { name: "LOC Buffer Zone",       zone_type: "RESTRICTED",   center_lat: 34.10, center_lon: 74.90, radius_meters: 20000, color: "#ff0000", threat_level: "CRITICAL"},
    { name: "Mumbai Naval Base",     zone_type: "BASE",          center_lat: 18.91, center_lon: 72.82, radius_meters: 5000,  color: "#0088ff", threat_level: "HIGH"   },
    { name: "IAF Hindon Air Base",   zone_type: "BASE",          center_lat: 28.69, center_lon: 77.32, radius_meters: 6000,  color: "#00aaff", threat_level: "HIGH"   },
    { name: "Safe Evacuation Corr.", zone_type: "SAFE",          center_lat: 28.45, center_lon: 77.00, radius_meters: 10000, color: "#00ff88", threat_level: "LOW"    },
    { name: "Siachen Glacier AO",    zone_type: "OPERATIONAL",  center_lat: 35.40, center_lon: 76.90, radius_meters: 30000, color: "#ff6600", threat_level: "HIGH"   },
    { name: "Bay of Bengal Patrol",  zone_type: "PATROL",       center_lat: 13.50, center_lon: 81.00, radius_meters: 80000, color: "#00ffff", threat_level: "MEDIUM" },
  ];

  for (const z of zones) {
    await supabase.from("zones").insert({ ...z, active: true });
  }
}
