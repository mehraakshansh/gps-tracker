import { useState, useEffect, useRef, useCallback } from "react";
import { FN, H } from "../lib/supabase";

export function useTracker() {
  const [assets,     setAssets]     = useState([]);
  const [zones,      setZones]      = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [armory,     setArmory]     = useState([]);
  const [pathResult, setPathResult] = useState(null);
  const [simResult,  setSimResult]  = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [pathLoading,setPathLoading]= useState(false);
  const [connected,  setConnected]  = useState(false);
  const [tickMs,     setTickMs]     = useState(0);
  const trailsRef = useRef({});

  const tick = useCallback(async () => {
    const t0 = Date.now();
    try {
      const r = await fetch(`${FN}/tick`, { method:"POST", headers:H });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);

      // Maintain trails in memory
      d.assets.forEach(a => {
        if (!a.current_lat) return;
        if (!trailsRef.current[a.id]) trailsRef.current[a.id] = [];
        const t = trailsRef.current[a.id];
        t.push({ lat: a.current_lat, lng: a.current_lon });
        if (t.length > 100) t.shift();
        a.trail = [...t];
      });

      setAssets(d.assets || []);
      setZones(d.zones   || []);
      setAlerts(prev => {
        const known = new Set(prev.map(x => x.id));
        const fresh = (d.alerts || []).filter(x => !known.has(x.id));
        return [...fresh, ...prev].slice(0, 150);
      });
      setConnected(true);
      setTickMs(Date.now() - t0);
    } catch {
      setConnected(false);
    }
  }, []);

  // Tick every 1s
  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Load armory on mount
  useEffect(() => {
    fetch(`${FN}/armory`, { headers: H })
      .then(r => r.json())
      .then(d => setArmory(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const runPathfind = useCallback(async (assetId, endLat, endLon, algo) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset?.current_lat) return null;
    setPathLoading(true);
    try {
      const r = await fetch(`${FN}/pathfind`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          asset_id: assetId,
          start_lat: asset.current_lat, start_lon: asset.current_lon,
          end_lat: endLat, end_lon: endLon, algorithm: algo,
        }),
      });
      const d = await r.json();
      setPathResult({ ...d, assetId, algo });
      return d;
    } finally { setPathLoading(false); }
  }, [assets]);

  const runSimulation = useCallback(async (opId, assetIds, opType, objLat, objLon, terrain, weather, timeOfDay, hostileCount) => {
    setSimLoading(true);
    try {
      const r = await fetch(`${FN}/simulate`, {
        method: "POST", headers: H,
        body: JSON.stringify({
          operation_id: opId, asset_ids: assetIds, op_type: opType,
          objective_lat: objLat, objective_lon: objLon,
          terrain, weather, time_of_day: timeOfDay, hostile_count: hostileCount,
        }),
      });
      const d = await r.json();
      setSimResult(d);
      return d;
    } finally { setSimLoading(false); }
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  const addZone = useCallback(async (form) => {
    const r = await fetch(`${FN}/fences`, { method:"POST", headers:H, body:JSON.stringify(form) });
    const z = await r.json();
    setZones(prev => [...prev, z]);
  }, []);

  const removeZone = useCallback(async (id) => {
    await fetch(`${FN}/fences?id=${id}`, { method:"DELETE", headers:H });
    setZones(prev => prev.filter(z => z.id !== id));
  }, []);

  return {
    assets, zones, alerts, armory,
    pathResult, simResult, simLoading, pathLoading,
    connected, tickMs,
    tick, runPathfind, runSimulation, clearAlerts, addZone, removeZone,
    setPathResult, setSimResult,
  };
}
