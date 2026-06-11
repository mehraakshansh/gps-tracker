// ================================================================
// TICK ENGINE v4 — reads route_waypoints + simulator_state
// Moves all active assets along their patrol routes, fires
// geo-fence alerts on zone entry/exit.
// ================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SERVICE_ROLE_KEY")!,
);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const R = 6_371_000;
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 1 ── Load all active/operational assets
    const { data: assets, error: ae } = await sb
      .from("assets")
      .select("id, name, callsign, icon, current_lat, current_lon, speed_kmh, fuel_pct, threat_level, status");
    if (ae) throw ae;
    if (!assets?.length) {
      return new Response(JSON.stringify({ moved: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const activeAssets = assets.filter(a =>
      ["ACTIVE", "OPERATIONAL", "STANDBY", "ENGAGED"].includes(a.status ?? "ACTIVE")
    );
    if (!activeAssets.length) {
      return new Response(JSON.stringify({ moved: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const assetIds = activeAssets.map(a => a.id);

    // 2 ── Load route waypoints for all active assets
    const { data: rawWaypoints } = await sb
      .from("route_waypoints")
      .select("asset_id, seq, lat, lon")
      .in("asset_id", assetIds)
      .order("seq", { ascending: true });

    // 3 ── Load simulator state (tracks which waypoint each asset is heading to)
    const { data: simStates } = await sb
      .from("simulator_state")
      .select("asset_id, step_idx")
      .in("asset_id", assetIds);

    // 4 ── Active zones for geo-fence checks
    const { data: zones } = await sb
      .from("zones")
      .select("id, name, zone_type, center_lat, center_lon, radius_meters, threat_level")
      .or("active.eq.true,is_active.eq.true");  // handle both column names

    // Build lookup maps
    const waypointMap: Map<string, [number, number][]> = new Map();
    for (const wp of rawWaypoints ?? []) {
      if (!waypointMap.has(wp.asset_id)) waypointMap.set(wp.asset_id, []);
      waypointMap.get(wp.asset_id)!.push([wp.lat, wp.lon]);
    }

    const simStateMap: Map<string, number> = new Map();
    for (const s of simStates ?? []) {
      simStateMap.set(s.asset_id, s.step_idx ?? 0);
    }

    const assetUpdates: Record<string, unknown>[] = [];
    const simStateUpdates: { asset_id: string; step_idx: number; updated_at: string }[] = [];
    const newAlerts: Record<string, unknown>[] = [];

    // 5 ── Move each asset
    for (const asset of activeAssets) {
      if (asset.current_lat == null || asset.current_lon == null) continue;

      const waypoints = waypointMap.get(asset.id) ?? [];
      if (!waypoints.length) continue;

      const stepIdx = simStateMap.get(asset.id) ?? 0;
      const safeIdx = stepIdx % waypoints.length;
      const [targetLat, targetLon] = waypoints[safeIdx];

      const dist = haversine(asset.current_lat, asset.current_lon, targetLat, targetLon);
      const speedMs = ((asset.speed_kmh ?? 30) * 1000) / 3600;
      const stepM = speedMs * 2; // 2-second tick

      const heading =
        Math.atan2(targetLon - asset.current_lon, targetLat - asset.current_lat) *
        (180 / Math.PI);

      let nextLat: number, nextLon: number, nextIdx: number;

      if (dist < stepM || dist < 50) {
        // Reached waypoint — snap and advance
        nextLat = targetLat;
        nextLon = targetLon;
        nextIdx = (safeIdx + 1) % waypoints.length;
      } else {
        const frac = stepM / dist;
        nextLat = asset.current_lat + (targetLat - asset.current_lat) * frac;
        nextLon = asset.current_lon + (targetLon - asset.current_lon) * frac;
        nextIdx = safeIdx;
      }

      // Geo-fence entry/exit detection
      for (const zone of zones ?? []) {
        const wasIn = haversine(asset.current_lat, asset.current_lon, zone.center_lat, zone.center_lon) <= zone.radius_meters;
        const isIn  = haversine(nextLat, nextLon, zone.center_lat, zone.center_lon) <= zone.radius_meters;

        if (!wasIn && isIn) {
          newAlerts.push({
            asset_id: asset.id,
            asset_name: asset.callsign ?? asset.name,
            asset_icon: asset.icon ?? "🎯",
            zone_id: zone.id,
            zone_name: zone.name,
            event_type: "ENTERED",
            severity:
              zone.threat_level === "RED" || zone.threat_level === "CRITICAL" ? "CRITICAL" :
              zone.threat_level === "ORANGE" || zone.threat_level === "HIGH"  ? "WARNING"  : "INFO",
            message: `${asset.callsign ?? asset.name} ENTERED ${zone.zone_type}: ${zone.name}`,
            lat: nextLat,
            lon: nextLon,
          });
        } else if (wasIn && !isIn) {
          newAlerts.push({
            asset_id: asset.id,
            asset_name: asset.callsign ?? asset.name,
            asset_icon: asset.icon ?? "🎯",
            zone_id: zone.id,
            zone_name: zone.name,
            event_type: "EXITED",
            severity: zone.threat_level === "RED" || zone.threat_level === "CRITICAL" ? "WARNING" : "INFO",
            message: `${asset.callsign ?? asset.name} EXITED ${zone.zone_type}: ${zone.name}`,
            lat: nextLat,
            lon: nextLon,
          });
        }
      }

      // Low-fuel alert (once when crossing 20%)
      const newFuel = Math.max(0, (asset.fuel_pct ?? 100) - 0.05);
      if (newFuel <= 20 && (asset.fuel_pct ?? 100) > 20) {
        newAlerts.push({
          asset_id: asset.id,
          asset_name: asset.callsign ?? asset.name,
          asset_icon: asset.icon ?? "⛽",
          event_type: "FUEL_LOW",
          severity: "WARNING",
          message: `${asset.callsign ?? asset.name}: FUEL CRITICAL — ${newFuel.toFixed(0)}% remaining`,
          lat: nextLat,
          lon: nextLon,
        });
      }

      assetUpdates.push({
        id: asset.id,
        current_lat: nextLat,
        current_lon: nextLon,
        current_heading: heading,
        current_speed: asset.speed_kmh ?? 30,
        fuel_pct: newFuel,
        updated_at: new Date().toISOString(),
      });

      simStateUpdates.push({
        asset_id: asset.id,
        step_idx: nextIdx,
        updated_at: new Date().toISOString(),
      });
    }

    // 6 ── Batch writes
    if (assetUpdates.length > 0) {
      await sb.from("assets").upsert(assetUpdates, { onConflict: "id" });
    }
    if (simStateUpdates.length > 0) {
      await sb.from("simulator_state").upsert(simStateUpdates, { onConflict: "asset_id" });
    }
    if (newAlerts.length > 0) {
      await sb.from("alerts").insert(newAlerts.slice(0, 8));
    }

    return new Response(
      JSON.stringify({ moved: assetUpdates.length, alerts_fired: newAlerts.length }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("tick error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
