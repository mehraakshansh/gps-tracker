import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Haversine distance in metres ─────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Move asset one step along its waypoint route ──────────────────────────────
function stepAsset(asset: Record<string, unknown>): { lat: number; lon: number; idx: number; heading: number } {
  const waypoints = (asset.waypoints as [number, number][]) ?? [];
  if (!waypoints.length) {
    return { lat: asset.current_lat as number, lon: asset.current_lon as number, idx: 0, heading: 0 };
  }

  const idx = ((asset.waypoint_index as number) ?? 0) % waypoints.length;
  const [targetLat, targetLon] = waypoints[idx];
  const curLat = asset.current_lat as number;
  const curLon = asset.current_lon as number;

  const dist = haversine(curLat, curLon, targetLat, targetLon);
  const speed = (asset.speed_kmh as number ?? 50) * 1000 / 3600; // m/s
  const stepM = speed * 1.5; // 1.5 second tick

  const heading = Math.atan2(targetLon - curLon, targetLat - curLat) * (180 / Math.PI);

  if (dist < stepM || dist < 50) {
    // Reached waypoint — advance to next
    const nextIdx = (idx + 1) % waypoints.length;
    return { lat: targetLat, lon: targetLon, idx: nextIdx, heading };
  }

  // Interpolate towards waypoint
  const frac = stepM / dist;
  return {
    lat: curLat + (targetLat - curLat) * frac,
    lon: curLon + (targetLon - curLon) * frac,
    idx,
    heading,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SERVICE_ROLE_KEY") ?? "",
  );

  try {
    // Load all active assets
    const { data: assets, error: ae } = await supabase
      .from("assets")
      .select("*")
      .in("status", ["ACTIVE", "STANDBY"]);
    if (ae) throw ae;
    if (!assets || assets.length === 0) {
      return new Response(JSON.stringify({ moved: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all active zones
    const { data: zones } = await supabase
      .from("zones")
      .select("*")
      .eq("is_active", true);

    const updatedAssets: Record<string, unknown>[] = [];
    const newAlerts: Record<string, unknown>[] = [];

    for (const asset of assets) {
      const prev = { lat: asset.current_lat as number, lon: asset.current_lon as number };
      const next = stepAsset(asset);

      // Geo-fence check for each zone
      for (const zone of zones ?? []) {
        const wasIn = haversine(prev.lat, prev.lon, zone.center_lat, zone.center_lon) <= zone.radius_meters;
        const isIn  = haversine(next.lat, next.lon, zone.center_lat, zone.center_lon) <= zone.radius_meters;

        if (!wasIn && isIn) {
          newAlerts.push({
            asset_id: asset.id,
            zone_id: zone.id,
            alert_type: "ENTERED",
            severity: zone.threat_level === "CRITICAL" ? "CRITICAL" : zone.threat_level === "HIGH" ? "WARNING" : "INFO",
            message: `${asset.name} ENTERED zone: ${zone.name}`,
          });
        } else if (wasIn && !isIn) {
          newAlerts.push({
            asset_id: asset.id,
            zone_id: zone.id,
            alert_type: "EXITED",
            severity: zone.threat_level === "CRITICAL" ? "CRITICAL" : "INFO",
            message: `${asset.name} EXITED zone: ${zone.name}`,
          });
        }
      }

      updatedAssets.push({
        id: asset.id,
        current_lat: next.lat,
        current_lon: next.lon,
        waypoint_index: next.idx,
        heading: next.heading,
        fuel_level: Math.max(0, (asset.fuel_level as number) - 0.002),
        updated_at: new Date().toISOString(),
      });
    }

    // Batch update positions
    if (updatedAssets.length > 0) {
      await supabase.from("assets").upsert(updatedAssets, { onConflict: "id" });
    }

    // Insert alerts (cap at 5 per tick to avoid spam)
    if (newAlerts.length > 0) {
      await supabase.from("alerts").insert(newAlerts.slice(0, 5));
    }

    return new Response(JSON.stringify({ moved: updatedAssets.length, alerts: newAlerts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tick error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
