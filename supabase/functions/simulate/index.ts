// ================================================================
// OPERATION SIMULATOR v2 — Lanchester attrition + risk engine
// ================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASSET_COST_CRORE: Record<string, number> = {
  TANK: 20, APC: 5, ARTILLERY: 8, SPH: 18, MLRS: 25,
  HELICOPTER: 80, FIGHTER_JET: 800, UAV: 15, TRUCK: 0.2,
  SOLDIER: 0, PERSONNEL: 0, SUBMARINE: 2000, DESTROYER: 4000,
  AIRCRAFT_CARRIER: 20000, CARRIER: 20000, TRANSPORT: 15,
  PATROL_AIRCRAFT: 50, PATROL_VESSEL: 30,
};

const ATTRITION: Record<string, { equip: number; personnel: number }> = {
  STRIKE:    { equip: 0.15, personnel: 0.08 },
  RECON:     { equip: 0.05, personnel: 0.03 },
  RESCUE:    { equip: 0.08, personnel: 0.06 },
  PATROL:    { equip: 0.03, personnel: 0.02 },
  AMBUSH:    { equip: 0.12, personnel: 0.10 },
  SIEGE:     { equip: 0.20, personnel: 0.12 },
  AIRSTRIKE: { equip: 0.10, personnel: 0.02 },
  NAVAL:     { equip: 0.12, personnel: 0.05 },
  SUPPLY:    { equip: 0.02, personnel: 0.01 },
};

const TERRAIN_MUL: Record<string, number> = { URBAN: 1.8, MOUNTAIN: 1.6, JUNGLE: 1.4, DESERT: 1.2, PLAINS: 1.0 };
const WEATHER_MUL: Record<string, number> = { STORM: 1.5, FOG: 1.3, RAIN: 1.15, CLEAR: 1.0 };
const TIME_MUL:    Record<string, number> = { NIGHT: 0.85, DAWN: 0.95, DAY: 1.0 };

const R = 6371000;
function hav(a: [number, number], b: [number, number]) {
  const toR = (d: number) => d * Math.PI / 180;
  const [φ1, λ1] = [toR(a[0]), toR(a[1])], [φ2, λ2] = [toR(b[0]), toR(b[1])];
  const Δ = Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(Δ), Math.sqrt(1 - Δ));
}

// Simple LCG pseudo-random (deterministic per-run, good enough for sim)
let seed = Date.now() % 2147483647;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { operation_id, asset_ids, op_type, objective_lat, objective_lon } = body;
    const terrain   = body.terrain    || "PLAINS";
    const weather   = body.weather    || "CLEAR";
    const timeOfDay = body.time_of_day || body.time || "DAY";
    // Accept both parameter names from frontend
    const hostile   = +(body.hostile_strength ?? body.hostile_count ?? 50);

    const atr   = ATTRITION[op_type] ?? ATTRITION.PATROL;
    const tMul  = TERRAIN_MUL[terrain] ?? 1;
    const wMul  = WEATHER_MUL[weather] ?? 1;
    const timMul = TIME_MUL[timeOfDay] ?? 1;

    // Load assets
    const { data: assets } = await sb
      .from("assets")
      .select("id, callsign, asset_type, icon, crew_count, current_lat, current_lon")
      .in("id", asset_ids ?? []);

    const { data: zones } = await sb
      .from("zones")
      .select("zone_type, center_lat, center_lon, radius_meters")
      .in("zone_type", ["HOSTILE", "CIVILIAN", "MINEFIELD"]);

    // Equipment loss per asset
    let totalEquipLoss = 0, totalCostCrore = 0, totalPersonnel = 0;
    const assetResults = (assets ?? []).map(a => {
      const baseLoss = atr.equip * tMul * wMul;
      const lostProb = Math.min(0.95, baseLoss * (0.7 + rand() * 0.6));
      const cost = ASSET_COST_CRORE[a.asset_type] ?? 1;
      const lost = rand() < lostProb;
      if (lost) { totalEquipLoss++; totalCostCrore += cost; }
      const crew = a.crew_count ?? 1;
      const personnelLost = lost ? Math.round(crew * (atr.personnel * tMul * wMul * (0.5 + rand()))) : 0;
      totalPersonnel += personnelLost;
      return { callsign: a.callsign, asset_type: a.asset_type, icon: a.icon, lost, cost_if_lost: cost, personnel_lost: personnelLost };
    });

    // Civilian collateral
    const civilianZones = (zones ?? []).filter(z => z.zone_type === "CIVILIAN");
    const nearCivilian  = civilianZones.some(z =>
      hav([z.center_lat, z.center_lon], [objective_lat, objective_lon]) < z.radius_meters + 1000
    );
    const civilianRisk = nearCivilian
      ? (op_type === "AIRSTRIKE" ? "HIGH" : op_type === "STRIKE" ? "MEDIUM" : "LOW")
      : "LOW";
    const civilianCasualties = nearCivilian
      ? Math.round(rand() * (op_type === "AIRSTRIKE" ? 80 : 30) * tMul)
      : 0;

    // Success probability (Lanchester-inspired)
    const friendlyCount = (assets ?? []).length;
    const forceMul = friendlyCount / Math.max(hostile, 1);
    const baseSuccess = Math.min(0.95, 0.5 + forceMul * 0.3);
    const successProb = parseFloat((baseSuccess * timMul * (wMul < 1.3 ? 1 : 0.85)).toFixed(3));

    // Risk score
    const totalCrew = (assets ?? []).reduce((s, a) => s + (a.crew_count ?? 1), 0);
    const riskScore = parseFloat(
      Math.min(0.99, (totalPersonnel / Math.max(totalCrew, 1)) * tMul * wMul * 0.8).toFixed(3)
    );

    const intel = {
      force_ratio: parseFloat(forceMul.toFixed(2)),
      terrain_factor: tMul,
      weather_factor: wMul,
      time_factor: timMul,
      hostile_strength: hostile,
      friendly_assets: friendlyCount,
      recommended_action:
        successProb > 0.75 ? "PROCEED" :
        successProb > 0.55 ? "PROCEED WITH CAUTION" :
                             "ABORT - HIGH RISK",
    };

    const simResult = {
      asset_results:       assetResults,
      equipment_lost:      totalEquipLoss,
      total_cost_crore:    parseFloat(totalCostCrore.toFixed(2)),
      military_casualties: totalPersonnel,
      civilian_casualties: civilianCasualties,
      civilian_risk:       civilianRisk,
      success_probability: successProb,
      risk_score:          riskScore,
      terrain, weather,
      time_of_day: timeOfDay,
      intel,
      phases: [
        { phase: 1, name: "Ingress",    status: successProb > 0.4  ? "SUCCESS" : "PARTIAL", duration_min: Math.round(20 + rand() * 40) },
        { phase: 2, name: "Engagement", status: successProb > 0.6  ? "SUCCESS" : "PARTIAL", duration_min: Math.round(30 + rand() * 60) },
        { phase: 3, name: "Objective",  status: successProb > 0.75 ? "SUCCESS" : "FAILURE", duration_min: Math.round(10 + rand() * 30) },
        { phase: 4, name: "Exfil",      status: successProb > 0.55 ? "SUCCESS" : "PARTIAL", duration_min: Math.round(15 + rand() * 25) },
      ],
    };

    // Update operation record if operation_id given
    if (operation_id) {
      await sb.from("operations").update({
        risk_score: riskScore,
        est_casualties: totalPersonnel,
        est_cost_crore: parseFloat(totalCostCrore.toFixed(2)),
        civilian_risk: civilianRisk,
        success_prob: successProb,
        sim_result: simResult,
      }).eq("id", operation_id);
    }

    return new Response(JSON.stringify(simResult), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("simulate error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
