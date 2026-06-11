import { useState, useCallback } from "react";
import { useMapEvents } from "react-leaflet";

// ── Map click picker (rendered inside MapContainer) ──────────────────────────
export function MapClickPicker({ onPick, active }) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

// ── Zone creator panel ────────────────────────────────────────────────────────
export default function ZoneCreator({ onCreateZone, onClose }) {
  const [form, setForm] = useState({
    name: "",
    zone_type: "GEOFENCE",
    center_lat: "",
    center_lon: "",
    radius_meters: "5000",
    color: "#00ff88",
    threat_level: "LOW",
  });
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handlePick = useCallback(({ lat, lon }) => {
    set("center_lat", lat.toFixed(6));
    set("center_lon", lon.toFixed(6));
    setPicking(false);
  }, []);

  const handleSubmit = async () => {
    setError(null);

    // Client-side validation
    if (!form.name.trim()) { setError("Zone name is required"); return; }
    const lat = parseFloat(form.center_lat);
    const lon = parseFloat(form.center_lon);
    if (isNaN(lat) || lat < -90 || lat > 90) { setError("Enter a valid latitude (-90 to 90)"); return; }
    if (isNaN(lon) || lon < -180 || lon > 180) { setError("Enter a valid longitude (-180 to 180)"); return; }
    const radius = parseInt(form.radius_meters, 10);
    if (isNaN(radius) || radius < 100) { setError("Radius must be at least 100 metres"); return; }

    setLoading(true);
    try {
      await onCreateZone({
        name: form.name.trim(),
        zone_type: form.zone_type,
        center_lat: lat,
        center_lon: lon,
        radius_meters: radius,
        color: form.color,
        threat_level: form.threat_level,
      });
      onClose?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", background: "#0a1628", border: "1px solid #1e3a5f",
    color: "#e2e8f0", padding: "6px 10px", borderRadius: 4, fontSize: 12,
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 11, color: "#64748b", marginBottom: 3, display: "block" };
  const rowStyle = { marginBottom: 10 };

  return (
    <>
      {/* Map click interceptor — rendered outside this div via portal-style pattern */}
      {picking && (
        <MapClickPicker active={picking} onPick={handlePick} />
      )}

      <div style={{
        background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: 8,
        padding: 16, color: "#e2e8f0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#00ff88" }}>
            ⊕ CREATE ZONE / GEO-FENCE
          </span>
          {onClose && (
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "#64748b",
              cursor: "pointer", fontSize: 16,
            }}>✕</button>
          )}
        </div>

        {error && (
          <div style={{
            background: "#2d0a0a", border: "1px solid #ff4444", borderRadius: 4,
            padding: "8px 10px", marginBottom: 10, fontSize: 12, color: "#ff8888",
          }}>
            ⚠ {error}
          </div>
        )}

        <div style={rowStyle}>
          <label style={labelStyle}>ZONE NAME *</label>
          <input style={inputStyle} value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Sector 7 Perimeter" maxLength={100} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>TYPE</label>
            <select style={inputStyle} value={form.zone_type}
              onChange={(e) => set("zone_type", e.target.value)}>
              <option value="GEOFENCE">GEO-FENCE</option>
              <option value="RESTRICTED">RESTRICTED</option>
              <option value="OPERATIONAL">OPERATIONAL AO</option>
              <option value="BASE">BASE / INSTALLATION</option>
              <option value="PATROL">PATROL ZONE</option>
              <option value="SAFE">SAFE CORRIDOR</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>THREAT LEVEL</label>
            <select style={inputStyle} value={form.threat_level}
              onChange={(e) => set("threat_level", e.target.value)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>LATITUDE *</label>
            <input style={inputStyle} value={form.center_lat}
              onChange={(e) => set("center_lat", e.target.value)}
              placeholder="28.6139" type="number" step="any" />
          </div>
          <div>
            <label style={labelStyle}>LONGITUDE *</label>
            <input style={inputStyle} value={form.center_lon}
              onChange={(e) => set("center_lon", e.target.value)}
              placeholder="77.2090" type="number" step="any" />
          </div>
        </div>

        <button
          onClick={() => setPicking((p) => !p)}
          style={{
            width: "100%", padding: "6px 0", marginBottom: 10,
            background: picking ? "#1a3a5c" : "#0a1628",
            border: `1px solid ${picking ? "#00ff88" : "#1e3a5f"}`,
            color: picking ? "#00ff88" : "#64748b",
            borderRadius: 4, fontSize: 11, cursor: "pointer",
          }}>
          {picking ? "🎯 Click on map to place zone centre..." : "📍 Pick location on map"}
        </button>

        <div style={rowStyle}>
          <label style={labelStyle}>RADIUS (metres)</label>
          <input style={inputStyle} value={form.radius_meters}
            onChange={(e) => set("radius_meters", e.target.value)}
            type="number" min={100} max={500000} />
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>ZONE COLOUR</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="color" value={form.color}
              onChange={(e) => set("color", e.target.value)}
              style={{ width: 32, height: 28, border: "none", background: "none", cursor: "pointer" }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>{form.color}</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "9px 0", marginTop: 4,
            background: loading ? "#1a2a3a" : "linear-gradient(135deg, #00c851, #007a3d)",
            border: "none", borderRadius: 5, color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: 1,
          }}>
          {loading ? "⏳ CREATING..." : "⊕ CREATE ZONE"}
        </button>
      </div>
    </>
  );
}
