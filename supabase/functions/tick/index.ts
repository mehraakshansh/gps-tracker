// ================================================================
// BRCS TICK ENGINE v3 — GPS Simulator + Geo-Fence State Machine
// OOP-based: Asset → moves along waypoints → checks all zones
// Haversine spatial math | IN/OUT state transitions | alert fire
// ================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb  = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Math helpers ──────────────────────────────────────────────
const R    = 6_371_000;
const toR  = (d: number) => (d * Math.PI) / 180;

function haversine(lat1:number,lon1:number,lat2:number,lon2:number): number {
  const φ1=toR(lat1), φ2=toR(lat2), Δφ=toR(lat2-lat1), Δλ=toR(lon2-lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function bearing(lat1:number,lon1:number,lat2:number,lon2:number): number {
  const φ1=toR(lat1), φ2=toR(lat2), Δλ=toR(lon2-lon1);
  return ((Math.atan2(
    Math.sin(Δλ)*Math.cos(φ2),
    Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ)
  )*180/Math.PI) + 360) % 360;
}

function addNoise(lat:number,lon:number,meters:number): [number,number] {
  const d = (Math.random()-0.5)*2*meters;
  const a = Math.random()*2*Math.PI;
  return [
    lat + (d*Math.cos(a))/111_320,
    lon + (d*Math.sin(a))/(111_320*Math.cos(toR(lat))),
  ];
}

// ── OOP: Asset movement state machine ─────────────────────────
class AssetMover {
  private wps: {seq:number,lat:number,lon:number}[];
  private stepIdx: number;
  private tProgress: number;
  private speedKmh: number;

  constructor(
    wps:{seq:number,lat:number,lon:number}[],
    stepIdx:number,
    tProgress:number,
    speedKmh:number
  ) {
    this.wps       = [...wps].sort((a,b)=>a.seq-b.seq);
    this.stepIdx   = stepIdx;
    this.tProgress = tProgress;
    this.speedKmh  = speedKmh;
  }

  advance(deltaSeconds:number) {
    const n = this.wps.length;
    if (n < 2) return null;

    const w1 = this.wps[this.stepIdx % n];
    const w2 = this.wps[(this.stepIdx+1) % n];
    const segLen = haversine(w1.lat,w1.lon,w2.lat,w2.lon);
    if (segLen < 1) { this.stepIdx = (this.stepIdx+1)%n; return this.advance(deltaSeconds); }

    const travelled = (this.speedKmh / 3.6) * deltaSeconds;
    let newT = this.tProgress + travelled / segLen;

    while (newT >= 1) { newT -= 1; this.stepIdx = (this.stepIdx+1)%n; }

    const a = this.wps[this.stepIdx % n];
    const b = this.wps[(this.stepIdx+1) % n];
    const rawLat = a.lat + newT*(b.lat-a.lat);
    const rawLon = a.lon + newT*(b.lon-a.lon);
    const [lat, lon] = addNoise(rawLat, rawLon, 5);

    this.tProgress = newT;
    return {
      lat, lon,
      heading : bearing(a.lat,a.lon,b.lat,b.lon),
      speed   : this.speedKmh + (Math.random()-0.5)*3,
      stepIdx : this.stepIdx,
      tProgress: this.tProgress,
    };
  }
}

// ── OOP: GeoFence checker ─────────────────────────────────────
class GeoFence {
  readonly id: string;
  readonly name: string;
  readonly zoneType: string;
  readonly centerLat: number;
  readonly centerLon: number;
  readonly radiusMeters: number;

  constructor(z: Record<string,unknown>) {
    this.id           = z.id as string;
    this.name         = z.name as string;
    this.zoneType     = z.zone_type as string;
    this.centerLat    = z.center_lat as number;
    this.centerLon    = z.center_lon as number;
    this.radiusMeters = z.radius_meters as number;
  }

  contains(lat:number, lon:number): boolean {
    return haversine(lat,lon,this.centerLat,this.centerLon) <= this.radiusMeters;
  }

  severity(): string {
    if (this.zoneType==="HOSTILE"||this.zoneType==="MINEFIELD") return "CRITICAL";
    if (this.zoneType==="RESTRICTED"||this.zoneType==="NO_FLY") return "WARNING";
    return "INFO";
  }
}

// ── Main tick handler ─────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try {
    const [
      {data:assets},
      {data:zones},
      {data:wps},
      {data:sims},
      {data:zstates},
    ] = await Promise.all([
      sb.from("assets").select("*"),
      sb.from("zones").select("*"),
      sb.from("route_waypoints").select("*"),
      sb.from("simulator_state").select("*"),
      sb.from("asset_zone_states").select("*"),
    ]);

    const fences = (zones||[]).map(z=>new GeoFence(z));
    const writes: Promise<unknown>[] = [];
    const newAlerts: object[] = [];

    for (const asset of (assets||[])) {
      const assetWps = (wps||[]).filter(w=>w.asset_id===asset.id);
      const simState = (sims||[]).find(s=>s.asset_id===asset.id);
      if (!assetWps.length || !simState) continue;

      // Move asset
      const mover  = new AssetMover(assetWps, simState.step_idx, simState.t_progress, asset.speed_kmh||30);
      const moved  = mover.advance(1);
      if (!moved) continue;

      writes.push(
        sb.from("assets").update({
          current_lat    : +moved.lat.toFixed(7),
          current_lon    : +moved.lon.toFixed(7),
          current_speed  : +moved.speed.toFixed(1),
          current_heading: +moved.heading.toFixed(1),
          fuel_pct       : Math.max(0,(asset.fuel_pct||100) - 0.003),
          ammo_pct       : asset.ammo_pct||100,
          updated_at     : new Date().toISOString(),
        }).eq("id",asset.id)
      );
      writes.push(
        sb.from("simulator_state").update({
          step_idx  : moved.stepIdx,
          t_progress: moved.tProgress,
          updated_at: new Date().toISOString(),
        }).eq("asset_id",asset.id)
      );

      // Geo-fence state machine
      for (const fence of fences) {
        const inZone = fence.contains(moved.lat, moved.lon);
        const newState = inZone ? "IN" : "OUT";
        const prevState = (zstates||[]).find(s=>s.asset_id===asset.id&&s.zone_id===fence.id)?.state ?? "UNKNOWN";

        // State transition → fire alert
        if (prevState!=="UNKNOWN" && prevState!==newState) {
          const sev = fence.severity();
          newAlerts.push({
            asset_id  : asset.id,
            asset_name: asset.name,
            asset_icon: asset.icon,
            zone_id   : fence.id,
            zone_name : fence.name,
            event_type: inZone ? "ENTERED" : "EXITED",
            severity  : sev,
            message   : `${asset.callsign} ${inZone?"ENTERED":"EXITED"} ${fence.name} [${fence.zoneType}]`,
            lat: moved.lat, lon: moved.lon,
          });
          // Update threat level
          const threatLevel = inZone
            ? (sev==="CRITICAL"?"RED": sev==="WARNING"?"ORANGE":"YELLOW")
            : "GREEN";
          writes.push(
            sb.from("assets").update({
              alert_count: (asset.alert_count||0)+1,
              threat_level: threatLevel,
            }).eq("id",asset.id)
          );
        }

        writes.push(
          sb.from("asset_zone_states").upsert(
            {asset_id:asset.id, zone_id:fence.id, state:newState, updated_at:new Date().toISOString()},
            {onConflict:"asset_id,zone_id"}
          )
        );
      }
    }

    if (newAlerts.length) writes.push(sb.from("alerts").insert(newAlerts));
    await Promise.all(writes);

    // Fetch fresh state
    const [
      {data:fa},{data:fz},{data:fia},{data:fzs}
    ] = await Promise.all([
      sb.from("assets").select("*"),
      sb.from("zones").select("*"),
      sb.from("alerts").select("*").order("created_at",{ascending:false}).limit(100),
      sb.from("asset_zone_states").select("*"),
    ]);

    const enriched = (fa||[]).map(a=>({
      ...a,
      zoneStatus: (fzs||[])
        .filter(z=>z.asset_id===a.id)
        .map(z=>{
          const zn = (fz||[]).find(f=>f.id===z.zone_id);
          return { zoneId:z.zone_id, zoneName:zn?.name??"", zoneType:zn?.zone_type??"", state:z.state };
        }),
    }));

    return new Response(JSON.stringify({assets:enriched, zones:fz||[], alerts:fia||[]}),
      {headers:{...cors,"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:cors});
  }
});
