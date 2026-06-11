import React, { useState, useCallback } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import { useTracker } from "./hooks/useTracker";

const SEV_COLOR = { CRITICAL:"#ef4444", WARNING:"#f97316", INFO:"#22c55e", EMERGENCY:"#a855f7" };
const SVC_ICON  = { ARMY:"⚔️", AIR_FORCE:"✈️", NAVY:"⚓", SPECIAL_FORCES:"🪖" };
const SVC_COLOR = { ARMY:"#22c55e", AIR_FORCE:"#38bdf8", NAVY:"#0ea5e9", SPECIAL_FORCES:"#f59e0b" };

const SECTOR_LABELS = {
  ALL:"ALL INDIA",
  WESTERN:"WESTERN CMD", SW:"SW CMD", NORTHERN:"NORTHERN CMD",
  EASTERN:"EASTERN CMD", SOUTHERN:"SOUTHERN CMD", CENTRAL:"CENTRAL CMD",
  WAC:"W. AIR CMD", SWAC:"SW AIR CMD", CAC:"C. AIR CMD", EAC:"E. AIR CMD", SAC:"S. AIR CMD",
  WNC:"W. NAVAL", ENC:"E. NAVAL", SNC:"S. NAVAL",
  SFC:"SF CMD",
};

export default function App() {
  const tracker      = useTracker();
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [clock,         setClock]         = useState(new Date());
  const [activeCmd,     setActiveCmd]     = useState("ALL");
  const [activeSector,  setActiveSector]  = useState("ALL");

  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCmdChange = useCallback((cmd) => {
    setActiveCmd(cmd);
    setActiveSector(cmd); // Mirror to MapView for pan-to
  }, []);

  const pad = n => String(n).padStart(2,"0");
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
  const dateStr = clock.toLocaleDateString("en-IN",{ day:"2-digit", month:"short", year:"numeric" });

  const critCount = tracker.alerts.filter(a => a.severity==="CRITICAL"||a.severity==="EMERGENCY").length;
  const inHostile = tracker.assets.filter(a => (a.zoneStatus||[]).some(z=>z.zoneType==="HOSTILE"&&z.state==="IN")).length;
  const haltedCount = tracker.assets.filter(a => ["HALTED","MAINTENANCE","DISABLED"].includes((a.status||"").toUpperCase())).length;
  const engagedCount = tracker.assets.filter(a => (a.status||"").toUpperCase()==="ENGAGED").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#010a03", overflow:"hidden", fontFamily:"'Courier New',monospace" }}>

      {/* ── TOP COMMAND BAR ──────────────────────────────────── */}
      <div style={{
        height:50, flexShrink:0,
        background:"linear-gradient(90deg,#060f06,#091509,#060f06)",
        borderBottom:"1px solid #162916",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 16px", gap:12,
      }}>
        {/* Left: Branding + active command */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:20, filter:"drop-shadow(0 0 8px #22c55e)" }}>🛡️</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#22c55e", letterSpacing:3, lineHeight:1 }}>BRCS</div>
            <div style={{ fontSize:7, color:"#2d5a2d", letterSpacing:2 }}>BHARAT RAKSHA COMMAND SYSTEM</div>
          </div>
          <div style={{ width:1, height:26, background:"#162916", marginLeft:4 }}/>
          <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
            <div style={{ fontSize:8, color:"#3d7a3d", letterSpacing:1.5, fontWeight:700 }}>
              {SECTOR_LABELS[activeCmd] || "ALL INDIA"}
            </div>
            <div style={{ fontSize:7, color:"#2d4a2d" }}>INTEGRATED BATTLE MANAGEMENT</div>
          </div>
        </div>

        {/* Center: Live stats */}
        <div style={{ display:"flex", gap:5 }}>
          {[
            { label:"ASSETS",   value:(tracker.assets||[]).length,                 color:"#22c55e" },
            { label:"ENGAGED",  value:engagedCount,                                color:engagedCount>0?"#f97316":"#22c55e" },
            { label:"HALTED",   value:haltedCount,                                 color:haltedCount>0?"#ef4444":"#22c55e" },
            { label:"HOSTILE",  value:inHostile,                                   color:inHostile>0?"#ef4444":"#22c55e" },
            { label:"ALERTS",   value:(tracker.alerts||[]).length,                 color:critCount>0?"#ef4444":"#f97316" },
            { label:"ZONES",    value:(tracker.zones||[]).length,                  color:"#38bdf8" },
          ].map(s => (
            <div key={s.label} style={{
              background:"#060f06", border:`1px solid ${s.color}2a`,
              borderRadius:3, padding:"2px 8px", textAlign:"center", minWidth:48,
            }}>
              <div style={{ fontSize:15, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:6, color:"#2d4a2d", letterSpacing:0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Right: Clock + connection */}
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#22c55e", letterSpacing:2, fontVariantNumeric:"tabular-nums" }}>{timeStr}</div>
            <div style={{ fontSize:7, color:"#2d4a2d", letterSpacing:1 }}>{dateStr} IST</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{
                width:7, height:7, borderRadius:"50%",
                background: tracker.connected ? "#22c55e" : "#ef4444",
                boxShadow: tracker.connected ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
                animation: tracker.connected ? "statusPulse 1.5s ease-in-out infinite" : "none",
              }}/>
              <span style={{ fontSize:8, fontWeight:700, color:tracker.connected?"#22c55e":"#ef4444", letterSpacing:1 }}>
                {tracker.connected ? "UPLINK" : "OFFLINE"}
              </span>
            </div>
            {tracker.connected && (
              <span style={{ fontSize:7, color:"#1a4a1a" }}>{tracker.tickMs}ms</span>
            )}
          </div>
        </div>
      </div>

      {/* ── ALERT TICKER ────────────────────────────────────── */}
      {critCount > 0 && (
        <div style={{
          height:26, flexShrink:0,
          background:"#ef444409", borderBottom:"1px solid #ef444433",
          display:"flex", alignItems:"center", overflow:"hidden",
        }}>
          <div style={{
            flexShrink:0, background:"#ef4444", color:"white",
            fontSize:8, fontWeight:700, padding:"0 10px", height:"100%",
            display:"flex", alignItems:"center", letterSpacing:1,
          }}>⚠ CRITICAL</div>
          <div style={{ display:"flex", gap:20, padding:"0 12px", overflow:"hidden" }}>
            {tracker.alerts
              .filter(a=>a.severity==="CRITICAL"||a.severity==="EMERGENCY")
              .slice(0,5)
              .map(a=>(
                <span key={a.id} style={{ fontSize:9, color:"#ef4444", whiteSpace:"nowrap", letterSpacing:0.5 }}>
                  {a.asset_icon} <b>{a.asset_name}</b> — {a.message}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* ── MAIN BODY ────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        <Sidebar
          {...tracker}
          selectedAssetId={selectedAsset}
          onSelectAsset={setSelectedAsset}
          activeCmd={activeCmd}
          onCmdChange={handleCmdChange}
          activeSector={activeSector}
          onSectorChange={setActiveSector}
        />

        <div style={{ flex:1, position:"relative", display:"flex", flexDirection:"column" }}>
          <MapView
            assets={tracker.assets}
            zones={tracker.zones}
            pathResult={tracker.pathResult}
            simResult={tracker.simResult}
            simObjective={tracker.simObjective}
            selectedAssetId={selectedAsset}
            onAssetClick={setSelectedAsset}
            activeSector={activeSector}
          />

          {/* ── Service HUD (top-right over map) */}
          <div style={{ position:"absolute", top:10, right:10, zIndex:500, display:"flex", flexDirection:"column", gap:3 }}>
            {Object.entries(SVC_ICON).map(([svc, icon]) => {
              const cnt = tracker.assets.filter(a=>a.service===svc).length;
              if (!cnt) return null;
              return (
                <div key={svc} style={{
                  background:"rgba(1,10,3,.92)", border:`1px solid ${SVC_COLOR[svc]}33`,
                  borderRadius:3, padding:"3px 9px",
                  display:"flex", alignItems:"center", gap:7,
                  backdropFilter:"blur(4px)",
                }}>
                  <span style={{ fontSize:13 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:SVC_COLOR[svc] }}>{cnt}</div>
                    <div style={{ fontSize:6, color:"#2d4a2d", letterSpacing:0.8 }}>{svc.replace("_"," ")}</div>
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
            const statusUpper = (a.status||"ACTIVE").toUpperCase();
            const isHalted = ["HALTED","MAINTENANCE","DISABLED"].includes(statusUpper);
            return (
              <div style={{
                position:"absolute", bottom:14, left:14, zIndex:500,
                background:"rgba(1,10,3,.96)", border:`1px solid ${tCol}`,
                borderRadius:4, padding:"10px 14px", minWidth:220,
                backdropFilter:"blur(8px)",
                boxShadow:`0 0 20px ${tCol}22`,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:26, filter:`drop-shadow(0 0 6px ${tCol})` }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#22c55e", letterSpacing:2 }}>{a.callsign}</div>
                    <div style={{ fontSize:8, color:"#2d5a2d" }}>{a.name}</div>
                  </div>
                  <button onClick={()=>setSelectedAsset(null)} style={{ marginLeft:"auto",background:"transparent",border:"none",color:"#2d4a2d",cursor:"pointer",fontSize:14 }}>✕</button>
                </div>
                {[
                  ["SPEED",   `${a.current_speed?.toFixed(1)} km/h`],
                  ["HEADING", `${a.current_heading?.toFixed(0)}°`],
                  ["FUEL",    `${a.fuel_pct?.toFixed(0)}%`],
                  ["AMMO",    `${a.ammo_pct?.toFixed(0)}%`],
                  ["STATUS",  statusUpper],
                  ["POS",     `${a.current_lat?.toFixed(4)}°N ${a.current_lon?.toFixed(4)}°E`],
                ].map(([k,v])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:2 }}>
                    <span style={{ color:"#2d6a3d" }}>{k}</span>
                    <span style={{ color: k==="STATUS" && isHalted ? "#ef4444" : "#4ade80", fontWeight:700 }}>{v}</span>
                  </div>
                ))}
                {(a.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
                  <div key={z.zoneId} style={{ marginTop:3, fontSize:8, color:z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD"?"#ef4444":"#f97316", letterSpacing:0.3 }}>
                    ▶ IN {z.zoneType}: {z.zoneName}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Path result HUD */}
          {tracker.pathResult && (
            <div style={{
              position:"absolute", bottom:14, right:14, zIndex:500,
              background:"rgba(1,10,3,.96)", border:"1px solid #facc1544",
              borderRadius:4, padding:"10px 14px",
              backdropFilter:"blur(8px)", minWidth:175,
              boxShadow:"0 0 16px #facc1522",
            }}>
              <div style={{ fontSize:8, fontWeight:700, color:"#facc15", letterSpacing:2, marginBottom:6 }}>
                PATH · {tracker.pathResult.algo ?? tracker.pathResult.algorithm}
              </div>
              {[
                ["DISTANCE", `${tracker.pathResult.distance_km?.toFixed(2)} km`],
                ["WAYPOINTS", tracker.pathResult.waypoints?.length],
                ["NODES",     tracker.pathResult.nodes_visited],
                ["COMPUTE",   `${tracker.pathResult.compute_ms?.toFixed(1)} ms`],
                ["GRID",      `${tracker.pathResult.grid_size}×${tracker.pathResult.grid_size}`],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:2 }}>
                  <span style={{ color:"#3d5a3d" }}>{k}</span>
                  <span style={{ color:"#facc15", fontWeight:700 }}>{v}</span>
                </div>
              ))}
              <button onClick={()=>tracker.setPathResult(null)} style={{
                marginTop:6, width:"100%", background:"transparent",
                border:"1px solid #162916", color:"#2d4a2d",
                borderRadius:2, padding:"3px", fontSize:8,
                cursor:"pointer", fontFamily:"inherit",
              }}>CLEAR PATH</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes statusPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-track { background:#010a03 }
        ::-webkit-scrollbar-thumb { background:#162916; border-radius:2px }
        select option { background:#010a03; color:#4ade80 }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none }
      `}</style>
    </div>
  );
}
