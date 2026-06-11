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

export function useTracker() {
  const [assets,        setAssets]        = useState([]);
  const [zones,         setZones]         = useState([]);
  const [alerts,        setAlerts]        = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const tickRef = useRef(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    try {
      const res = await apiFetch("assets");
      if (!res.ok) throw new Error(`assets ${res.status}`);
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
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

  // ── Tick — advance simulation ─────────────────────────────────────────────
  const tick = useCallback(async () => {
    try {
      await apiFetch("tick", { method: "POST", body: JSON.stringify({}) });
      await fetchAssets();
      await fetchAlerts();
    } catch (e) {
      console.error("tick:", e);
    }
  }, [fetchAssets, fetchAlerts]);

  // ── Zone CRUD ─────────────────────────────────────────────────────────────
  const createZone = useCallback(async (payload) => {
    if (!payload.name?.trim())          throw new Error("Zone name is required");
    if (typeof payload.center_lat !== "number" || isNaN(payload.center_lat))
      throw new Error("Invalid latitude");
    if (typeof payload.center_lon !== "number" || isNaN(payload.center_lon))
      throw new Error("Invalid longitude");

    const body = {
      name:           payload.name.trim(),
      zone_type:      payload.zone_type      ?? "GEOFENCE",
      center_lat:     payload.center_lat,
      center_lon:     payload.center_lon,
      radius_meters:  payload.radius_meters  ?? 5000,
      color:          payload.color          ?? "#00ff88",
      threat_level:   payload.threat_level   ?? "LOW",
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

  const deleteZone = useCallback(async (zoneId) => {
    const res = await apiFetch(`fences/${zoneId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
  }, []);

  // ── Force re-seed assets ──────────────────────────────────────────────────
  const seedAssets = useCallback(async () => {
    await apiFetch("assets", {
      method: "POST",
      body: JSON.stringify({ action: "seed" }),
    });
    await fetchAssets();
  }, [fetchAssets]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchAssets(), fetchZones(), fetchAlerts()]);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tick interval (every 2 s) ─────────────────────────────────────────────
  useEffect(() => {
    tickRef.current = setInterval(tick, 2000);
    return () => clearInterval(tickRef.current);
  }, [tick]);

  // ── Keep selectedAsset in sync with live data ─────────────────────────────
  useEffect(() => {
    if (!selectedAsset) return;
    const live = assets.find((a) => a.id === selectedAsset.id);
    if (live) setSelectedAsset(live);
  }, [assets]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    assets,
    zones,
    alerts,
    loading,
    error,
    selectedAsset,
    setSelectedAsset,
    createZone,
    deleteZone,
    seedAssets,
    refreshAssets: fetchAssets,
    refreshZones:  fetchZones,
  };
}
