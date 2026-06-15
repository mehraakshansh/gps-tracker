import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
    );

    const method = req.method;

    // ── GET /assets ── return all assets with zone-status enrichment
    if (method === "GET") {
      const { data: assets, error } = await supabase
        .from("assets")
        .select("*")
        .order("faction", { ascending: true })
        .order("service",  { ascending: true });

      if (error) throw error;

      if (!assets || assets.length === 0) {
        await seedAllAssets(supabase);
        const { data: seeded } = await supabase.from("assets").select("*");
        return new Response(JSON.stringify(seeded ?? []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: zones } = await supabase
        .from("zones")
        .select("id, name, zone_type, center_lat, center_lon, radius_meters, controlled_by")
        .or("active.eq.true,is_active.eq.true");

      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
        return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      };

      const enriched = assets.map(a => {
        const zoneStatus = (zones ?? []).map(z => {
          if (a.current_lat == null) return null;
          const d = haversine(a.current_lat, a.current_lon, z.center_lat, z.center_lon);
          return {
            zoneId:      z.id,
            zoneName:    z.name,
            zoneType:    z.zone_type,
            controlledBy: z.controlled_by ?? "NEUTRAL",
            state:       d <= z.radius_meters ? "IN" : "OUT",
          };
        }).filter(Boolean);
        return { ...a, zoneStatus, trail: [] };
      });

      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST /assets (body: { action: "seed" }) ── force re-seed
    if (method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.action === "seed") {
        await supabase.from("assets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await seedAllAssets(supabase);
        const { data } = await supabase.from("assets").select("*");
        return new Response(JSON.stringify({ seeded: true, count: data?.length ?? 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── POST { action:"waypoints", asset_id, waypoints:[{lat,lon}] } ──
      // Replace route_waypoints for one asset and reset its simulator_state
      if (body.action === "waypoints") {
        const { asset_id, waypoints } = body;
        if (!asset_id || !Array.isArray(waypoints) || waypoints.length === 0) {
          return new Response(JSON.stringify({ error: "asset_id and waypoints[] required" }), {
            status: 400, headers: corsHeaders,
          });
        }
        // Verify asset exists
        const { data: assetRow, error: ae } = await supabase
          .from("assets").select("id, faction").eq("id", asset_id).single();
        if (ae || !assetRow) {
          return new Response(JSON.stringify({ error: "asset not found" }), {
            status: 404, headers: corsHeaders,
          });
        }
        // Delete old waypoints
        await supabase.from("route_waypoints").delete().eq("asset_id", asset_id);
        // Insert new ones
        const rows = waypoints.map((wp: { lat: number; lon: number }, i: number) => ({
          asset_id,
          seq: i,
          lat: wp.lat,
          lon: wp.lon,
        }));
        const { error: we } = await supabase.from("route_waypoints").insert(rows);
        if (we) throw we;
        // Reset sim state so asset starts from waypoint 0
        await supabase.from("simulator_state").upsert(
          { asset_id, step_idx: 0, updated_at: new Date().toISOString() },
          { onConflict: "asset_id" }
        );
        return new Response(JSON.stringify({ ok: true, asset_id, waypoints: rows.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("assets fn error:", msg, err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT STATS — per asset type
// ─────────────────────────────────────────────────────────────────────────────
const COMBAT_STATS: Record<string, { hp: number; attack: number; range_km: number; detect_km: number }> = {
  TANK:            { hp: 150, attack: 35,  range_km: 3,   detect_km: 15  },
  APC:             { hp: 80,  attack: 20,  range_km: 2,   detect_km: 10  },
  ARTILLERY:       { hp: 60,  attack: 55,  range_km: 25,  detect_km: 20  },
  SPH:             { hp: 80,  attack: 50,  range_km: 20,  detect_km: 15  },
  MLRS:            { hp: 60,  attack: 65,  range_km: 40,  detect_km: 20  },
  FIGHTER_JET:     { hp: 100, attack: 45,  range_km: 150, detect_km: 200 },
  HELICOPTER:      { hp: 80,  attack: 30,  range_km: 8,   detect_km: 50  },
  DRONE:           { hp: 30,  attack: 15,  range_km: 30,  detect_km: 80  },
  AWACS:           { hp: 80,  attack: 0,   range_km: 0,   detect_km: 400 },
  TRANSPORT:       { hp: 50,  attack: 0,   range_km: 0,   detect_km: 30  },
  CARRIER:         { hp: 300, attack: 60,  range_km: 200, detect_km: 300 },
  DESTROYER:       { hp: 200, attack: 55,  range_km: 80,  detect_km: 150 },
  FRIGATE:         { hp: 150, attack: 40,  range_km: 60,  detect_km: 100 },
  SUBMARINE:       { hp: 120, attack: 50,  range_km: 40,  detect_km: 60  },
  PATROL_AIRCRAFT: { hp: 60,  attack: 20,  range_km: 100, detect_km: 150 },
  PATROL_VESSEL:   { hp: 80,  attack: 25,  range_km: 20,  detect_km: 40  },
  MISSILE:         { hp: 20,  attack: 80,  range_km: 500, detect_km: 0   },
  PERSONNEL:       { hp: 40,  attack: 15,  range_km: 1,   detect_km: 5   },
  INFANTRY:        { hp: 50,  attack: 20,  range_km: 2,   detect_km: 8   },
  "ANTI-TANK":     { hp: 50,  attack: 40,  range_km: 5,   detect_km: 10  },
  FOB:             { hp: 200, attack: 20,  range_km: 10,  detect_km: 30  },
  SUPPORT:         { hp: 30,  attack: 0,   range_km: 0,   detect_km: 5   },
  COMMAND:         { hp: 100, attack: 5,   range_km: 0,   detect_km: 50  },
};

function combatStats(type: string) {
  return COMBAT_STATS[type] ?? { hp: 80, attack: 10, range_km: 5, detect_km: 15 };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED — Bravo (India) + Alpha (enemy) armies
// ─────────────────────────────────────────────────────────────────────────────
async function seedAllAssets(supabase: ReturnType<typeof createClient>) {
  const r = (v: number, s: number) => v + (Math.random() - 0.5) * 2 * s;

  // ── BRAVO ARMY (India) ────────────────────────────────────────────────────
  const bravoAssets = [
    // WESTERN COMMAND — Punjab/Chandimandir
    { id:"a0001-01", name:"Arjun Mk2 Alpha",        type:"TANK",          service:"ARMY",           lat:r(30.71,0.3), lon:r(76.88,0.3), fuel:92, ammo:100, threat:"LOW",    status:"ACTIVE"  },
    { id:"a0001-02", name:"T-90 Bhishma Sqdn",       type:"TANK",          service:"ARMY",           lat:r(31.22,0.3), lon:r(75.44,0.3), fuel:78, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0001-03", name:"BMP-2 Sarath APC",         type:"APC",           service:"ARMY",           lat:r(29.80,0.3), lon:r(74.90,0.3), fuel:65, ammo:72,  threat:"LOW",    status:"ACTIVE"  },
    // SW COMMAND — Rajasthan
    { id:"a0002-01", name:"Pinaka MLRS Battery",      type:"ARTILLERY",     service:"ARMY",           lat:r(26.92,0.5), lon:r(75.82,0.5), fuel:82, ammo:60,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0002-02", name:"BrahMos Launcher Bravo",   type:"MISSILE",       service:"ARMY",           lat:r(26.50,0.6), lon:r(73.10,0.8), fuel:95, ammo:80,  threat:"HIGH",   status:"STANDBY" },
    { id:"a0002-03", name:"Nag ATGM Desert Div",      type:"ANTI-TANK",     service:"ARMY",           lat:r(25.40,0.5), lon:r(71.30,0.7), fuel:88, ammo:70,  threat:"LOW",    status:"ACTIVE"  },
    // NORTHERN COMMAND — LOC / Kashmir / Siachen
    { id:"a0003-01", name:"Kashmir LOC Patrol",       type:"INFANTRY",      service:"ARMY",           lat:r(34.10,0.3), lon:r(74.02,0.3), fuel:90, ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0003-02", name:"Siachen Glacier Post",     type:"FOB",           service:"ARMY",           lat:r(35.42,0.2), lon:r(76.92,0.2), fuel:70, ammo:50,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0003-03", name:"Bofors 155mm Arty",        type:"ARTILLERY",     service:"ARMY",           lat:r(34.50,0.3), lon:r(75.50,0.3), fuel:80, ammo:65,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0003-04", name:"LOC Drone Recce",          type:"DRONE",         service:"ARMY",           lat:r(33.90,0.3), lon:r(75.10,0.3), fuel:85, ammo:0,   threat:"MEDIUM", status:"ACTIVE"  },
    // EASTERN COMMAND — Arunachal / Assam
    { id:"a0004-01", name:"17 Mtn Strike Corps",      type:"INFANTRY",      service:"ARMY",           lat:r(27.10,0.5), lon:r(93.62,0.5), fuel:88, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0004-02", name:"Tawang Forward Post",      type:"FOB",           service:"ARMY",           lat:r(27.58,0.2), lon:r(91.88,0.2), fuel:75, ammo:60,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0004-03", name:"Brahmaputra Patrol Bn",    type:"INFANTRY",      service:"ARMY",           lat:r(26.18,0.3), lon:r(91.73,0.3), fuel:80, ammo:75,  threat:"MEDIUM", status:"ACTIVE"  },
    // SOUTHERN COMMAND — Pune
    { id:"a0005-01", name:"1 Armoured Division",      type:"TANK",          service:"ARMY",           lat:r(18.52,0.4), lon:r(73.86,0.4), fuel:92, ammo:95,  threat:"LOW",    status:"STANDBY" },
    { id:"a0005-02", name:"Field Hospital Delta",     type:"SUPPORT",       service:"ARMY",           lat:r(18.00,0.5), lon:r(74.50,0.5), fuel:60, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // CENTRAL COMMAND — Lucknow
    { id:"a0006-01", name:"21 Strike Corps HQ",       type:"COMMAND",       service:"ARMY",           lat:r(26.85,0.2), lon:r(80.95,0.2), fuel:95, ammo:20,  threat:"LOW",    status:"ACTIVE"  },
    { id:"a0006-02", name:"Agra Para Brigade",        type:"INFANTRY",      service:"ARMY",           lat:r(27.18,0.3), lon:r(78.00,0.3), fuel:90, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    // WESTERN AIR COMMAND — Delhi / Hindon
    { id:"a0010-01", name:"Rafale 17 Sqn Alpha",      type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(28.69,0.2), lon:r(77.10,0.2), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-02", name:"Rafale 17 Sqn Bravo",      type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(28.82,0.2), lon:r(76.98,0.2), fuel:88, ammo:95,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-03", name:"Sukhoi-30 MKI Hawk",       type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(30.62,0.3), lon:r(76.78,0.3), fuel:80, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-04", name:"C-17 Globemaster III",     type:"TRANSPORT",     service:"AIR_FORCE",      lat:r(28.56,0.2), lon:r(77.12,0.2), fuel:75, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    { id:"a0010-05", name:"AEW&CS Netra",              type:"AWACS",         service:"AIR_FORCE",      lat:r(28.65,0.3), lon:r(77.27,0.3), fuel:82, ammo:0,   threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0010-06", name:"Apache AH-64E",             type:"HELICOPTER",    service:"AIR_FORCE",      lat:r(29.50,0.3), lon:r(75.90,0.3), fuel:90, ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-07", name:"Dhruv ALH Attack Mk4",     type:"HELICOPTER",    service:"AIR_FORCE",      lat:r(28.68,0.2), lon:r(77.20,0.2), fuel:72, ammo:60,  threat:"MEDIUM", status:"ACTIVE"  },
    // SW AIR COMMAND — Gandhinagar
    { id:"a0011-01", name:"Tejas Mk1A — 18 Sqn",     type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(23.02,0.3), lon:r(72.57,0.3), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0011-02", name:"Tejas Mk1A — 45 Sqn",     type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(22.80,0.3), lon:r(72.40,0.3), fuel:88, ammo:95,  threat:"HIGH",   status:"STANDBY" },
    { id:"a0011-03", name:"Jaguar DARIN-III Strike",  type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(24.58,0.4), lon:r(73.69,0.4), fuel:80, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    // EASTERN AIR COMMAND — Shillong
    { id:"a0012-01", name:"Sukhoi-30 MKI Eastern",   type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(25.58,0.3), lon:r(91.88,0.3), fuel:85, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0012-02", name:"Mi-17 Utility Northeast",  type:"HELICOPTER",    service:"AIR_FORCE",      lat:r(26.10,0.3), lon:r(91.60,0.3), fuel:65, ammo:30,  threat:"LOW",    status:"ACTIVE"  },
    { id:"a0012-03", name:"TAPAS MALE UAV East",      type:"DRONE",         service:"AIR_FORCE",      lat:r(27.05,0.5), lon:r(93.45,0.5), fuel:90, ammo:0,   threat:"MEDIUM", status:"ACTIVE"  },
    // SOUTHERN AIR COMMAND — Thiruvananthapuram
    { id:"a0013-01", name:"Sukhoi-30 SAC Bravo",     type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(8.48,0.3),  lon:r(76.95,0.3), fuel:88, ammo:90,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0013-02", name:"AN-32 Transport South",   type:"TRANSPORT",     service:"AIR_FORCE",      lat:r(9.99,0.3),  lon:r(76.27,0.3), fuel:72, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // WESTERN NAVAL COMMAND — Mumbai / Arabian Sea
    { id:"a0020-01", name:"INS Vikrant CVN",          type:"CARRIER",       service:"NAVY",           lat:r(18.97,0.5), lon:r(70.50,1.0), fuel:88, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-02", name:"INS Kolkata DDG",          type:"DESTROYER",     service:"NAVY",           lat:r(17.80,0.6), lon:r(69.20,0.8), fuel:82, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-03", name:"INS Shivalik FFG",         type:"FRIGATE",       service:"NAVY",           lat:r(19.20,0.5), lon:r(68.50,0.8), fuel:80, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0020-04", name:"INS Arihant SSBN",         type:"SUBMARINE",     service:"NAVY",           lat:r(16.80,0.8), lon:r(64.20,1.2), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-05", name:"INS Sindhughosh SSK",      type:"SUBMARINE",     service:"NAVY",           lat:r(20.50,0.5), lon:r(66.30,0.8), fuel:70, ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-06", name:"P-8I Poseidon West",       type:"PATROL_AIRCRAFT",service:"NAVY",          lat:r(19.10,0.3), lon:r(72.97,0.3), fuel:78, ammo:60,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0020-07", name:"Sea King ASW Heli",        type:"HELICOPTER",    service:"NAVY",           lat:r(18.85,0.2), lon:r(72.82,0.2), fuel:72, ammo:40,  threat:"MEDIUM", status:"ACTIVE"  },
    // EASTERN NAVAL COMMAND — Visakhapatnam
    { id:"a0021-01", name:"INS Vikramaditya CVN",     type:"CARRIER",       service:"NAVY",           lat:r(14.50,0.8), lon:r(83.80,1.2), fuel:85, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0021-02", name:"INS Ranvijay DDG",         type:"DESTROYER",     service:"NAVY",           lat:r(13.00,0.6), lon:r(82.00,0.8), fuel:80, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0021-03", name:"INS Chakra SSN",           type:"SUBMARINE",     service:"NAVY",           lat:r(12.80,0.8), lon:r(84.50,1.0), fuel:88, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0021-04", name:"Dornier 228 Bay Patrol",   type:"PATROL_AIRCRAFT",service:"NAVY",          lat:r(17.68,0.3), lon:r(83.22,0.3), fuel:68, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // SOUTHERN NAVAL COMMAND — Kochi
    { id:"a0022-01", name:"INS Suvarna Corvette",     type:"PATROL_VESSEL", service:"NAVY",           lat:r(9.80,0.4),  lon:r(75.50,0.6), fuel:80, ammo:40,  threat:"LOW",    status:"ACTIVE"  },
    // ANDAMAN COMMAND
    { id:"a0023-01", name:"Andaman Joint Patrol",     type:"PATROL_VESSEL", service:"NAVY",           lat:r(11.68,0.3), lon:r(92.73,0.3), fuel:75, ammo:35,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0023-02", name:"AN-32 Andaman Transport",  type:"TRANSPORT",     service:"AIR_FORCE",      lat:r(11.62,0.2), lon:r(92.75,0.2), fuel:82, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // SPECIAL FORCES COMMAND
    { id:"a0030-01", name:"Para SF Team GHOST",       type:"PERSONNEL",     service:"SPECIAL_FORCES", lat:r(27.88,0.3), lon:r(77.97,0.3), fuel:100,ammo:95,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0030-02", name:"MARCOS Team KRAKEN",       type:"PERSONNEL",     service:"SPECIAL_FORCES", lat:r(18.92,0.2), lon:r(72.84,0.2), fuel:100,ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0030-03", name:"NSG Black Cat Alpha",      type:"PERSONNEL",     service:"SPECIAL_FORCES", lat:r(28.62,0.2), lon:r(77.21,0.2), fuel:100,ammo:100, threat:"HIGH",   status:"STANDBY" },
    { id:"a0030-04", name:"SFF Tiger Div — LOC",     type:"PERSONNEL",     service:"SPECIAL_FORCES", lat:r(34.00,0.4), lon:r(78.50,0.4), fuel:100,ammo:85,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0030-05", name:"GHATAK SF — Arunachal",   type:"PERSONNEL",     service:"SPECIAL_FORCES", lat:r(27.50,0.3), lon:r(92.10,0.3), fuel:100,ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
  ];

  // ── ALPHA ARMY (Enemy — Western + Northern + Naval) ───────────────────────
  // Western Front: lat 25-33, lon 63-73 (Pakistan side)
  // Northern Front: lat 32-40, lon 78-97 (China side)
  // Naval: Arabian Sea west, Bay of Bengal east
  const alphaAssets = [
    // WESTERN FRONT (Pakistan-adjacent)
    { id:"b0001-01", name:"Al-Khalid MBT Sqdn A",    type:"TANK",          service:"ARMY",           lat:r(30.20,0.3), lon:r(70.10,0.3), fuel:90, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0001-02", name:"Al-Khalid MBT Sqdn B",    type:"TANK",          service:"ARMY",           lat:r(31.80,0.3), lon:r(71.50,0.3), fuel:82, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0001-03", name:"APC Type-85 Infantry",    type:"APC",           service:"ARMY",           lat:r(28.50,0.3), lon:r(70.80,0.3), fuel:75, ammo:80,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"b0001-04", name:"JF-17 Thunder Sqn A",     type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(29.00,0.3), lon:r(69.50,0.3), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0001-05", name:"JF-17 Thunder Sqn B",     type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(27.50,0.3), lon:r(68.50,0.3), fuel:88, ammo:95,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0001-06", name:"F-16 Block 52 Falcon",    type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(32.00,0.3), lon:r(73.00,0.3), fuel:92, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0001-07", name:"BM-21 Grad MLRS",         type:"ARTILLERY",     service:"ARMY",           lat:r(26.80,0.4), lon:r(72.00,0.4), fuel:80, ammo:75,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0001-08", name:"M198 Howitzer Battery",   type:"ARTILLERY",     service:"ARMY",           lat:r(30.80,0.3), lon:r(71.20,0.3), fuel:75, ammo:70,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"b0001-09", name:"AH-1Z Viper Attack Heli", type:"HELICOPTER",    service:"AIR_FORCE",      lat:r(28.90,0.3), lon:r(70.50,0.3), fuel:90, ammo:85,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0001-10", name:"SSG Commandos — LOC",     type:"PERSONNEL",     service:"SPECIAL_FORCES", lat:r(33.00,0.3), lon:r(74.50,0.3), fuel:100,ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    // NORTHERN FRONT (China-adjacent — Aksai Chin / Tibet / Arunachal)
    { id:"b0002-01", name:"Type 99A MBT — Group A",  type:"TANK",          service:"ARMY",           lat:r(33.50,0.3), lon:r(79.50,0.3), fuel:92, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0002-02", name:"Type 96B MBT — Group B",  type:"TANK",          service:"ARMY",           lat:r(35.50,0.3), lon:r(80.00,0.3), fuel:85, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0002-03", name:"ZBD-04A IFV Platoon",     type:"APC",           service:"ARMY",           lat:r(34.00,0.3), lon:r(78.50,0.3), fuel:78, ammo:80,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"b0002-04", name:"J-20 Stealth Fighter",    type:"FIGHTER_JET",   service:"AIR_FORCE",      lat:r(36.00,0.4), lon:r(81.00,0.4), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0002-05", name:"J-16 Strike Fighter East", type:"FIGHTER_JET",  service:"AIR_FORCE",      lat:r(38.00,0.4), lon:r(95.00,0.5), fuel:90, ammo:95,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0002-06", name:"WZ-10 Attack Helicopter", type:"HELICOPTER",    service:"AIR_FORCE",      lat:r(34.50,0.3), lon:r(79.00,0.3), fuel:88, ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0002-07", name:"PHL-03 MLRS Battery",     type:"ARTILLERY",     service:"ARMY",           lat:r(33.80,0.3), lon:r(80.50,0.3), fuel:82, ammo:75,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0002-08", name:"PCL-181 SPH Eastern",     type:"ARTILLERY",     service:"ARMY",           lat:r(29.50,0.4), lon:r(96.00,0.5), fuel:78, ammo:70,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0002-09", name:"CH-5 Rainbow UAV North",  type:"DRONE",         service:"AIR_FORCE",      lat:r(35.00,0.5), lon:r(82.00,0.5), fuel:90, ammo:40,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"b0002-10", name:"GJ-11 Stealth UAV East",  type:"DRONE",         service:"AIR_FORCE",      lat:r(28.50,0.4), lon:r(94.00,0.5), fuel:88, ammo:30,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"b0002-11", name:"PLA SF Snow Leopards",    type:"PERSONNEL",     service:"SPECIAL_FORCES", lat:r(33.70,0.3), lon:r(78.80,0.3), fuel:100,ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    // ALPHA NAVAL
    { id:"b0003-01", name:"PNS Tughril FFG",         type:"FRIGATE",       service:"NAVY",           lat:r(18.00,0.6), lon:r(62.00,0.8), fuel:85, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0003-02", name:"PNS Hamza SSK",           type:"SUBMARINE",     service:"NAVY",           lat:r(20.50,0.5), lon:r(60.00,0.8), fuel:80, ammo:85,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0003-03", name:"PLAN Type-055 Destroyer", type:"DESTROYER",     service:"NAVY",           lat:r(10.00,0.8), lon:r(88.00,1.0), fuel:88, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"b0003-04", name:"PLAN Type-039 Submarine", type:"SUBMARINE",     service:"NAVY",           lat:r(8.50,0.6),  lon:r(90.00,0.8), fuel:85, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
  ];

  const iconMap: Record<string, string> = {
    TANK:"🛡️", APC:"🚛", ARTILLERY:"💥", VEHICLE:"🚙", PERSONNEL:"🪖", SUPPORT:"⛑️",
    FIGHTER_JET:"✈️", HELICOPTER:"🚁", TRANSPORT:"✈️", DRONE:"🛸", AWACS:"✈️",
    CARRIER:"⚓", DESTROYER:"⚓", FRIGATE:"⚓", SUBMARINE:"⚓", PATROL_AIRCRAFT:"✈️",
    PATROL_VESSEL:"⚓", MISSILE:"🚀", "ANTI-TANK":"🪖", FOB:"🏕️", INFANTRY:"🪖",
    COMMAND:"🖥️", SPH:"💥", MLRS:"💥",
  };
  const catMap: Record<string, string> = {
    TANK:"ARMOUR", APC:"INFANTRY", ARTILLERY:"ARTILLERY", SPH:"ARTILLERY", MLRS:"ARTILLERY",
    VEHICLE:"LOGISTICS", PERSONNEL:"INFANTRY", SUPPORT:"LOGISTICS",
    FIGHTER_JET:"AVIATION", HELICOPTER:"AVIATION", TRANSPORT:"LOGISTICS",
    DRONE:"AVIATION", AWACS:"AVIATION", CARRIER:"NAVAL", DESTROYER:"NAVAL",
    FRIGATE:"NAVAL", SUBMARINE:"NAVAL", PATROL_AIRCRAFT:"AVIATION",
    PATROL_VESSEL:"NAVAL", MISSILE:"ARTILLERY", "ANTI-TANK":"ARMOUR",
    FOB:"LOGISTICS", INFANTRY:"INFANTRY", COMMAND:"LOGISTICS",
  };

  function buildRows(list: typeof bravoAssets, faction: string) {
    const counters: Record<string, number> = {};
    return list.map((a) => {
      counters[a.type] = (counters[a.type] ?? 0) + 1;
      const prefix = (faction === "BRAVO" ? "B" : "A") + a.type.replace(/[^A-Z]/g,"").slice(0,3);
      const cs = `${prefix}-${String(counters[a.type]).padStart(2,"0")}`;
      const stats = combatStats(a.type);
      return {
        id:           a.id,
        name:         a.name,
        callsign:     cs,
        asset_type:   a.type,
        category:     catMap[a.type] ?? "LOGISTICS",
        service:      a.service,
        icon:         iconMap[a.type] ?? "🎯",
        status:       a.status,
        current_lat:  a.lat,
        current_lon:  a.lon,
        fuel_pct:     a.fuel,
        ammo_pct:     a.ammo,
        threat_level: a.threat,
        speed_kmh:    getSpeed(a.type),
        current_heading: Math.floor(Math.random() * 360),
        crew_count:   1,
        faction,
        hp:           stats.hp,
        max_hp:       stats.hp,
        attack_power: stats.attack,
        range_km:     stats.range_km,
        detection_radius_km: stats.detect_km,
        is_destroyed: false,
      };
    });
  }

  const bravoRows = buildRows(bravoAssets, "BRAVO");
  const alphaRows = buildRows(alphaAssets, "ALPHA");
  const allRows   = [...bravoRows, ...alphaRows];

  const { error } = await supabase.from("assets").upsert(allRows, { onConflict: "id" });
  if (error) console.error("seed error:", error);

  // Seed patrol routes for every asset
  const wpRows: { asset_id: string; seq: number; lat: number; lon: number }[] = [];
  allRows.forEach(a => {
    if (a.current_lat == null) return;
    const wps = generateWaypoints(a.current_lat, a.current_lon);
    wps.forEach((wp, seq) => wpRows.push({ asset_id: a.id, seq, lat: wp[0], lon: wp[1] }));
  });
  if (wpRows.length > 0) {
    const ids = allRows.map(a => a.id);
    await supabase.from("route_waypoints").delete().in("asset_id", ids);
    await supabase.from("route_waypoints").insert(wpRows);
  }

  // Init simulator state
  const ssRows = allRows.map(a => ({ asset_id: a.id, step_idx: 0, t_progress: 0 }));
  await supabase.from("simulator_state").upsert(ssRows, { onConflict: "asset_id" });

  // Reset match state
  await supabase.from("match_state").upsert({
    id: 1, status: "ACTIVE",
    bravo_score: 0, alpha_score: 0,
    bravo_assets_destroyed: 0, alpha_assets_destroyed: 0,
    zones_controlled_bravo: 0, zones_controlled_alpha: 0,
    started_at: new Date().toISOString(), ended_at: null,
  }, { onConflict: "id" });
}

function generateWaypoints(centerLat: number, centerLon: number): [number, number][] {
  const pts: [number, number][] = [];
  const radius = 0.03 + Math.random() * 0.04;
  const steps  = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps + (Math.random() - 0.5) * 0.4;
    pts.push([
      centerLat + radius * Math.sin(angle),
      centerLon + radius * Math.cos(angle),
    ]);
  }
  return pts;
}

function getSpeed(type: string): number {
  const speeds: Record<string, number> = {
    TANK: 55, APC: 65, ARTILLERY: 40, SPH: 45, MLRS: 40,
    VEHICLE: 90, PERSONNEL: 8, FIGHTER_JET: 1500, HELICOPTER: 280,
    TRANSPORT: 600, DRONE: 200, AWACS: 600,
    CARRIER: 35, DESTROYER: 55, FRIGATE: 55, SUBMARINE: 40,
    PATROL_AIRCRAFT: 400, PATROL_VESSEL: 45, SUPPORT: 30,
    MISSILE: 200, "ANTI-TANK": 60, FOB: 0, INFANTRY: 12, COMMAND: 20,
  };
  return speeds[type] ?? 50;
}
