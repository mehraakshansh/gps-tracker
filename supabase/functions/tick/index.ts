// ============================================================
// Supabase Edge Function: /tick
// Runs the GPS simulation step + geo-fence state machine
// Called every ~1s by the frontend via fetch (no cron needed)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const EARTH_R = 6_371_000;
const toRad   = (d: number) => (d * Math.PI) / 180;

// ── Haversine ────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Bearing ──────────────────────────────────────────────────
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const x = Math.sin(Δλ)*Math.cos(φ2);
  const y = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return ((Math.atan2(x, y)*180/Math.PI) + 360) % 360;
}

// ── GPS noise ────────────────────────────────────────────────
function addNoise(lat: number, lon: number, noiseM: number) {
  const d   = (Math.random()-0.5)*2*noiseM;
  const ang = Math.random()*2*Math.PI;
  return [
    lat + (d*Math.cos(ang))/111320,
    lon + (d*Math.sin(ang))/(111320*Math.cos(toRad(lat))),
  ];
}

// ── Simulate one step for one asset ─────────────────────────
function simulateStep(
  waypoints: { seq: number; lat: number; lon: number }[],
  stepIdx:   number,
  tProgress: number,
  speedKmh:  number,
  deltaS:    number,
  noiseM = 8
) {
  const n      = waypoints.length;
  const sorted = [...waypoints].sort((a,b) => a.seq - b.seq);
  const wp1    = sorted[stepIdx % n];
  const wp2    = sorted[(stepIdx + 1) % n];
  const segDist = haversine(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
  if (segDist < 1) return simulateStep(sorted, (stepIdx+1)%n, 0, speedKmh, deltaS, noiseM);

  const speedMs = speedKmh / 3.6;
  let t = tProgress + (speedMs * deltaS) / segDist;
  let step = stepIdx;
  while (t >= 1) { t -= 1; step = (step + 1) % n; }

  const s1 = sorted[step], s2 = sorted[(step+1)%n];
  let lat = s1.lat + t*(s2.lat - s1.lat);
  let lon = s1.lon + t*(s2.lon - s1.lon);
  [lat, lon] = addNoise(lat, lon, noiseM);
  const hdg   = bearing(s1.lat, s1.lon, s2.lat, s2.lon);
  const speed = speedKmh + (Math.random()-0.5)*6;
  return { lat, lon, heading: hdg, speed, newStep: step, newT: t };
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Load all assets, fences, waypoints, sim states, zone states in parallel
    const [
      { data: assets },
      { data: fences },
      { data: waypoints },
      { data: simStates },
      { data: zoneStates },
    ] = await Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("fences").select("*"),
      supabase.from("route_waypoints").select("*"),
      supabase.from("simulator_state").select("*"),
      supabase.from("asset_zone_states").select("*"),
    ]);

    const newAlerts: object[] = [];
    const assetUpdates: Promise<unknown>[] = [];

    for (const asset of (assets || [])) {
      const assetWaypoints = (waypoints || []).filter(w => w.asset_id === asset.id);
      const simState = (simStates || []).find(s => s.asset_id === asset.id);
      if (!assetWaypoints.length || !simState) continue;

      // 2. Simulate next GPS position
      const result = simulateStep(
        assetWaypoints,
        simState.step_idx,
        simState.t_progress,
        asset.speed_kmh,
        1.0
      );

      // 3. Update asset position + sim state
      assetUpdates.push(
        supabase.from("assets").update({
          current_lat:     parseFloat(result.lat.toFixed(7)),
          current_lon:     parseFloat(result.lon.toFixed(7)),
          current_speed:   parseFloat(result.speed.toFixed(1)),
          current_heading: parseFloat(result.heading.toFixed(1)),
          updated_at:      new Date().toISOString(),
        }).eq("id", asset.id)
      );
      assetUpdates.push(
        supabase.from("simulator_state").update({
          step_idx:   result.newStep,
          t_progress: result.newT,
          updated_at: new Date().toISOString(),
        }).eq("asset_id", asset.id)
      );

      // 4. Geo-fence state machine — check each fence
      for (const fence of (fences || [])) {
        const dist    = haversine(result.lat, result.lon, fence.center_lat, fence.center_lon);
        const inZone  = dist <= fence.radius_meters;
        const nextState = inZone ? "IN" : "OUT";

        const prevZone = (zoneStates || []).find(
          z => z.asset_id === asset.id && z.fence_id === fence.id
        );
        const prevState = prevZone?.state ?? "UNKNOWN";

        // 5. Transition detection — fire alert only on state change
        if (prevState !== "UNKNOWN" && prevState !== nextState) {
          const eventType = inZone ? "ENTERED" : "EXITED";
          newAlerts.push({
            asset_id:   asset.id,
            asset_name: asset.name,
            asset_icon: asset.icon,
            fence_id:   fence.id,
            fence_name: fence.name,
            event_type: eventType,
            severity:   inZone ? "info" : "critical",
            lat:        result.lat,
            lon:        result.lon,
          });
          // Increment alert count
          assetUpdates.push(
            supabase.from("assets")
              .update({ alert_count: (asset.alert_count || 0) + 1 })
              .eq("id", asset.id)
          );
        }

        // Upsert zone state
        assetUpdates.push(
          supabase.from("asset_zone_states").upsert({
            asset_id:   asset.id,
            fence_id:   fence.id,
            state:      nextState,
            updated_at: new Date().toISOString(),
          }, { onConflict: "asset_id,fence_id" })
        );
      }
    }

    // 6. Flush all writes + insert alerts in parallel
    await Promise.all([
      ...assetUpdates,
      ...(newAlerts.length ? [supabase.from("alerts").insert(newAlerts)] : []),
    ]);

    // 7. Return fresh snapshot for the frontend
    const [
      { data: freshAssets },
      { data: freshFences },
      { data: freshAlerts },
      { data: freshZones },
    ] = await Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("fences").select("*"),
      supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("asset_zone_states").select("*"),
    ]);

    // Attach fence status to each asset
    const assetsWithStatus = (freshAssets || []).map(a => ({
      ...a,
      fenceStatus: (freshZones || [])
        .filter(z => z.asset_id === a.id)
        .map(z => {
          const f = (freshFences || []).find(fn => fn.id === z.fence_id);
          return { fenceId: z.fence_id, fenceName: f?.name ?? "", state: z.state };
        }),
    }));

    return new Response(JSON.stringify({
      assets: assetsWithStatus,
      fences: freshFences || [],
      alerts: freshAlerts || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
