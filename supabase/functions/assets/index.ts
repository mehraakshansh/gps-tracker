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
    const url = new URL(req.url);

    // ── GET /assets ── return all assets with zone-status enrichment
    if (method === "GET") {
      const { data: assets, error } = await supabase
        .from("assets")
        .select("*")
        .order("service", { ascending: true });

      if (error) throw error;

      // If table is empty, auto-seed default assets
      if (!assets || assets.length === 0) {
        await seedDefaultAssets(supabase);
        const { data: seeded } = await supabase.from("assets").select("*");
        return new Response(JSON.stringify(seeded ?? []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load zones for live zone-status computation
      const { data: zones } = await supabase
        .from("zones")
        .select("id, name, zone_type, center_lat, center_lon, radius_meters")
        .or("active.eq.true,is_active.eq.true");

      const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
        return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      };

      // Enrich each asset with zoneStatus array + trail placeholder
      const enriched = assets.map(a => {
        const zoneStatus = (zones ?? []).map(z => {
          if (a.current_lat == null) return null;
          const d = haversine(a.current_lat, a.current_lon, z.center_lat, z.center_lon);
          return {
            zoneId:   z.id,
            zoneName: z.name,
            zoneType: z.zone_type,
            state:    d <= z.radius_meters ? "IN" : "OUT",
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
        await seedDefaultAssets(supabase);
        const { data } = await supabase.from("assets").select("*");
        return new Response(JSON.stringify({ seeded: true, count: data?.length ?? 0 }), {
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
// SEED — Indian Armed Forces ORBAT, 50+ assets spread across ALL commands
// ─────────────────────────────────────────────────────────────────────────────
async function seedDefaultAssets(supabase: ReturnType<typeof createClient>) {
  const r = (v: number, s: number) => v + (Math.random() - 0.5) * 2 * s;
  const assets = [
    // WESTERN COMMAND — Punjab/Chandimandir
    { id:"a0001-01", name:"Arjun Mk2 Alpha",         type:"TANK",         service:"ARMY",          lat:r(30.71,0.3), lon:r(76.88,0.3), fuel:92, ammo:100, threat:"LOW",    status:"ACTIVE"  },
    { id:"a0001-02", name:"T-90 Bhishma Sqdn",        type:"TANK",         service:"ARMY",          lat:r(31.22,0.3), lon:r(75.44,0.3), fuel:78, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0001-03", name:"BMP-2 Sarath APC",          type:"APC",          service:"ARMY",          lat:r(29.80,0.3), lon:r(74.90,0.3), fuel:65, ammo:72,  threat:"LOW",    status:"ACTIVE"  },
    // SW COMMAND — Jaipur / Rajasthan
    { id:"a0002-01", name:"Pinaka MLRS Battery",       type:"ARTILLERY",    service:"ARMY",          lat:r(26.92,0.5), lon:r(75.82,0.5), fuel:82, ammo:60,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0002-02", name:"BrahMos Launcher Bravo",    type:"MISSILE",      service:"ARMY",          lat:r(26.50,0.6), lon:r(73.10,0.8), fuel:95, ammo:80,  threat:"HIGH",   status:"STANDBY" },
    { id:"a0002-03", name:"Nag ATGM Desert Div",       type:"ANTI-TANK",    service:"ARMY",          lat:r(25.40,0.5), lon:r(71.30,0.7), fuel:88, ammo:70,  threat:"LOW",    status:"ACTIVE"  },
    // NORTHERN COMMAND — LOC / Kashmir / Siachen
    { id:"a0003-01", name:"Kashmir LOC Patrol",        type:"INFANTRY",     service:"ARMY",          lat:r(34.10,0.3), lon:r(74.02,0.3), fuel:90, ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0003-02", name:"Siachen Glacier Post",      type:"FOB",          service:"ARMY",          lat:r(35.42,0.2), lon:r(76.92,0.2), fuel:70, ammo:50,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0003-03", name:"Bofors 155mm Arty",         type:"ARTILLERY",    service:"ARMY",          lat:r(34.50,0.3), lon:r(75.50,0.3), fuel:80, ammo:65,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0003-04", name:"LOC Drone Recce",           type:"DRONE",        service:"ARMY",          lat:r(33.90,0.3), lon:r(75.10,0.3), fuel:85, ammo:0,   threat:"MEDIUM", status:"ACTIVE"  },
    // EASTERN COMMAND — Arunachal / Assam
    { id:"a0004-01", name:"17 Mtn Strike Corps",       type:"INFANTRY",     service:"ARMY",          lat:r(27.10,0.5), lon:r(93.62,0.5), fuel:88, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0004-02", name:"Tawang Forward Post",       type:"FOB",          service:"ARMY",          lat:r(27.58,0.2), lon:r(91.88,0.2), fuel:75, ammo:60,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0004-03", name:"Brahmaputra Patrol Bn",     type:"INFANTRY",     service:"ARMY",          lat:r(26.18,0.3), lon:r(91.73,0.3), fuel:80, ammo:75,  threat:"MEDIUM", status:"ACTIVE"  },
    // SOUTHERN COMMAND — Pune
    { id:"a0005-01", name:"1 Armoured Division",       type:"TANK",         service:"ARMY",          lat:r(18.52,0.4), lon:r(73.86,0.4), fuel:92, ammo:95,  threat:"LOW",    status:"STANDBY" },
    { id:"a0005-02", name:"Field Hospital Delta",      type:"SUPPORT",      service:"ARMY",          lat:r(18.00,0.5), lon:r(74.50,0.5), fuel:60, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // CENTRAL COMMAND — Lucknow
    { id:"a0006-01", name:"21 Strike Corps HQ",        type:"COMMAND",      service:"ARMY",          lat:r(26.85,0.2), lon:r(80.95,0.2), fuel:95, ammo:20,  threat:"LOW",    status:"ACTIVE"  },
    { id:"a0006-02", name:"Agra Para Brigade",         type:"INFANTRY",     service:"ARMY",          lat:r(27.18,0.3), lon:r(78.00,0.3), fuel:90, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    // WESTERN AIR COMMAND — Delhi / Hindon
    { id:"a0010-01", name:"Rafale 17 Sqn Alpha",       type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(28.69,0.2), lon:r(77.10,0.2), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-02", name:"Rafale 17 Sqn Bravo",       type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(28.82,0.2), lon:r(76.98,0.2), fuel:88, ammo:95,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-03", name:"Sukhoi-30 MKI Hawk",        type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(30.62,0.3), lon:r(76.78,0.3), fuel:80, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-04", name:"C-17 Globemaster III",      type:"TRANSPORT",    service:"AIR_FORCE",     lat:r(28.56,0.2), lon:r(77.12,0.2), fuel:75, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    { id:"a0010-05", name:"AEW&CS Netra",               type:"AWACS",        service:"AIR_FORCE",     lat:r(28.65,0.3), lon:r(77.27,0.3), fuel:82, ammo:0,   threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0010-06", name:"Apache AH-64E",              type:"HELICOPTER",   service:"AIR_FORCE",     lat:r(29.50,0.3), lon:r(75.90,0.3), fuel:90, ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0010-07", name:"Dhruv ALH Attack Mk4",      type:"HELICOPTER",   service:"AIR_FORCE",     lat:r(28.68,0.2), lon:r(77.20,0.2), fuel:72, ammo:60,  threat:"MEDIUM", status:"ACTIVE"  },
    // SW AIR COMMAND — Gandhinagar
    { id:"a0011-01", name:"Tejas Mk1A — 18 Sqn",      type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(23.02,0.3), lon:r(72.57,0.3), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0011-02", name:"Tejas Mk1A — 45 Sqn",      type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(22.80,0.3), lon:r(72.40,0.3), fuel:88, ammo:95,  threat:"HIGH",   status:"STANDBY" },
    { id:"a0011-03", name:"Jaguar DARIN-III Strike",   type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(24.58,0.4), lon:r(73.69,0.4), fuel:80, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    // EASTERN AIR COMMAND — Shillong
    { id:"a0012-01", name:"Sukhoi-30 MKI Eastern",    type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(25.58,0.3), lon:r(91.88,0.3), fuel:85, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0012-02", name:"Mi-17 Utility Northeast",  type:"HELICOPTER",   service:"AIR_FORCE",     lat:r(26.10,0.3), lon:r(91.60,0.3), fuel:65, ammo:30,  threat:"LOW",    status:"ACTIVE"  },
    { id:"a0012-03", name:"TAPAS MALE UAV East",       type:"DRONE",        service:"AIR_FORCE",     lat:r(27.05,0.5), lon:r(93.45,0.5), fuel:90, ammo:0,   threat:"MEDIUM", status:"ACTIVE"  },
    // SOUTHERN AIR COMMAND — Thiruvananthapuram
    { id:"a0013-01", name:"Sukhoi-30 SAC Bravo",      type:"FIGHTER_JET",  service:"AIR_FORCE",     lat:r(8.48,0.3),  lon:r(76.95,0.3), fuel:88, ammo:90,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0013-02", name:"AN-32 Transport South",    type:"TRANSPORT",    service:"AIR_FORCE",     lat:r(9.99,0.3),  lon:r(76.27,0.3), fuel:72, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // WESTERN NAVAL COMMAND — Mumbai / Arabian Sea
    { id:"a0020-01", name:"INS Vikrant CVN",           type:"CARRIER",      service:"NAVY",          lat:r(18.97,0.5), lon:r(70.50,1.0), fuel:88, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-02", name:"INS Kolkata DDG",           type:"DESTROYER",    service:"NAVY",          lat:r(17.80,0.6), lon:r(69.20,0.8), fuel:82, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-03", name:"INS Shivalik FFG",          type:"FRIGATE",      service:"NAVY",          lat:r(19.20,0.5), lon:r(68.50,0.8), fuel:80, ammo:85,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0020-04", name:"INS Arihant SSBN",          type:"SUBMARINE",    service:"NAVY",          lat:r(16.80,0.8), lon:r(64.20,1.2), fuel:95, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-05", name:"INS Sindhughosh SSK",       type:"SUBMARINE",    service:"NAVY",          lat:r(20.50,0.5), lon:r(66.30,0.8), fuel:70, ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0020-06", name:"P-8I Poseidon West",        type:"PATROL_AIRCRAFT",service:"NAVY",        lat:r(19.10,0.3), lon:r(72.97,0.3), fuel:78, ammo:60,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0020-07", name:"Sea King ASW Heli",         type:"HELICOPTER",   service:"NAVY",          lat:r(18.85,0.2), lon:r(72.82,0.2), fuel:72, ammo:40,  threat:"MEDIUM", status:"ACTIVE"  },
    // EASTERN NAVAL COMMAND — Visakhapatnam / Bay of Bengal
    { id:"a0021-01", name:"INS Vikramaditya CVN",      type:"CARRIER",      service:"NAVY",          lat:r(14.50,0.8), lon:r(83.80,1.2), fuel:85, ammo:100, threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0021-02", name:"INS Ranvijay DDG",          type:"DESTROYER",    service:"NAVY",          lat:r(13.00,0.6), lon:r(82.00,0.8), fuel:80, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0021-03", name:"INS Chakra SSN",            type:"SUBMARINE",    service:"NAVY",          lat:r(12.80,0.8), lon:r(84.50,1.0), fuel:88, ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0021-04", name:"Dornier 228 Bay Patrol",    type:"PATROL_AIRCRAFT",service:"NAVY",        lat:r(17.68,0.3), lon:r(83.22,0.3), fuel:68, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // SOUTHERN NAVAL COMMAND — Kochi
    { id:"a0022-01", name:"INS Suvarna Corvette",      type:"PATROL_VESSEL",service:"NAVY",          lat:r(9.80,0.4),  lon:r(75.50,0.6), fuel:80, ammo:40,  threat:"LOW",    status:"ACTIVE"  },
    // ANDAMAN COMMAND
    { id:"a0023-01", name:"Andaman Joint Patrol",      type:"PATROL_VESSEL",service:"NAVY",          lat:r(11.68,0.3), lon:r(92.73,0.3), fuel:75, ammo:35,  threat:"MEDIUM", status:"ACTIVE"  },
    { id:"a0023-02", name:"AN-32 Andaman Transport",   type:"TRANSPORT",    service:"AIR_FORCE",     lat:r(11.62,0.2), lon:r(92.75,0.2), fuel:82, ammo:0,   threat:"LOW",    status:"ACTIVE"  },
    // SPECIAL FORCES COMMAND — Agra + various AOs
    { id:"a0030-01", name:"Para SF Team GHOST",        type:"PERSONNEL",    service:"SPECIAL_FORCES", lat:r(27.88,0.3), lon:r(77.97,0.3), fuel:100,ammo:95,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0030-02", name:"MARCOS Team KRAKEN",        type:"PERSONNEL",    service:"SPECIAL_FORCES", lat:r(18.92,0.2), lon:r(72.84,0.2), fuel:100,ammo:90,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0030-03", name:"NSG Black Cat Alpha",       type:"PERSONNEL",    service:"SPECIAL_FORCES", lat:r(28.62,0.2), lon:r(77.21,0.2), fuel:100,ammo:100, threat:"HIGH",   status:"STANDBY" },
    { id:"a0030-04", name:"SFF Tiger Div — LOC",      type:"PERSONNEL",    service:"SPECIAL_FORCES", lat:r(34.00,0.4), lon:r(78.50,0.4), fuel:100,ammo:85,  threat:"HIGH",   status:"ACTIVE"  },
    { id:"a0030-05", name:"GHATAK SF — Arunachal",    type:"PERSONNEL",    service:"SPECIAL_FORCES", lat:r(27.50,0.3), lon:r(92.10,0.3), fuel:100,ammo:80,  threat:"HIGH",   status:"ACTIVE"  },
  ];

  const iconMap: Record<string, string> = {
    TANK:"🛡️", APC:"🚛", ARTILLERY:"💥", VEHICLE:"🚙", PERSONNEL:"🪖", SUPPORT:"⛑️",
    FIGHTER_JET:"✈️", HELICOPTER:"🚁", TRANSPORT:"✈️", DRONE:"🛸", AWACS:"✈️",
    CARRIER:"⚓", DESTROYER:"⚓", FRIGATE:"⚓", SUBMARINE:"⚓", PATROL_AIRCRAFT:"✈️",
    PATROL_VESSEL:"⚓", MISSILE:"🚀", "ANTI-TANK":"🪖", FOB:"🏕️", INFANTRY:"🪖",
    COMMAND:"🖥️", "FIGHTER_JET":"✈️",
  };
  const catMap: Record<string, string> = {
    TANK:"ARMOUR", APC:"INFANTRY", ARTILLERY:"ARTILLERY", VEHICLE:"LOGISTICS",
    PERSONNEL:"INFANTRY", SUPPORT:"LOGISTICS", FIGHTER_JET:"AVIATION",
    HELICOPTER:"AVIATION", TRANSPORT:"LOGISTICS", DRONE:"AVIATION", AWACS:"AVIATION",
    CARRIER:"NAVAL", DESTROYER:"NAVAL", FRIGATE:"NAVAL", SUBMARINE:"NAVAL",
    PATROL_AIRCRAFT:"AVIATION", PATROL_VESSEL:"NAVAL",
    MISSILE:"ARTILLERY", "ANTI-TANK":"ARMOUR", FOB:"LOGISTICS",
    INFANTRY:"INFANTRY", COMMAND:"LOGISTICS",
  };
  const callsignCounters: Record<string, number> = {};

  const assetRows = assets.map((a) => {
    callsignCounters[a.type] = (callsignCounters[a.type] ?? 0) + 1;
    const prefix = a.type.replace(/[^A-Z]/g,"").slice(0,4) || "UNIT";
    const cs = `${prefix}-${String(callsignCounters[a.type]).padStart(2,"0")}`;
    return {
      id: a.id,
      name: a.name,
      callsign: cs,
      asset_type: a.type,
      category: catMap[a.type] ?? "LOGISTICS",
      service: a.service,
      icon: iconMap[a.type] ?? "🎯",
      status: a.status,
      current_lat: a.lat,
      current_lon: a.lon,
      fuel_pct: a.fuel,
      ammo_pct: a.ammo,
      threat_level: a.threat,
      speed_kmh: getSpeed(a.type),
      current_heading: Math.floor(Math.random() * 360),
      crew_count: 1,
    };
  });

  const { error } = await supabase.from("assets").upsert(assetRows, { onConflict: "id" });
  if (error) console.error("seed error:", error);

  // Seed patrol routes for each asset
  const wpRows: { asset_id: string; seq: number; lat: number; lon: number }[] = [];
  assetRows.forEach(a => {
    if (a.current_lat == null) return;
    const wps = generateWaypoints(a.current_lat, a.current_lon);
    wps.forEach((wp, seq) => wpRows.push({ asset_id: a.id, seq, lat: wp[0], lon: wp[1] }));
  });
  if (wpRows.length > 0) {
    // Clear old waypoints first, then insert
    const ids = assetRows.map(a => a.id);
    await supabase.from("route_waypoints").delete().in("asset_id", ids);
    await supabase.from("route_waypoints").insert(wpRows);
  }

  // Init simulator state
  const ssRows = assetRows.map(a => ({ asset_id: a.id, step_idx: 0, t_progress: 0 }));
  await supabase.from("simulator_state").upsert(ssRows, { onConflict: "asset_id" });
}

function generateWaypoints(centerLat: number, centerLon: number): [number, number][] {
  const pts: [number, number][] = [];
  const radius = 0.03 + Math.random() * 0.04; // tighter patrol radius
  const steps = 6 + Math.floor(Math.random() * 4);
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
    TANK: 55, APC: 65, ARTILLERY: 40, VEHICLE: 90, PERSONNEL: 8,
    FIGHTER_JET: 1500, HELICOPTER: 280, TRANSPORT: 600, DRONE: 200, AWACS: 600,
    CARRIER: 35, DESTROYER: 55, FRIGATE: 55, SUBMARINE: 40,
    PATROL_AIRCRAFT: 400, PATROL_VESSEL: 45, SUPPORT: 30,
    MISSILE: 200, "ANTI-TANK": 60, FOB: 0, INFANTRY: 12, COMMAND: 20,
  };
  return speeds[type] ?? 50;
}
