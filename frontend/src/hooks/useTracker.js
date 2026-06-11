// ─────────────────────────────────────────────────────────────
// useTracker — polls /tick every second, manages local state
// No WebSocket needed — Supabase Realtime as bonus layer
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { FN_BASE, supabase } from "../lib/supabase";

const HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
};

export function useTracker() {
  const [assets,    setAssets]    = useState([]);
  const [fences,    setFences]    = useState([]);
  const [alerts,    setAlerts]    = useState([]);
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState(null);
  const tickRef = useRef(null);
  const trails  = useRef({});  // assetId → lat/lon history (client-side cache)

  const tick = useCallback(async () => {
    try {
      const res  = await fetch(`${FN_BASE}/tick`, { method: "POST", headers: HEADERS });
      if (!res.ok) throw new Error(`tick ${res.status}`);
      const data = await res.json();

      // Maintain trail history client-side (Edge Function is stateless for trails)
      data.assets.forEach(a => {
        if (!a.current_lat) return;
        if (!trails.current[a.id]) trails.current[a.id] = [];
        const t = trails.current[a.id];
        t.push({ lat: a.current_lat, lng: a.current_lon });
        if (t.length > 100) t.shift();
        a.trail = [...t];
      });

      setAssets(data.assets);
      setFences(data.fences);
      setAlerts(prev => {
        // Merge new alerts (avoid duplicates by id)
        const existingIds = new Set(prev.map(x => x.id));
        const incoming    = (data.alerts || []).filter(x => !existingIds.has(x.id));
        return [...incoming, ...prev].slice(0, 100);
      });
      setConnected(true);
      setError(null);
    } catch (e) {
      setConnected(false);
      setError(e.message);
    }
  }, []);

  // Start tick loop
  useEffect(() => {
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickRef.current);
  }, [tick]);

  // ── Fence management ──────────────────────────────────────
  const addFence = useCallback(async (form) => {
    const res = await fetch(`${FN_BASE}/fences`, {
      method:  "POST",
      headers: HEADERS,
      body:    JSON.stringify(form),
    });
    if (res.ok) {
      const fence = await res.json();
      setFences(prev => [...prev, fence]);
    }
  }, []);

  const removeFence = useCallback(async (id) => {
    await fetch(`${FN_BASE}/fences?id=${id}`, { method: "DELETE", headers: HEADERS });
    setFences(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearAlerts = useCallback(async () => {
    await fetch(`${FN_BASE}/alerts`, { method: "DELETE", headers: HEADERS });
    setAlerts([]);
  }, []);

  return { assets, fences, alerts, connected, error, addFence, removeFence, clearAlerts };
}
