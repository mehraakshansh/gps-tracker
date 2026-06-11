import React, { useState, useCallback } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import { useTracker } from "./hooks/useTracker";

const SEV_BG = { CRITICAL:"#ef444422", WARNING:"#f9731622", INFO:"#22c55e11", EMERGENCY:"#a855f722" };
const SEV_COLOR = { CRITICAL:"#ef4444", WARNING:"#f97316", INFO:"#22c55e", EMERGENCY:"#a855f7" };
const SVC_ICON = { ARMY:"⚔️", AIR_FORCE:"✈️", NAVY:"⚓", SPECIAL_FORCES:"🪖" };
const SVC_COLOR = { ARMY:"#22c55e", AIR_FORCE:"#38bdf8", NAVY:"#0ea5e9", SPECIAL_FORCES:"#f59e0b" };

export default function App() {
  const tracker = useTracker();
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [clock, setClock] = useState(new Date());

  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = n => String(n).padStart(2,"0");
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
  const dateStr = clock.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});

  const critCount = tracker.alerts.filter(a => a.severity==="CRITICAL"||a.severity==="EMERGENCY").length;
  const inHostile = tracker.assets.filter(a => (a.zoneStatus||[]).some(z => z.zoneType==="HOSTILE"&&z.state==="IN")).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#020c04", overflow:"hidden", fontFamily:"'Courier New',monospace" }}>

      {/* ── TOP COMMAND BAR ─────────────────────────────────── */}
      <div style={{
        height:48, flexShrink:0,
        background:"linear-gradient(90deg,#071207,#0a1a0a,#071207)",
        borderBottom:"1px solid #1a3a1a",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 20px", gap:16,
      }}>
        {/* Left: Branding */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:22, filter:"drop-shadow(0 0 8px #22c55e)" }}>🛡️</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#22c55e", letterSpacing:3, lineHeight:1 }}>BRCS</div>
            <div style={{ fontSize:8, color:"#2d5a2d", letterSpacing:2 }}>BHARAT RAKSHA COMMAND SYSTEM</div>
          </div>
          <div style={{ width:1, height:28, background:"#1a3a1a", marginLeft:4 }} />
          <div style={{ fontSize:9, color:"#2d6a3d", letterSpacing:1 }}>WESTERN SECTOR · GRID 28°37'N 77°12'E</div>
        </div>

        {/* Center: Live stats */}
        <div style={{ display:"flex", gap:8 }}>
          {[
            { label:"ASSETS",   value:(tracker.assets||[]).length,    color:"#22c55e" },
            { label:"HOSTILE",  value:inHostile,                       color:inHostile>0?"#ef4444":"#22c55e" },
            { label:"ALERTS",   value:(tracker.alerts||[]).length,     color:critCount>0?"#ef4444":"#f97316" },
            { label:"ZONES",    value:(tracker.zones||[]).length,      color:"#38bdf8" },
          ].map(s => (
            <div key={s.label} style={{
              background:"#071207", border:`1px solid ${s.color}33`,
              borderRadius:3, padding:"3px 10px", textAlign:"center", minWidth:56,
            }}>
              <div style={{ fontSize:16, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:7, color:"#2d4a2d", letterSpacing:1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Right: Clock + status */}
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#22c55e", letterSpacing:2, fontVariantNumeric:"tabular-nums" }}>{timeStr}</div>
            <div style={{ fontSize:8, color:"#2d4a2d", letterSpacing:1 }}>{dateStr} IST</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{
                width:7, height:7, borderRadius:"50%",
                background: tracker.connected ? "#22c55e" : "#ef4444",
                boxShadow: tracker.connected ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
                animation: tracker.connected ? "pulse 1.5s ease-in-out infinite" : "none",
              }}/>
              <span style={{ fontSize:9, fontWeight:700, color:tracker.connected?"#22c55e":"#ef4444", letterSpacing:1 }}>
                {tracker.connected ? "UPLINK" : "OFFLINE"}
              </span>
            </div>
            {tracker.connected && (
              <span style={{ fontSize:8, color:"#1a4a1a" }}>{tracker.tickMs}ms</span>
            )}
          </div>
        </div>
      </div>

      {/* ── ALERT TICKER ──────────────────────────────────────── */}
      {critCount > 0 && (
        <div style={{
          height:28, flexShrink:0,
          background:"#ef444411", borderBottom:"1px solid #ef444444",
          display:"flex", alignItems:"center", overflow:"hidden",
        }}>
          <div style={{
            flexShrink:0, background:"#ef4444", color:"white",
            fontSize:9, fontWeight:700, padding:"0 10px", height:"100%",
            display:"flex", alignItems:"center", letterSpacing:1,
          }}>⚠ CRITICAL</div>
          <div style={{ display:"flex", gap:24, padding:"0 12px", overflow:"hidden" }}>
            {tracker.alerts.filter(a=>a.severity==="CRITICAL"||a.severity==="EMERGENCY").slice(0,5).map(a=>(
              <span key={a.id} style={{ fontSize:10, color:"#ef4444", whiteSpace:"nowrap", letterSpacing:0.5 }}>
                {a.asset_icon} <b>{a.asset_name}</b> — {a.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN BODY ─────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* Sidebar */}
        <Sidebar
          {...tracker}
          selectedAssetId={selectedAsset}
          onSelectAsset={setSelectedAsset}
        />

        {/* Map area */}
        <div style={{ flex:1, position:"relative", display:"flex", flexDirection:"column" }}>
          <MapView
            assets={tracker.assets}
            zones={tracker.zones}
            pathResult={tracker.pathResult}
            selectedAssetId={selectedAsset}
            onAssetClick={setSelectedAsset}
          />

          {/* ── Service HUD (top-right over map) */}
          <div style={{
            position:"absolute", top:12, right:12, zIndex:500,
            display:"flex", flexDirection:"column", gap:4,
          }}>
            {Object.entries(SVC_ICON).map(([svc,icon]) => {
              const cnt = tracker.assets.filter(a=>a.service===svc).length;
              if (!cnt) return null;
              return (
                <div key={svc} style={{
                  background:"rgba(2,12,4,.9)", border:`1px solid ${SVC_COLOR[svc]}44`,
                  borderRadius:3, padding:"4px 10px",
                  display:"flex", alignItems:"center", gap:8,
                  backdropFilter:"blur(4px)",
                }}>
                  <span style={{fontSize:14}}>{icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:SVC_COLOR[svc]}}>{cnt}</div>
                    <div style={{fontSize:7,color:"#2d4a2d",letterSpacing:1}}>{svc.replace("_"," ")}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Selected asset HUD (bottom-left over map) */}
          {selectedAsset && (() => {
            const a = tracker.assets.find(x=>x.id===selectedAsset);
            if (!a) return null;
            const tCol = {GREEN:"#22c55e",YELLOW:"#eab308",ORANGE:"#f97316",RED:"#ef4444"}[a.threat_level]||"#22c55e";
            return (
              <div style={{
                position:"absolute", bottom:16, left:16, zIndex:500,
                background:"rgba(2,12,4,.95)", border:`1px solid ${tCol}`,
                borderRadius:4, padding:"10px 14px", minWidth:220,
                backdropFilter:"blur(8px)",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:24,filter:`drop-shadow(0 0 6px ${tCol})`}}>{a.icon}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#22c55e",letterSpacing:2}}>{a.callsign}</div>
                    <div style={{fontSize:9,color:"#2d5a2d"}}>{a.name}</div>
                  </div>
                  <button onClick={()=>setSelectedAsset(null)} style={{marginLeft:"auto",background:"transparent",border:"none",color:"#2d4a2d",cursor:"pointer",fontSize:14}}>✕</button>
                </div>
                {[
                  ["SPEED",  `${a.current_speed?.toFixed(1)} km/h`],
                  ["HDG",    `${a.current_heading?.toFixed(0)}°`],
                  ["FUEL",   `${a.fuel_pct?.toFixed(0)}%`],
                  ["AMMO",   `${a.ammo_pct?.toFixed(0)}%`],
                  ["STATUS", a.status],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                    <span style={{color:"#2d6a3d"}}>{k}</span>
                    <span style={{color:"#4ade80",fontWeight:700}}>{v}</span>
                  </div>
                ))}
                {(a.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
                  <div key={z.zoneId} style={{
                    marginTop:4,fontSize:9,color:z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD"?"#ef4444":"#f97316",
                    letterSpacing:0.5,
                  }}>▶ IN {z.zoneType}: {z.zoneName}</div>
                ))}
              </div>
            );
          })()}

          {/* ── Path result HUD */}
          {tracker.pathResult && (
            <div style={{
              position:"absolute", bottom:16, right:16, zIndex:500,
              background:"rgba(2,12,4,.95)", border:"1px solid #facc1566",
              borderRadius:4, padding:"10px 14px",
              backdropFilter:"blur(8px)", minWidth:180,
            }}>
              <div style={{fontSize:9,fontWeight:700,color:"#facc15",letterSpacing:2,marginBottom:6}}>PATH · {tracker.pathResult.algo}</div>
              {[
                ["DIST",   `${tracker.pathResult.distance_km?.toFixed(2)} km`],
                ["WPTs",   tracker.pathResult.waypoints?.length],
                ["NODES",  tracker.pathResult.nodes_visited],
                ["TIME",   `${tracker.pathResult.compute_ms?.toFixed(1)}ms`],
                ["GRID",   `${tracker.pathResult.grid_size}×${tracker.pathResult.grid_size}`],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                  <span style={{color:"#6b7280"}}>{k}</span>
                  <span style={{color:"#facc15",fontWeight:700}}>{v}</span>
                </div>
              ))}
              <button onClick={()=>tracker.setPathResult(null)} style={{
                marginTop:6,width:"100%",background:"transparent",border:"1px solid #374151",
                color:"#6b7280",borderRadius:2,padding:"3px",fontSize:9,cursor:"pointer",fontFamily:"inherit",
              }}>CLEAR PATH</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#020c04}
        ::-webkit-scrollbar-thumb{background:#1a3a1a;border-radius:2px}
        select option{background:#020c04;color:#4ade80}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      `}</style>
    </div>
  );
}
