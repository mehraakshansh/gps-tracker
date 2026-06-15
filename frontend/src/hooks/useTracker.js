import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const FN           = `${SUPABASE_URL}/functions/v1`;

async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? ANON_KEY;
  return fetch(`${FN}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

const TRAIL_MAX = 20; // positions to keep per asset

export function useTracker() {
  const [assets,        setAssets]        = useState([]);
  const [zones,         setZones]         = useState([]);
  const [alerts,        setAlerts]        = useState([]);
  const [armory,        setArmory]        = useState([]);
  const [convoys,       setConvoys]       = useState([]);
  const [pathResult,    setPathResult]    = useState(null);
  const [simResult,     setSimResult]     = useState(null);
  const [simObjective,  setSimObjective]  = useState(null);
  const [pathLoading,   setPathLoading]   = useState(false);
  const [simLoading,    setSimLoading]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [connected,     setConnected]     = useState(false);
  const [tickMs,        setTickMs]        = useState(null);
  const [matchState,    setMatchState]    = useState(null);
  const [combatLog,     setCombatLog]     = useState([]);
  const tickRef  = useRef(null);
  const trailsRef = useRef(new Map());

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    try {
      const res = await apiFetch("assets");
      if (!res.ok) throw new Error(`assets ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Append current position to each asset's trail buffer
        data.forEach(a => {
          if (a.current_lat == null) return;
          const trail = trailsRef.current.get(a.id) ?? [];
          trail.push({ lat: a.current_lat, lng: a.current_lon });
          if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX);
          trailsRef.current.set(a.id, trail);
        });
        setAssets(data.map(a => ({ ...a, trail: trailsRef.current.get(a.id) ?? [] })));
      } else {
        setAssets([]);
      }
      setError(null);
    } catch (e) {
      console.error("fetchAssets:", e);
      setError(String(e));
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await apiFetch("fences");
      if (!res.ok) throw new Error(`fences ${res.status}`);
      const data = await res.json();
      setZones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchZones:", e);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await apiFetch("alerts");
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data.slice(0, 50) : []);
    } catch (e) {
      console.error("fetchAlerts:", e);
    }
  }, []);

  const fetchArmory = useCallback(async () => {
    try {
      const res = await apiFetch("armory");
      if (!res.ok) return;
      const data = await res.json();
      setArmory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchArmory:", e);
    }
  }, []);

  const fetchConvoys = useCallback(async () => {
    try {
      const res = await apiFetch("convoys");
      if (!res.ok) return;
      const data = await res.json();
      setConvoys(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchConvoys:", e);
    }
  }, []);

  // ── Tick — advance simulation (Realtime pushes the resulting asset/alert changes) ──
  const tick = useCallback(async () => {
    const t0 = Date.now();
    try {
      await apiFetch("tick", { method: "POST", body: JSON.stringify({}) });
      setConnected(true);
      setTickMs(Date.now() - t0);
    } catch (e) {
      console.error("tick:", e);
      setConnected(false);
    }
  }, []);

  // ── Zone CRUD ─────────────────────────────────────────────────────────────
  const addZone = useCallback(async (payload) => {
    if (!payload.name?.trim())          throw new Error("Zone name is required");
    if (typeof payload.center_lat !== "number" || isNaN(payload.center_lat))
      throw new Error("Invalid latitude");
    if (typeof payload.center_lon !== "number" || isNaN(payload.center_lon))
      throw new Error("Invalid longitude");

    const body = {
      name:          payload.name.trim(),
      zone_type:     payload.zone_type     ?? "GEOFENCE",
      center_lat:    payload.center_lat,
      center_lon:    payload.center_lon,
      radius_meters: payload.radius_meters ?? 5000,
      color:         payload.color         ?? "#00ff88",
      threat_level:  payload.threat_level  ?? "LOW",
    };

    const res = await apiFetch("fences", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }
    const created = await res.json();
    setZones((prev) => [created, ...prev]);
    return created;
  }, []);

  const removeZone = useCallback(async (zoneId) => {
    const res = await apiFetch(`fences/${zoneId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
  }, []);

  // ── Alerts ────────────────────────────────────────────────────────────────
  const clearAlerts = useCallback(async () => {
    try {
      await apiFetch("alerts", { method: "DELETE" });
      setAlerts([]);
    } catch (e) {
      console.error("clearAlerts:", e);
      setAlerts([]);
    }
  }, []);

  // ── Pathfinding ───────────────────────────────────────────────────────────
  const runPathfind = useCallback(async (assetId, endLat, endLon, algo = "ASTAR") => {
    setPathLoading(true);
    try {
      const res = await apiFetch("pathfind", {
        method: "POST",
        body: JSON.stringify({ asset_id: assetId, end_lat: endLat, end_lon: endLon, algo }),
      });
      if (!res.ok) throw new Error(`pathfind ${res.status}`);
      const data = await res.json();
      setPathResult(data);
      return data;
    } catch (e) {
      console.error("runPathfind:", e);
      throw e;
    } finally {
      setPathLoading(false);
    }
  }, []);

  // ── Simulation ────────────────────────────────────────────────────────────
  const runSimulation = useCallback(async (opId, assetIds, opType, objLat, objLon, terrain, weather, timeOfDay, hostileStrength) => {
    setSimLoading(true);
    try {
      const res = await apiFetch("simulate", {
        method: "POST",
        body: JSON.stringify({
          operation_id:     opId,
          asset_ids:        assetIds,
          op_type:          opType,
          objective_lat:    objLat,
          objective_lon:    objLon,
          terrain,
          weather,
          time_of_day:      timeOfDay,
          hostile_strength: hostileStrength,
        }),
      });
      if (!res.ok) throw new Error(`simulate ${res.status}`);
      const data = await res.json();
      setSimResult(data);
      setSimObjective({ lat: objLat, lon: objLon });
      return data;
    } catch (e) {
      console.error("runSimulation:", e);
      throw e;
    } finally {
      setSimLoading(false);
    }
  }, []);

  // ── Convoy CRUD ───────────────────────────────────────────────────────────
  const addConvoy = useCallback(async (payload) => {
    const res = await apiFetch("convoys", { method:"POST", body:JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json().catch(()=>({ error:res.statusText }));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }
    const created = await res.json();
    setConvoys(prev => [created, ...prev]);
    return created;
  }, []);

  const updateConvoyStatus = useCallback(async (convoyId, status) => {
    const res = await apiFetch(`convoys/${convoyId}`, { method:"PUT", body:JSON.stringify({ status }) });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    const updated = await res.json();
    setConvoys(prev => prev.map(c => c.id === convoyId ? updated : c));
    return updated;
  }, []);

  const deleteConvoy = useCallback(async (convoyId) => {
    const res = await apiFetch(`convoys/${convoyId}`, { method:"DELETE" });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    setConvoys(prev => prev.filter(c => c.id !== convoyId));
  }, []);

  // ── Command console ───────────────────────────────────────────────────────
  const assetsRef = useRef([]);
  assetsRef.current = assets;
  const alertsRef = useRef([]);
  alertsRef.current = alerts;
  const convoysRef = useRef([]);
  convoysRef.current = convoys;

  const executeCommand = useCallback(async (cmd) => {
    const parts = cmd.trim().split(/\s+/);
    const verb = (parts[0] ?? "").toUpperCase();

    if (verb === "HALT" && parts[1]) {
      const cs = parts[1].toUpperCase();
      const a = assetsRef.current.find(x => x.callsign?.toUpperCase() === cs);
      if (!a) return { ok:false, msg:`Asset ${cs} not found` };
      setAssets(prev => prev.map(x => x.id === a.id ? {...x, status:"HALTED"} : x));
      return { ok:true, msg:`✓ HALT order issued to ${cs}` };
    }
    if (verb === "ENGAGE" && parts[1]) {
      const cs = parts[1].toUpperCase();
      const a = assetsRef.current.find(x => x.callsign?.toUpperCase() === cs);
      if (!a) return { ok:false, msg:`Asset ${cs} not found` };
      setAssets(prev => prev.map(x => x.id === a.id ? {...x, status:"ENGAGED"} : x));
      return { ok:true, msg:`✓ ${cs} set to ENGAGED` };
    }
    if (verb === "ACTIVE" && parts[1]) {
      const cs = parts[1].toUpperCase();
      const a = assetsRef.current.find(x => x.callsign?.toUpperCase() === cs);
      if (!a) return { ok:false, msg:`Asset ${cs} not found` };
      setAssets(prev => prev.map(x => x.id === a.id ? {...x, status:"ACTIVE"} : x));
      return { ok:true, msg:`✓ ${cs} set to ACTIVE` };
    }
    if (verb === "STATUS" && parts[1]) {
      const cs = parts[1].toUpperCase();
      const a = assetsRef.current.find(x => x.callsign?.toUpperCase() === cs);
      if (!a) return { ok:false, msg:`Asset ${cs} not found` };
      return { ok:true, msg:`${a.callsign} | ${a.status} | spd:${a.current_speed?.toFixed(0)} | hdg:${a.current_heading?.toFixed(0)}° | fuel:${a.fuel_pct?.toFixed(0)}% | ammo:${a.ammo_pct?.toFixed(0)}%` };
    }
    if (verb === "LIST") {
      const all = assetsRef.current;
      return { ok:true, msg:`${all.length} assets: ${all.slice(0,8).map(a=>a.callsign).join(", ")}${all.length>8?` +${all.length-8} more`:""}` };
    }
    if (verb === "ALERTS") {
      const al = alertsRef.current;
      return { ok:true, msg:`${al.length} alerts (${al.filter(a=>a.severity==="CRITICAL").length} critical)` };
    }
    if (verb === "CONVOYS") {
      const cv = convoysRef.current;
      return { ok:true, msg:cv.length ? cv.map(c=>`${c.name}[${c.status}]`).join("  ") : "No convoys" };
    }
    if (verb === "ORDER" && parts[1]) {
      // ORDER <callsign> — enters order mode (handled in App via return value)
      const cs = parts[1].toUpperCase();
      const a = assetsRef.current.find(x => x.callsign?.toUpperCase() === cs);
      if (!a) return { ok:false, msg:`Asset ${cs} not found` };
      if (a.faction === "ALPHA") return { ok:false, msg:`Cannot issue orders to enemy asset ${cs}` };
      return { ok:true, msg:`__ORDER__:${a.id}:${a.callsign}` };
    }
    if (verb === "SEED") {
      await apiFetch("assets", { method:"POST", body:JSON.stringify({ action:"seed" }) });
      await fetchAssets();
      return { ok:true, msg:"Asset database re-seeded" };
    }
    if (verb === "CLEAR") return { ok:true, msg:"__CLEAR__" };
    if (verb === "HELP") {
      return { ok:true, msg:"HALT|ENGAGE|ACTIVE <callsign>  STATUS <callsign>  ORDER <callsign>  LIST  ALERTS  CONVOYS  SEED  CLEAR  HELP" };
    }
    return { ok:false, msg:`Unknown: ${verb} — type HELP` };
  }, [fetchAssets]);

  // ── Issue movement order (replace waypoints for an asset) ────────────────
  const issueOrder = useCallback(async (assetId, waypoints) => {
    const res = await apiFetch("assets", {
      method: "POST",
      body: JSON.stringify({ action: "waypoints", asset_id: assetId, waypoints }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Server error ${res.status}`);
    }
    return res.json();
  }, []);

  // ── Force re-seed assets ──────────────────────────────────────────────────
  const seedAssets = useCallback(async () => {
    await apiFetch("assets", { method:"POST", body:JSON.stringify({ action:"seed" }) });
    await fetchAssets();
  }, [fetchAssets]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchAssets(), fetchZones(), fetchAlerts(), fetchArmory(), fetchConvoys()]);
      // Load match state and recent combat log
      const { data: ms } = await supabase.from("match_state").select("*").eq("id", 1).limit(1);
      if (ms?.[0]) setMatchState(ms[0]);
      const { data: cl } = await supabase.from("combat_log").select("*").order("created_at", { ascending: false }).limit(20);
      if (cl) setCombatLog(cl);
      setLoading(false);
      setConnected(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick interval (every 2 s) ─────────────────────────────────────────────
  useEffect(() => {
    tickRef.current = setInterval(tick, 2000);
    return () => clearInterval(tickRef.current);
  }, [tick]);

  // ── Convoy refresh every 10 s ─────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(fetchConvoys, 10000);
    return () => clearInterval(iv);
  }, [fetchConvoys]);

  // ── Realtime: assets + alerts (replaces per-tick HTTP polling) ────────────
  useEffect(() => {
    const assetsCh = supabase
      .channel("rt-assets")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "assets" }, (payload) => {
        const u = payload.new;
        if (u.current_lat != null) {
          const trail = trailsRef.current.get(u.id) ?? [];
          trail.push({ lat: u.current_lat, lng: u.current_lon });
          if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX);
          trailsRef.current.set(u.id, trail);
        }
        setAssets(prev => prev.map(a =>
          a.id === u.id ? { ...u, trail: trailsRef.current.get(u.id) ?? [] } : a
        ));
      })
      .subscribe();

    const alertsCh = supabase
      .channel("rt-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
        setAlerts(prev => [payload.new, ...prev].slice(0, 50));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "alerts" }, () => {
        fetchAlerts(); // bulk clear — reload from server
      })
      .subscribe();

    const matchCh = supabase
      .channel("rt-match")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_state" }, (payload) => {
        setMatchState(payload.new);
      })
      .subscribe();

    const combatCh = supabase
      .channel("rt-combat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "combat_log" }, (payload) => {
        setCombatLog(prev => [payload.new, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(assetsCh);
      supabase.removeChannel(alertsCh);
      supabase.removeChannel(matchCh);
      supabase.removeChannel(combatCh);
    };
  }, [fetchAlerts]);

  return {
    assets, zones, alerts, armory, convoys,
    loading, error, connected, tickMs,
    pathResult, setPathResult, pathLoading,
    simResult, setSimResult, simObjective, setSimObjective, simLoading,
    addZone, removeZone,
    clearAlerts,
    runPathfind, runSimulation,
    addConvoy, updateConvoyStatus, deleteConvoy,
    executeCommand,
    seedAssets,
    issueOrder,
    matchState, combatLog,
    refreshAssets: fetchAssets,
    refreshZones:  fetchZones,
  };
}
