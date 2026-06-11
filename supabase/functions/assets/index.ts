import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
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
  } catch (err) {
    console.error("assets fn error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED — Indian Armed Forces ORBAT-inspired, 40 assets across 5 services
// All lat/lon centred around Delhi NCR / Rajasthan training area
// ─────────────────────────────────────────────────────────────────────────────
async function seedDefaultAssets(supabase: ReturnType<typeof createClient>) {
  const assets = [
    // ── ARMY ────────────────────────────────────────────────────────────────
    { id: "a0000001-0000-0000-0000-000000000001", name: "T-90S Bhishma Alpha",  type: "TANK",       service: "ARMY",        battalion: "61 CAV",   status: "ACTIVE",   lat: 28.61, lon: 77.21, fuel: 92, ammo: 100, threat: "LOW"    },
    { id: "a0000001-0000-0000-0000-000000000002", name: "T-90S Bhishma Bravo",  type: "TANK",       service: "ARMY",        battalion: "61 CAV",   status: "ACTIVE",   lat: 28.63, lon: 77.18, fuel: 78, ammo: 85,  threat: "LOW"    },
    { id: "a0000001-0000-0000-0000-000000000003", name: "Arjun MK-2 Alpha",     type: "TANK",       service: "ARMY",        battalion: "43 ARM",   status: "ACTIVE",   lat: 28.58, lon: 77.25, fuel: 88, ammo: 95,  threat: "MEDIUM" },
    { id: "a0000001-0000-0000-0000-000000000004", name: "Arjun MK-2 Bravo",     type: "TANK",       service: "ARMY",        battalion: "43 ARM",   status: "STANDBY",  lat: 28.55, lon: 77.30, fuel: 100,ammo: 100, threat: "LOW"    },
    { id: "a0000001-0000-0000-0000-000000000005", name: "BMP-2 Sarath A1",      type: "APC",        service: "ARMY",        battalion: "12 MECH",  status: "ACTIVE",   lat: 28.70, lon: 77.10, fuel: 65, ammo: 72,  threat: "LOW"    },
    { id: "a0000001-0000-0000-0000-000000000006", name: "BMP-2 Sarath A2",      type: "APC",        service: "ARMY",        battalion: "12 MECH",  status: "ACTIVE",   lat: 28.72, lon: 77.08, fuel: 70, ammo: 68,  threat: "LOW"    },
    { id: "a0000001-0000-0000-0000-000000000007", name: "Pinaka MLRS Bravo",    type: "ARTILLERY",  service: "ARMY",        battalion: "402 MSL",  status: "ACTIVE",   lat: 28.50, lon: 77.35, fuel: 82, ammo: 60,  threat: "MEDIUM" },
    { id: "a0000001-0000-0000-0000-000000000008", name: "K9 Vajra Thunder",     type: "ARTILLERY",  service: "ARMY",        battalion: "402 MSL",  status: "ACTIVE",   lat: 28.48, lon: 77.38, fuel: 74, ammo: 55,  threat: "MEDIUM" },
    { id: "a0000001-0000-0000-0000-000000000009", name: "TATA LSV Recon 1",     type: "VEHICLE",    service: "ARMY",        battalion: "11 PARA",  status: "ACTIVE",   lat: 28.67, lon: 77.14, fuel: 90, ammo: 40,  threat: "LOW"    },
    { id: "a0000001-0000-0000-0000-000000000010", name: "TATA LSV Recon 2",     type: "VEHICLE",    service: "ARMY",        battalion: "11 PARA",  status: "ACTIVE",   lat: 28.65, lon: 77.16, fuel: 85, ammo: 38,  threat: "LOW"    },
    { id: "a0000001-0000-0000-0000-000000000011", name: "Para SF Team Alpha",   type: "PERSONNEL",  service: "ARMY",        battalion: "1 PARA SF",status: "ACTIVE",   lat: 28.60, lon: 77.22, fuel: 100,ammo: 80,  threat: "HIGH"   },
    { id: "a0000001-0000-0000-0000-000000000012", name: "Para SF Team Bravo",   type: "PERSONNEL",  service: "ARMY",        battalion: "9 PARA SF",status: "ACTIVE",   lat: 28.62, lon: 77.19, fuel: 100,ammo: 75,  threat: "HIGH"   },
    { id: "a0000001-0000-0000-0000-000000000013", name: "Ghatak Platoon 3",     type: "PERSONNEL",  service: "ARMY",        battalion: "22 GUARD", status: "ACTIVE",   lat: 28.56, lon: 77.28, fuel: 100,ammo: 90,  threat: "MEDIUM" },
    { id: "a0000001-0000-0000-0000-000000000014", name: "Field Hospital Bravo", type: "SUPPORT",    service: "ARMY",        battalion: "MEDICAL",  status: "ACTIVE",   lat: 28.75, lon: 77.05, fuel: 55, ammo: 0,   threat: "LOW"    },

    // ── AIR FORCE ────────────────────────────────────────────────────────────
    { id: "a0000002-0000-0000-0000-000000000001", name: "Rafale RB-001",        type: "FIGHTER_JET", service: "AIR_FORCE",  battalion: "17 SQN",   status: "ACTIVE",   lat: 28.80, lon: 77.00, fuel: 95, ammo: 100, threat: "HIGH"   },
    { id: "a0000002-0000-0000-0000-000000000002", name: "Rafale RB-002",        type: "FIGHTER_JET", service: "AIR_FORCE",  battalion: "17 SQN",   status: "ACTIVE",   lat: 28.82, lon: 76.98, fuel: 88, ammo: 95,  threat: "HIGH"   },
    { id: "a0000002-0000-0000-0000-000000000003", name: "Su-30 MKI Eagle",      type: "FIGHTER_JET", service: "AIR_FORCE",  battalion: "30 SQN",   status: "ACTIVE",   lat: 28.78, lon: 77.02, fuel: 80, ammo: 90,  threat: "HIGH"   },
    { id: "a0000002-0000-0000-0000-000000000004", name: "Tejas MK1A Fox",       type: "FIGHTER_JET", service: "AIR_FORCE",  battalion: "45 SQN",   status: "STANDBY",  lat: 28.76, lon: 77.04, fuel: 100,ammo: 100, threat: "MEDIUM" },
    { id: "a0000002-0000-0000-0000-000000000005", name: "HAL Dhruv ALH-01",     type: "HELICOPTER",  service: "AIR_FORCE",  battalion: "114 HU",   status: "ACTIVE",   lat: 28.68, lon: 77.12, fuel: 72, ammo: 50,  threat: "MEDIUM" },
    { id: "a0000002-0000-0000-0000-000000000006", name: "HAL Dhruv ALH-02",     type: "HELICOPTER",  service: "AIR_FORCE",  battalion: "114 HU",   status: "ACTIVE",   lat: 28.66, lon: 77.15, fuel: 68, ammo: 45,  threat: "MEDIUM" },
    { id: "a0000002-0000-0000-0000-000000000007", name: "Mi-17 V5 Condor",      type: "HELICOPTER",  service: "AIR_FORCE",  battalion: "152 HU",   status: "ACTIVE",   lat: 28.64, lon: 77.17, fuel: 60, ammo: 30,  threat: "LOW"    },
    { id: "a0000002-0000-0000-0000-000000000008", name: "C-130J Hercules",      type: "TRANSPORT",   service: "AIR_FORCE",  battalion: "77 SQN",   status: "ACTIVE",   lat: 28.85, lon: 76.95, fuel: 75, ammo: 0,   threat: "LOW"    },
    { id: "a0000002-0000-0000-0000-000000000009", name: "DRDO Rustom-2 UAV",    type: "DRONE",       service: "AIR_FORCE",  battalion: "UAV SQN",  status: "ACTIVE",   lat: 28.71, lon: 77.09, fuel: 85, ammo: 60,  threat: "MEDIUM" },

    // ── NAVY ─────────────────────────────────────────────────────────────────
    { id: "a0000003-0000-0000-0000-000000000001", name: "INS Vikramaditya",     type: "CARRIER",     service: "NAVY",        battalion: "WEST FLT", status: "ACTIVE",   lat: 18.90, lon: 72.85, fuel: 88, ammo: 100, threat: "HIGH"   },
    { id: "a0000003-0000-0000-0000-000000000002", name: "INS Visakhapatnam",    type: "DESTROYER",   service: "NAVY",        battalion: "EAST FLT", status: "ACTIVE",   lat: 17.70, lon: 83.30, fuel: 82, ammo: 90,  threat: "HIGH"   },
    { id: "a0000003-0000-0000-0000-000000000003", name: "INS Sindhuraj SSK",    type: "SUBMARINE",   service: "NAVY",        battalion: "SUB FLT",  status: "ACTIVE",   lat: 18.50, lon: 72.50, fuel: 70, ammo: 80,  threat: "HIGH"   },
    { id: "a0000003-0000-0000-0000-000000000004", name: "P-8I Poseidon",        type: "PATROL_AIRCRAFT",service:"NAVY",       battalion: "312 SQN",  status: "ACTIVE",   lat: 15.40, lon: 74.00, fuel: 78, ammo: 60,  threat: "MEDIUM" },

    // ── COAST GUARD ──────────────────────────────────────────────────────────
    { id: "a0000004-0000-0000-0000-000000000001", name: "ICGS Shaurya",         type: "PATROL_VESSEL",service:"COAST_GUARD",  battalion: "CG WEST",  status: "ACTIVE",   lat: 19.00, lon: 72.80, fuel: 80, ammo: 30,  threat: "LOW"    },
    { id: "a0000004-0000-0000-0000-000000000002", name: "ICGS Rajveer",         type: "PATROL_VESSEL",service:"COAST_GUARD",  battalion: "CG EAST",  status: "ACTIVE",   lat: 13.10, lon: 80.30, fuel: 75, ammo: 25,  threat: "LOW"    },
    { id: "a0000004-0000-0000-0000-000000000003", name: "CG Dornier DO-228",    type: "PATROL_AIRCRAFT",service:"COAST_GUARD", battalion: "840 SQN",  status: "ACTIVE",   lat: 19.10, lon: 72.90, fuel: 65, ammo: 0,   threat: "LOW"    },

    // ── SPECIAL FORCES / INTELLIGENCE ────────────────────────────────────────
    { id: "a0000005-0000-0000-0000-000000000001", name: "MARCOS Team Kraken",   type: "PERSONNEL",   service: "SPECIAL_FORCES", battalion: "MARCOS",  status: "ACTIVE",  lat: 18.95, lon: 72.82, fuel: 100,ammo: 95,  threat: "HIGH"   },
    { id: "a0000005-0000-0000-0000-000000000002", name: "MARCOS Team Manta",    type: "PERSONNEL",   service: "SPECIAL_FORCES", battalion: "MARCOS",  status: "ACTIVE",  lat: 18.93, lon: 72.80, fuel: 100,ammo: 90,  threat: "HIGH"   },
    { id: "a0000005-0000-0000-0000-000000000003", name: "Garud Commando Bravo", type: "PERSONNEL",   service: "SPECIAL_FORCES", battalion: "GARUD",   status: "ACTIVE",  lat: 28.59, lon: 77.23, fuel: 100,ammo: 88,  threat: "HIGH"   },
    { id: "a0000005-0000-0000-0000-000000000004", name: "NSG Black Cat Delta",  type: "PERSONNEL",   service: "SPECIAL_FORCES", battalion: "NSG",     status: "STANDBY", lat: 28.58, lon: 77.10, fuel: 100,ammo: 100, threat: "HIGH"   },
    { id: "a0000005-0000-0000-0000-000000000005", name: "RAW Intel Unit Sigma", type: "PERSONNEL",   service: "SPECIAL_FORCES", battalion: "RAW",     status: "ACTIVE",  lat: 28.62, lon: 77.20, fuel: 100,ammo: 20,  threat: "MEDIUM" },
    { id: "a0000005-0000-0000-0000-000000000006", name: "SFF Tiger Div Alpha",  type: "PERSONNEL",   service: "SPECIAL_FORCES", battalion: "SFF",     status: "ACTIVE",  lat: 34.00, lon: 78.50, fuel: 100,ammo: 85,  threat: "HIGH"   },
    { id: "a0000005-0000-0000-0000-000000000007", name: "Para SF Himveers-5",   type: "PERSONNEL",   service: "SPECIAL_FORCES", battalion: "21 PARA SF",status:"ACTIVE", lat: 33.80, lon: 77.60, fuel: 100,ammo: 80,  threat: "HIGH"   },
  ];

  // Build waypoints for each asset (circular patrol routes)
  // Build callsign from type + sequential index
  const callsignCounters: Record<string, number> = {};
  const iconMap: Record<string, string> = {
    TANK:"🛡️", APC:"🚛", ARTILLERY:"💥", VEHICLE:"🚙", PERSONNEL:"🪖", SUPPORT:"⛑️",
    FIGHTER_JET:"✈️", HELICOPTER:"🚁", TRANSPORT:"✈️", DRONE:"🛸", UAV:"🛸",
    CARRIER:"⚓", DESTROYER:"🚢", SUBMARINE:"🌊", PATROL_AIRCRAFT:"✈️", PATROL_VESSEL:"🚢",
  };
  const catMap: Record<string, string> = {
    TANK:"ARMOUR", APC:"INFANTRY", ARTILLERY:"ARTILLERY", VEHICLE:"LOGISTICS",
    PERSONNEL:"INFANTRY", SUPPORT:"LOGISTICS", FIGHTER_JET:"AVIATION",
    HELICOPTER:"AVIATION", TRANSPORT:"LOGISTICS", DRONE:"AVIATION", UAV:"AVIATION",
    CARRIER:"NAVAL", DESTROYER:"NAVAL", SUBMARINE:"NAVAL",
    PATROL_AIRCRAFT:"AVIATION", PATROL_VESSEL:"NAVAL",
  };

  const assetRows = assets.map((a) => {
    callsignCounters[a.type] = (callsignCounters[a.type] ?? 0) + 1;
    const cs = `${a.type.slice(0,4).toUpperCase()}-${String(callsignCounters[a.type]).padStart(2,"0")}`;
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
    FIGHTER_JET: 1500, HELICOPTER: 280, TRANSPORT: 600, DRONE: 200,
    CARRIER: 35, DESTROYER: 55, SUBMARINE: 40, PATROL_AIRCRAFT: 400,
    PATROL_VESSEL: 45, SUPPORT: 30,
  };
  return speeds[type] ?? 50;
}
