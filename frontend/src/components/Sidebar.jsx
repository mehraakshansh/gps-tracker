import React, { useState } from "react";

const STATE_STYLE = {
  IN:      { bg:"#052e16", border:"#22c55e", text:"#22c55e" },
  OUT:     { bg:"#450a0a", border:"#ef4444", text:"#ef4444" },
  UNKNOWN: { bg:"#1e293b", border:"#475569", text:"#64748b" },
};

const ALERT_COLOR = {
  critical: { bg:"#450a0a", border:"#ef4444", dot:"#ef4444", tag:"EXIT"  },
  info:     { bg:"#052e16", border:"#22c55e", dot:"#22c55e", tag:"ENTER" },
};

// ── AssetCard ────────────────────────────────────────────────
function AssetCard({ asset, selected, onClick }) {
  const pos = asset.current_lat
    ? { speed: asset.current_speed, heading: asset.current_heading }
    : null;
  return (
    <div onClick={onClick} style={{
      background: selected ? "#1e3a5f" : "#1e293b",
      border: `1px solid ${selected ? "#3b82f6" : "#334155"}`,
      borderRadius: 10, padding: "12px 14px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 12, transition: "border-color .15s",
    }}>
      <span style={{ fontSize: 26 }}>{asset.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{asset.name}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {pos ? `${pos.speed?.toFixed(1)} km/h  ·  ${pos.heading?.toFixed(0)}°` : "Initialising…"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {(asset.fenceStatus || []).map(fs => {
            const sc = STATE_STYLE[fs.state] || STATE_STYLE.UNKNOWN;
            return (
              <span key={fs.fenceId} style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 20,
                background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, fontWeight: 700,
              }}>{fs.state} · {fs.fenceName}</span>
            );
          })}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#64748b" }}>ALERTS</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: asset.alert_count > 0 ? "#f97316" : "#22c55e" }}>
          {asset.alert_count || 0}
        </div>
      </div>
    </div>
  );
}

// ── AlertFeed ────────────────────────────────────────────────
function AlertFeed({ alerts, onClear }) {
  if (!alerts.length)
    return <p style={{ color:"#475569", fontSize:13, textAlign:"center", padding:28 }}>Monitoring… no breaches yet.</p>;
  return (
    <>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:8 }}>
        <button onClick={onClear} style={{
          background:"transparent", border:"1px solid #475569", color:"#94a3b8",
          borderRadius:6, padding:"3px 10px", fontSize:11, cursor:"pointer",
        }}>Clear all</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {alerts.map(a => {
          const s = ALERT_COLOR[a.severity] || ALERT_COLOR.info;
          return (
            <div key={a.id} style={{
              background:s.bg, border:`1px solid ${s.border}`,
              borderRadius:8, padding:"8px 12px", display:"flex", gap:10, alignItems:"flex-start",
            }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:s.dot, marginTop:5, flexShrink:0, display:"block" }} />
              <div>
                <div style={{ fontSize:10, fontWeight:800, color:s.dot, letterSpacing:1 }}>{s.tag}</div>
                <div style={{ fontSize:13, color:"#e2e8f0", marginTop:2, lineHeight:1.4 }}>
                  {a.asset_icon} <b>{a.asset_name}</b> {a.event_type.toLowerCase()}d <i>{a.fence_name}</i>
                </div>
                <div style={{ fontSize:10, color:"#94a3b8", marginTop:3 }}>
                  {new Date(a.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── FencePanel ────────────────────────────────────────────────
function FencePanel({ fences, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm]     = useState({ name:"", center_lat:"28.618", center_lon:"77.210", radius_meters:"500", color:"#8B5CF6" });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const inp = {
    display:"block", width:"100%", background:"#0f172a", color:"#e2e8f0",
    border:"1px solid #475569", borderRadius:4, padding:"4px 8px", marginTop:2, fontSize:12,
  };

  const submit = e => {
    e.preventDefault();
    onAdd({ ...form, center_lat: parseFloat(form.center_lat), center_lon: parseFloat(form.center_lon), radius_meters: parseFloat(form.radius_meters) });
    setAdding(false);
    setForm({ name:"", center_lat:"28.618", center_lon:"77.210", radius_meters:"500", color:"#8B5CF6" });
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontWeight:700, fontSize:14, color:"#f1f5f9" }}>Geo-Fences ({fences.length})</span>
        <button onClick={() => setAdding(!adding)} style={{
          background:"#3b82f6", color:"#fff", border:"none", borderRadius:6,
          padding:"4px 14px", fontSize:12, fontWeight:600, cursor:"pointer",
        }}>{adding ? "Cancel" : "+ Add"}</button>
      </div>

      {adding && (
        <form onSubmit={submit} style={{
          background:"#0f172a", borderRadius:8, padding:12, marginBottom:14,
          border:"1px solid #334155", display:"flex", flexDirection:"column", gap:8,
        }}>
          {[["Name","name","text"],["Centre Lat","center_lat","number"],["Centre Lon","center_lon","number"],["Radius (m)","radius_meters","number"]].map(([label,key,type]) => (
            <label key={key} style={{ fontSize:11, color:"#94a3b8" }}>
              {label}
              <input type={type} value={form[key]} onChange={set(key)} required step="any" style={inp} />
            </label>
          ))}
          <label style={{ fontSize:11, color:"#94a3b8" }}>
            Colour
            <input type="color" value={form.color} onChange={set("color")} style={{ ...inp, height:30, padding:2, cursor:"pointer" }} />
          </label>
          <button type="submit" style={{ background:"#22c55e", color:"#fff", border:"none", borderRadius:6, padding:"6px 0", fontWeight:700, cursor:"pointer" }}>
            Create Fence
          </button>
        </form>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {(fences || []).map(f => (
          <div key={f.id} style={{
            background:"#1e293b", border:"1px solid #334155", borderRadius:8,
            padding:"8px 12px", display:"flex", alignItems:"center", gap:10,
          }}>
            <span style={{ width:12, height:12, borderRadius:"50%", background:f.color, display:"block", flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9" }}>{f.name}</div>
              <div style={{ fontSize:10, color:"#64748b" }}>r = {f.radius_meters} m</div>
            </div>
            <button onClick={() => onRemove(f.id)} style={{
              background:"transparent", border:"1px solid #ef4444", color:"#ef4444",
              borderRadius:4, padding:"2px 8px", fontSize:11, cursor:"pointer",
            }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sidebar (main export) ─────────────────────────────────────
export default function Sidebar({ assets, fences, alerts, connected, error, addFence, removeFence, clearAlerts }) {
  const [tab, setTab]           = useState("ASSETS");
  const [selected, setSelected] = useState(null);

  const insideCount = (assets || []).filter(a => a.fenceStatus?.some(s => s.state === "IN")).length;

  return (
    <div style={{
      width:340, flexShrink:0, display:"flex", flexDirection:"column",
      background:"#0f172a", borderRight:"1px solid #1e293b",
    }}>
      {/* Header */}
      <div style={{ padding:"18px 18px 12px", borderBottom:"1px solid #1e293b" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", letterSpacing:-0.3 }}>📡 GPS Geo-Fence Tracker</div>
            <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>
              {error ? `⚠ ${error}` : "Supabase · Real-time · Persistent"}
            </div>
          </div>
          <span style={{
            width:8, height:8, borderRadius:"50%",
            background: connected ? "#22c55e" : "#ef4444",
            boxShadow:  connected ? "0 0 6px #22c55e" : "none",
            display:"block", marginTop:4, flexShrink:0,
          }} />
        </div>
        {/* Stats */}
        <div style={{ display:"flex", gap:8, marginTop:14 }}>
          {[
            { label:"Assets",  value:(assets||[]).length, color:"#3b82f6" },
            { label:"In Zone", value:insideCount,          color:"#22c55e" },
            { label:"Alerts",  value:(alerts||[]).length,  color:"#f97316" },
          ].map(s => (
            <div key={s.label} style={{ flex:1, background:"#1e293b", borderRadius:8, padding:"8px 6px", textAlign:"center" }}>
              <div style={{ fontWeight:800, fontSize:20, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color:"#64748b", marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid #1e293b" }}>
        {["ASSETS","ALERTS","FENCES"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:"10px 0", background:"transparent", border:"none", cursor:"pointer",
            fontSize:11, fontWeight:700, letterSpacing:0.5,
            color: tab===t ? "#3b82f6" : "#475569",
            borderBottom: tab===t ? "2px solid #3b82f6" : "2px solid transparent",
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", padding:14 }}>
        {tab === "ASSETS" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {(assets||[]).map(a => (
              <AssetCard key={a.id} asset={a}
                selected={selected===a.id}
                onClick={() => setSelected(selected===a.id ? null : a.id)}
              />
            ))}
          </div>
        )}
        {tab === "ALERTS"  && <AlertFeed alerts={alerts||[]} onClear={clearAlerts} />}
        {tab === "FENCES"  && <FencePanel fences={fences||[]} onAdd={addFence} onRemove={removeFence} />}
      </div>

      <div style={{ padding:"8px 16px", borderTop:"1px solid #1e293b", fontSize:10, color:"#334155", textAlign:"center" }}>
        Python OOP · Haversine · State Machine · Supabase · Akshansh Mehra
      </div>
    </div>
  );
}
