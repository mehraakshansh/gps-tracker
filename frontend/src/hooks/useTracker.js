import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const FN           = `${SUPABASE_URL}/functions/v1`;

function apiFetch(path, options = {}) {
  return fetch(`${FN}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      ...(options.headers ?? {}),
    },
  });
}

const TRAIL_MAX = 20; // positions to keep per asset

export function useTracker() {
  const [assets,      setAssets]      = useState([]);
  const [zones,       setZones]       = useState([]);
  const [alerts,      setAlerts]      = useState([]);
  const [armory,      setArmory]      = useState([]);
  const [pathResult,  setPathResult]  = useState(null);
  const [simResult,   setSimResult]   = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [simLoading,  setSimLoading]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [connected,   setConnected]   = useState(false);
  const [tickMs,      setTickMs]      = useState(null);
  const tickRef  = useRef(null);
  const trailsRef = useRef(new Map()); // Map<assetId, {lat,lng}[]>

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

  // ── Tick — advance simulation ─────────────────────────────────────────────
  const tick = useCallback(async () => {
    const t0 = Date.now();
    try {
      await apiFetch("tick", { method: "POST", body: JSON.stringify({}) });
      await fetchAssets();
      await fetchAlerts();
      setConnected(true);
      setTickMs(Date.now() - t0);
    } catch (e) {
      console.error("tick:", e);
      setConnected(false);
    }
  }, [fetchAssets, fetchAlerts]);

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
      return data;
    } catch (e) {
      console.error("runSimulation:", e);
      throw e;
    } finally {
      setSimLoading(false);
    }
  }, []);

  // ── Force re-seed assets ──────────────────────────────────────────────────
  const seedAssets = useCallback(async () => {
    await apiFetch("assets", { method: "POST", body: JSON.stringify({ action: "seed" }) });
    await fetchAssets();
  }, [fetchAssets]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchAssets(), fetchZones(), fetchAlerts(), fetchArmory()]);
      setLoading(false);
      setConnected(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick interval (every 2 s) ─────────────────────────────────────────────
  useEffect(() => {
    tickRef.current = setInterval(tick, 2000);
    return () => clearInterval(tickRef.current);
  }, [tick]);

  return {
    // data
    assets,
    zones,
    alerts,
    armory,
    // status
    loading,
    error,
    connected,
    tickMs,
    // path
    pathResult,
    setPathResult,
    pathLoading,
    // sim
    simResult,
    setSimResult,
    simLoading,
    // zone actions
    addZone,
    removeZone,
    // alert actions
    clearAlerts,
    // operation actions
    runPathfind,
    runSimulation,
    // misc
    seedAssets,
    refreshAssets: fetchAssets,
    refreshZones:  fetchZones,
  };
}
