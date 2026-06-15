// ================================================================
// TICK ENGINE v5 — movement + combat + zone capture
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

// Simple LCG deterministic pseudo-random (seeded per-tick below)
let _seed = 12345;
function rand(): number { _seed = (_seed * 16807 + 7) % 2147483647; return (_seed - 1) / 2147483646; }
function seedRand(v: number) { _seed = Math.abs(v % 2147483647) || 1; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // ── 1. Load all assets (include war-sim columns) ──────────────────────────
    const { data: assets, error: ae } = await sb
      .from("assets")
      .select(
        "id, name, callsign, icon, current_lat, current_lon, speed_kmh, fuel_pct, " +
        "threat_level, status, faction, hp, max_hp, attack_power, range_km, " +
        "detection_radius_km, is_destroyed"
      );
    if (ae) throw ae;
    if (!assets?.length) {
      return new Response(JSON.stringify({ moved: 0, engagements: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Destroyed assets are removed from all combat/movement
    const liveAssets = assets.filter(a => !a.is_destroyed);
    const activeAssets = liveAssets.filter(a =>
      ["ACTIVE", "OPERATIONAL", "STANDBY", "ENGAGED"].includes(a.status ?? "ACTIVE")
    );

    const assetIds = activeAssets.map(a => a.id);

    // ── 2. Load waypoints + sim state ─────────────────────────────────────────
    const { data: rawWaypoints } = await sb
      .from("route_waypoints")
      .select("asset_id, seq, lat, lon")
      .in("asset_id", assetIds)
      .order("seq", { ascending: true });

    const { data: simStates } = await sb
      .from("simulator_state")
      .select("asset_id, step_idx")
      .in("asset_id", assetIds);

    // ── 3. Load zones (with capture cols) ────────────────────────────────────
    const { data: zones } = await sb
      .from("zones")
      .select(
        "id, name, zone_type, center_lat, center_lon, radius_meters, threat_level, " +
        "controlled_by, capture_ticks_bravo, capture_ticks_alpha, capture_threshold"
      )
      .or("active.eq.true,is_active.eq.true");

    // ── 4. Load current match state ───────────────────────────────────────────
    const { data: matchRows } = await sb
      .from("match_state")
      .select("*")
      .eq("id", 1)
      .limit(1);
    const match = matchRows?.[0] ?? null;

    // Build lookup maps
    const waypointMap = new Map<string, [number, number][]>();
    for (const wp of rawWaypoints ?? []) {
      if (!waypointMap.has(wp.asset_id)) waypointMap.set(wp.asset_id, []);
      waypointMap.get(wp.asset_id)!.push([wp.lat, wp.lon]);
    }
    const simStateMap = new Map<string, number>();
    for (const s of simStates ?? []) simStateMap.set(s.asset_id, s.step_idx ?? 0);

    const assetUpdates: Record<string, unknown>[] = [];
    const simStateUpdates: { asset_id: string; step_idx: number; updated_at: string }[] = [];
    const newAlerts: Record<string, unknown>[] = [];

    // Mutable HP map — updated in combat phase, then flushed with assetUpdates
    const hpMap = new Map<string, number>();
    const destroyedSet = new Set<string>();
    for (const a of liveAssets) hpMap.set(a.id, a.hp ?? 100);

    // Seed the RNG with something tick-specific but deterministic
    seedRand(Date.now() % 1_000_000);

    // ── 5. Movement phase ─────────────────────────────────────────────────────
    const nextPosMap = new Map<string, { lat: number; lon: number }>();
    for (const asset of activeAssets) {
      if (asset.current_lat == null || asset.current_lon == null) continue;

      const waypoints = waypointMap.get(asset.id) ?? [];
      if (!waypoints.length) {
        nextPosMap.set(asset.id, { lat: asset.current_lat, lon: asset.current_lon });
        continue;
      }

      const stepIdx = simStateMap.get(asset.id) ?? 0;
      const safeIdx = stepIdx % waypoints.length;
      const [targetLat, targetLon] = waypoints[safeIdx];

      const dist = haversine(asset.current_lat, asset.current_lon, targetLat, targetLon);
      const speedMs = ((asset.speed_kmh ?? 30) * 1000) / 3600;
      const stepM = speedMs * 2;
      const heading = Math.atan2(targetLon - asset.current_lon, targetLat - asset.current_lat) * (180 / Math.PI);

      let nextLat: number, nextLon: number, nextIdx: number;
      if (dist < stepM || dist < 50) {
        nextLat = targetLat; nextLon = targetLon;
        nextIdx = (safeIdx + 1) % waypoints.length;
      } else {
        const frac = stepM / dist;
        nextLat = asset.current_lat + (targetLat - asset.current_lat) * frac;
        nextLon = asset.current_lon + (targetLon - asset.current_lon) * frac;
        nextIdx = safeIdx;
      }

      nextPosMap.set(asset.id, { lat: nextLat, lon: nextLon });

      // Geo-fence entry/exit
      for (const zone of zones ?? []) {
        if (!zone.center_lat) continue;
        const wasIn = haversine(asset.current_lat, asset.current_lon, zone.center_lat, zone.center_lon) <= zone.radius_meters;
        const isIn  = haversine(nextLat, nextLon, zone.center_lat, zone.center_lon) <= zone.radius_meters;
        if (!wasIn && isIn) {
          newAlerts.push({
            asset_id: asset.id, asset_name: asset.callsign ?? asset.name, asset_icon: asset.icon ?? "🎯",
            zone_id: zone.id, zone_name: zone.name, event_type: "ENTERED",
            severity: zone.threat_level === "RED" || zone.threat_level === "CRITICAL" ? "CRITICAL" :
                      zone.threat_level === "ORANGE" || zone.threat_level === "HIGH"  ? "WARNING"  : "INFO",
            message: `${asset.callsign ?? asset.name} ENTERED ${zone.zone_type}: ${zone.name}`,
            lat: nextLat, lon: nextLon,
          });
        } else if (wasIn && !isIn) {
          newAlerts.push({
            asset_id: asset.id, asset_name: asset.callsign ?? asset.name, asset_icon: asset.icon ?? "🎯",
            zone_id: zone.id, zone_name: zone.name, event_type: "EXITED",
            severity: zone.threat_level === "RED" || zone.threat_level === "CRITICAL" ? "WARNING" : "INFO",
            message: `${asset.callsign ?? asset.name} EXITED ${zone.zone_type}: ${zone.name}`,
            lat: nextLat, lon: nextLon,
          });
        }
      }

      // Fuel drain
      const newFuel = Math.max(0, (asset.fuel_pct ?? 100) - 0.05);
      if (newFuel <= 20 && (asset.fuel_pct ?? 100) > 20) {
        newAlerts.push({
          asset_id: asset.id, asset_name: asset.callsign ?? asset.name, asset_icon: asset.icon ?? "⛽",
          event_type: "FUEL_LOW", severity: "WARNING",
          message: `${asset.callsign ?? asset.name}: FUEL CRITICAL — ${newFuel.toFixed(0)}% remaining`,
          lat: nextLat, lon: nextLon,
        });
      }

      assetUpdates.push({
        id: asset.id, current_lat: nextLat, current_lon: nextLon,
        current_heading: heading, current_speed: asset.speed_kmh ?? 30,
        fuel_pct: newFuel, updated_at: new Date().toISOString(),
      });
      simStateUpdates.push({ asset_id: asset.id, step_idx: nextIdx, updated_at: new Date().toISOString() });
    }

    // ── 6. Combat phase ───────────────────────────────────────────────────────
    // Build a quick lookup: all live assets by faction, with their current positions
    const combatAssets = liveAssets.map(a => ({
      ...a,
      pos: nextPosMap.get(a.id) ?? { lat: a.current_lat, lon: a.current_lon },
    })).filter(a => a.pos.lat != null);

    const bravoUnits = combatAssets.filter(a => a.faction === "BRAVO");
    const alphaUnits = combatAssets.filter(a => a.faction === "ALPHA");

    const combatLogs: Record<string, unknown>[] = [];
    let bravoKills = 0, alphaKills = 0;

    // Each BRAVO unit fires at nearest ALPHA in range (and vice versa)
    // We only process BRAVO-fires-at-ALPHA to avoid double-counting — ALPHA fires handled in second loop
    function processFaction(
      attackers: typeof combatAssets,
      defenders: typeof combatAssets,
      defenderFaction: string
    ) {
      for (const attacker of attackers) {
        if (destroyedSet.has(attacker.id)) continue;
        if (!attacker.attack_power || !attacker.range_km) continue;

        // Find closest defender in range
        let closest: typeof defenders[0] | null = null;
        let closestDist = Infinity;
        for (const def of defenders) {
          if (destroyedSet.has(def.id)) continue;
          const dist = haversine(attacker.pos.lat, attacker.pos.lon, def.pos.lat, def.pos.lon);
          const rangeM = (attacker.range_km ?? 5) * 1000;
          if (dist <= rangeM && dist < closestDist) {
            closest = def; closestDist = dist;
          }
        }
        if (!closest) continue;

        // Damage roll: 60–140% of attack_power
        const damage = Math.round((attacker.attack_power ?? 10) * (0.6 + rand() * 0.8));
        const hpBefore = hpMap.get(closest.id) ?? closest.hp ?? 100;
        const hpAfter  = Math.max(0, hpBefore - damage);
        const isKill   = hpAfter === 0;
        hpMap.set(closest.id, hpAfter);
        if (isKill) destroyedSet.add(closest.id);

        combatLogs.push({
          attacker_id:       attacker.id,
          attacker_faction:  attacker.faction,
          attacker_callsign: attacker.callsign ?? attacker.name,
          defender_id:       closest.id,
          defender_faction:  defenderFaction,
          defender_callsign: closest.callsign ?? closest.name,
          damage,
          defender_hp_before: hpBefore,
          defender_hp_after:  hpAfter,
          is_kill:            isKill,
          lat:  closest.pos.lat,
          lon:  closest.pos.lon,
        });

        // CONTACT_DETECTED alert (once per attacker per tick — throttle to avoid flooding)
        if (combatLogs.length <= 6) {
          newAlerts.push({
            asset_id: attacker.id, asset_name: attacker.callsign ?? attacker.name,
            asset_icon: attacker.icon ?? "⚔️",
            event_type: "CONTACT_DETECTED", severity: "WARNING",
            message: `${attacker.callsign ?? attacker.name} → ${closest.callsign ?? closest.name} [${damage} dmg]`,
            lat: closest.pos.lat, lon: closest.pos.lon,
          });
        }

        if (isKill) {
          if (defenderFaction === "ALPHA") bravoKills++;
          else alphaKills++;
          newAlerts.push({
            asset_id: closest.id, asset_name: closest.callsign ?? closest.name,
            asset_icon: "💀",
            event_type: "ASSET_DESTROYED", severity: "CRITICAL",
            message: `${closest.callsign ?? closest.name} [${defenderFaction}] DESTROYED by ${attacker.callsign ?? attacker.name}`,
            lat: closest.pos.lat, lon: closest.pos.lon,
          });
        }
      }
    }

    processFaction(bravoUnits, alphaUnits, "ALPHA");
    processFaction(alphaUnits, bravoUnits, "BRAVO");

    // ── 7. Zone capture phase ─────────────────────────────────────────────────
    const zoneUpdates: Record<string, unknown>[] = [];
    let zonesControlledBravo = 0, zonesControlledAlpha = 0;

    for (const zone of zones ?? []) {
      if (!zone.center_lat || !zone.capture_threshold) continue;
      let bravoInside = 0, alphaInside = 0;
      for (const a of combatAssets) {
        if (destroyedSet.has(a.id)) continue;
        const dist = haversine(a.pos.lat, a.pos.lon, zone.center_lat, zone.center_lon);
        if (dist <= (zone.radius_meters ?? 5000)) {
          if (a.faction === "BRAVO") bravoInside++;
          else if (a.faction === "ALPHA") alphaInside++;
        }
      }

      let newBravoTicks = zone.capture_ticks_bravo ?? 0;
      let newAlphaTicks = zone.capture_ticks_alpha ?? 0;
      let newControlled = zone.controlled_by ?? "NEUTRAL";

      if (bravoInside > 0 && alphaInside === 0) {
        newBravoTicks = Math.min(newBravoTicks + bravoInside, (zone.capture_threshold ?? 10) * 2);
        newAlphaTicks = Math.max(0, newAlphaTicks - 1);
      } else if (alphaInside > 0 && bravoInside === 0) {
        newAlphaTicks = Math.min(newAlphaTicks + alphaInside, (zone.capture_threshold ?? 10) * 2);
        newBravoTicks = Math.max(0, newBravoTicks - 1);
      }
      // Contested — no tick change

      if (newBravoTicks >= (zone.capture_threshold ?? 10) && newControlled !== "BRAVO") {
        newControlled = "BRAVO";
        newAlerts.push({
          asset_id: null, asset_name: "COMMAND", asset_icon: "🏳️",
          event_type: "ZONE_CAPTURED", severity: "CRITICAL",
          message: `ZONE CAPTURED: ${zone.name} → BRAVO`, lat: zone.center_lat, lon: zone.center_lon,
        });
      } else if (newAlphaTicks >= (zone.capture_threshold ?? 10) && newControlled !== "ALPHA") {
        newControlled = "ALPHA";
        newAlerts.push({
          asset_id: null, asset_name: "COMMAND", asset_icon: "🏴",
          event_type: "ZONE_CAPTURED", severity: "CRITICAL",
          message: `ZONE CAPTURED: ${zone.name} → ALPHA`, lat: zone.center_lat, lon: zone.center_lon,
        });
      }

      if (newControlled === "BRAVO") zonesControlledBravo++;
      else if (newControlled === "ALPHA") zonesControlledAlpha++;

      zoneUpdates.push({
        id: zone.id,
        capture_ticks_bravo: newBravoTicks,
        capture_ticks_alpha: newAlphaTicks,
        controlled_by: newControlled,
      });
    }

    // ── 8. Merge hp/destroy into assetUpdates ─────────────────────────────────
    // For assets that took damage, patch their update row (or add one)
    const updatedIds = new Set(assetUpdates.map(u => u.id as string));
    for (const [assetId, hp] of hpMap.entries()) {
      const original = liveAssets.find(a => a.id === assetId);
      if (!original || hp === (original.hp ?? 100)) continue; // no change
      const isDestroyed = destroyedSet.has(assetId);
      if (updatedIds.has(assetId)) {
        const row = assetUpdates.find(u => u.id === assetId)!;
        row.hp = hp;
        row.is_destroyed = isDestroyed;
      } else {
        assetUpdates.push({
          id: assetId, hp, is_destroyed: isDestroyed,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // ── 9. Update match_state ─────────────────────────────────────────────────
    if (match) {
      const newBravoScore  = (match.bravo_score ?? 0)  + bravoKills * 100 + zonesControlledBravo * 10;
      const newAlphaScore  = (match.alpha_score ?? 0)  + alphaKills * 100 + zonesControlledAlpha * 10;
      const newBravoDestroyed = (match.bravo_assets_destroyed ?? 0) + alphaKills;
      const newAlphaDestroyed = (match.alpha_assets_destroyed ?? 0) + bravoKills;

      // Win condition: all enemies destroyed OR score 5000
      const remainingAlpha = alphaUnits.filter(a => !destroyedSet.has(a.id)).length;
      const remainingBravo = bravoUnits.filter(a => !destroyedSet.has(a.id)).length;
      let status = match.status ?? "ACTIVE";
      let endedAt: string | null = null;
      if (status === "ACTIVE") {
        if (remainingAlpha === 0 || newBravoScore >= 5000) {
          status = "BRAVO_WINS"; endedAt = new Date().toISOString();
          newAlerts.push({
            asset_id: null, asset_name: "COMMAND", asset_icon: "🏆",
            event_type: "MATCH_END", severity: "CRITICAL",
            message: "BRAVO WINS — All enemy forces neutralised", lat: 28.6, lon: 77.2,
          });
        } else if (remainingBravo === 0 || newAlphaScore >= 5000) {
          status = "ALPHA_WINS"; endedAt = new Date().toISOString();
          newAlerts.push({
            asset_id: null, asset_name: "COMMAND", asset_icon: "💀",
            event_type: "MATCH_END", severity: "CRITICAL",
            message: "ALPHA WINS — Friendly forces neutralised", lat: 28.6, lon: 77.2,
          });
        }
      }

      await sb.from("match_state").update({
        bravo_score:            newBravoScore,
        alpha_score:            newAlphaScore,
        bravo_assets_destroyed: newBravoDestroyed,
        alpha_assets_destroyed: newAlphaDestroyed,
        zones_controlled_bravo: zonesControlledBravo,
        zones_controlled_alpha: zonesControlledAlpha,
        status,
        ...(endedAt ? { ended_at: endedAt } : {}),
      }).eq("id", 1);
    }

    // ── 10. Batch writes ──────────────────────────────────────────────────────
    if (assetUpdates.length > 0) {
      await sb.from("assets").upsert(assetUpdates, { onConflict: "id" });
    }
    if (simStateUpdates.length > 0) {
      await sb.from("simulator_state").upsert(simStateUpdates, { onConflict: "asset_id" });
    }
    if (zoneUpdates.length > 0) {
      await sb.from("zones").upsert(zoneUpdates, { onConflict: "id" });
    }
    if (combatLogs.length > 0) {
      await sb.from("combat_log").insert(combatLogs.slice(0, 50));
    }
    if (newAlerts.length > 0) {
      await sb.from("alerts").insert(newAlerts.slice(0, 10));
    }

    return new Response(
      JSON.stringify({
        moved: activeAssets.length,
        engagements: combatLogs.length,
        kills: { bravo: bravoKills, alpha: alphaKills },
        zones_captured: zoneUpdates.filter(z => z.controlled_by !== "NEUTRAL").length,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("tick error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
