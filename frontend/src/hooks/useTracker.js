import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, FUNCTIONS_URL } from "../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Asset {
  id: string;
  name: string;
  asset_type: string;
  service: string;
  battalion: string;
  status: string;
  current_lat: number;
  current_lon: number;
  fuel_level: number;
  ammo_level: number;
  threat_status: string;
  heading: number;
  speed_kmh: number;
  waypoints?: [number, number][];
  waypoint_index?: number;
}

export interface Zone {
  id: string;
  name: string;
  zone_type: string;
  center_lat: number;
  center_lon: number;
  radius_meters: number;
  color: string;
  threat_level: string;
  is_active: boolean;
}

export interface AlertItem {
  id: string;
  asset_id: string;
  zone_id: string;
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  assets?: { name: string };
  zones?: { name: string };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTracker() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`${FUNCTIONS_URL}/assets`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
      });
      if (!res.ok) throw new Error(`assets: ${res.status}`);
      const data: Asset[] = await res.json();
      setAssets(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error("fetchAssets:", e);
      setError(String(e));
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch(`${FUNCTIONS_URL}/fences`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
      });
      if (!res.ok) throw new Error(`fences: ${res.status}`);
      const data: Zone[] = await res.json();
      setZones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchZones:", e);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${FUNCTIONS_URL}/alerts`, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
      });
      if (!res.ok) return;
      const data: AlertItem[] = await res.json();
      setAlerts(Array.isArray(data) ? data.slice(0, 50) : []);
    } catch (e) {
      console.error("fetchAlerts:", e);
    }
  }, []);

  const tick = useCallback(async () => {
    try {
      await fetch(`${FUNCTIONS_URL}/tick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
        },
        body: JSON.stringify({}),
      });
      await fetchAssets();
      await fetchAlerts();
    } catch (e) {
      console.error("tick:", e);
    }
  }, [fetchAssets, fetchAlerts]);

  // ── Zone CRUD ────────────────────────────────────────────────────────────
  const createZone = useCallback(async (payload: {
    name: string;
    zone_type: string;
    center_lat: number;
    center_lon: number;
    radius_meters: number;
    color?: string;
    threat_level?: string;
  }) => {
    // Validate before sending
    if (!payload.name?.trim()) throw new Error("Zone name is required");
    if (typeof payload.center_lat !== "number" || isNaN(payload.center_lat))
      throw new Error("Invalid latitude");
    if (typeof payload.center_lon !== "number" || isNaN(payload.center_lon))
      throw new Error("Invalid longitude");

    const body = {
      name: payload.name.trim(),
      zone_type: payload.zone_type ?? "GEOFENCE",
      center_lat: payload.center_lat,
      center_lon: payload.center_lon,
      radius_meters: payload.radius_meters ?? 5000,
      color: payload.color ?? "#00ff88",
      threat_level: payload.threat_level ?? "LOW",
    };

    const res = await fetch(`${FUNCTIONS_URL}/fences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errData.error ?? `Server error ${res.status}`);
    }

    const created: Zone = await res.json();
    setZones((prev) => [created, ...prev]);
    return created;
  }, []);

  const deleteZone = useCallback(async (zoneId: string) => {
    const res = await fetch(`${FUNCTIONS_URL}/fences/${zoneId}`, {
      method: "DELETE",
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "" },
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
  }, []);

  // ── Seed assets if empty ─────────────────────────────────────────────────
  const seedAssets = useCallback(async () => {
    await fetch(`${FUNCTIONS_URL}/assets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
      },
      body: JSON.stringify({ action: "seed" }),
    });
    await fetchAssets();
  }, [fetchAssets]);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchAssets(), fetchZones(), fetchAlerts()]);
      setLoading(false);
    })();
  }, [fetchAssets, fetchZones, fetchAlerts]);

  useEffect(() => {
    tickRef.current = setInterval(tick, 2000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [tick]);

  // Update selectedAsset reference when assets refresh
  useEffect(() => {
    if (selectedAsset) {
      const updated = assets.find((a) => a.id === selectedAsset.id);
      if (updated) setSelectedAsset(updated);
    }
  }, [assets]);

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
    refreshZones: fetchZones,
  };
}
