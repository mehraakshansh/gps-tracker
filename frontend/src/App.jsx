import React, { useState, useCallback, useRef, useEffect as _ue } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import AuthScreen from "./components/AuthScreen";
import { useTracker } from "./hooks/useTracker";
import { useAuth } from "./hooks/useAuth";

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

// ── Command Console ─────────────────────────────────────────────────────────
function CommandConsole({ onExec }) {
  const [open, setOpen]     = useState(false);
  const [input, setInput]   = useState("");
  const [hist, setHist]     = useState([{ ok:true, text:"BRCS COMMAND INTERFACE v4.0 — TYPE help FOR COMMANDS", ts:"" }]);
  const [cmdHist, setCmdHist] = useState([]);
  const [cmdIdx,  setCmdIdx]  = useState(-1);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  _ue(() => { if (open) setTimeout(()=>inputRef.current?.focus(), 50); }, [open]);
  _ue(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [hist]);

  const submit = async e => {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input.trim();
    const ts = new Date().toLocaleTimeString("en-IN",{hour12:false});
    setHist(h=>[...h,{ok:true,text:`> ${cmd}`,ts,dim:true}]);
    setCmdHist(p=>[cmd,...p.slice(0,29)]);
    setCmdIdx(-1); setInput("");
    const result = await onExec(cmd);
    if (result.msg==="__CLEAR__") { setHist([{ok:true,text:"Console cleared.",ts}]); return; }
    setHist(h=>[...h,{ok:result.ok,text:result.msg,ts}]);
  };

  const handleKey = e => {
    if (e.key==="ArrowUp"){e.preventDefault();const ni=Math.min(cmdIdx+1,cmdHist.length-1);setCmdIdx(ni);setInput(cmdHist[ni]??"");}
    if (e.key==="ArrowDown"){e.preventDefault();const ni=Math.max(cmdIdx-1,-1);setCmdIdx(ni);setInput(ni===-1?"":cmdHist[ni]);}
    if (e.key==="Escape") setOpen(false);
  };

  return (
    <>
      <button onClick={()=>setOpen(o=>!o)} style={{
        position:"absolute",bottom:open?216:14,right:14,zIndex:600,
        background:"rgba(1,10,3,.92)",border:`1px solid ${open?"#ef444433":"#162916"}`,
        color:open?"#ef4444":"#22c55e",borderRadius:3,padding:"4px 12px",
        fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"'Courier New',monospace",
        letterSpacing:1.5,transition:"bottom .2s",
      }}>{open?"✕ CLOSE":"▶ COMMAND CONSOLE"}</button>

      {open && (
        <div style={{
          position:"absolute",bottom:0,left:0,right:0,zIndex:590,
          height:210,background:"rgba(0,8,2,.97)",borderTop:"1px solid #22c55e22",
          display:"flex",flexDirection:"column",fontFamily:"'Courier New',monospace",
        }}>
          <div style={{height:22,flexShrink:0,background:"#050e05",borderBottom:"1px solid #0d1e0d",padding:"0 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:8,color:"#3d7a3d",letterSpacing:2,fontWeight:700}}>◈ BRCS TACTICAL CONSOLE</span>
            <span style={{fontSize:7,color:"#1a4a1a"}}>↑↓ history · ESC close</span>
          </div>
          <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"6px 12px"}}>
            {hist.map((h,i)=>(
              <div key={i} style={{fontSize:10,lineHeight:1.6,color:h.dim?"#2d5a2d":h.ok?"#4ade80":"#ef4444",display:"flex",gap:8}}>
                {h.ts&&<span style={{color:"#1a3a1a",flexShrink:0}}>[{h.ts}]</span>}
                <span>{h.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={submit} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",borderTop:"1px solid #0d1e0d",flexShrink:0}}>
            <span style={{fontSize:11,color:"#22c55e",flexShrink:0}}>BRCS›</span>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="type a command..." style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#4ade80",fontSize:11,fontFamily:"'Courier New',monospace",caretColor:"#22c55e"}}/>
            <button type="submit" style={{background:"transparent",border:"1px solid #162916",color:"#22c55e",borderRadius:2,padding:"2px 8px",fontSize:8,cursor:"pointer",fontFamily:"inherit",letterSpacing:1}}>EXEC</button>
          </form>
        </div>
      )}
    </>
  );
}

export default function App() {
  const auth    = useAuth();
  const tracker = useTracker();
  const [selectedAsset,  setSelectedAsset]  = useState(null);
  const [selectedConvoy, setSelectedConvoy] = useState(null);
  const [clock,          setClock]          = useState(new Date());
  const [activeCmd,      setActiveCmd]      = useState("ALL");
  const [activeSector,   setActiveSector]   = useState("ALL");
  const [fogOfWar,       setFogOfWar]       = useState(true);
  const [orderMode,      setOrderMode]      = useState(null); // { assetId, callsign, waypoints:[] }

  _ue(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Must be before any conditional returns — Rules of Hooks
  const handleCmdChange = useCallback((cmd) => {
    setActiveCmd(cmd);
    setActiveSector(cmd);
  }, []);

  const handleExecCommand = useCallback(async (cmd) => {
    const result = await tracker.executeCommand(cmd);
    // Intercept ORDER command to enter order mode
    if (result.ok && result.msg?.startsWith("__ORDER__:")) {
      const [, assetId, callsign] = result.msg.split(":");
      setOrderMode({ assetId, callsign, waypoints: [] });
      setSelectedAsset(assetId);
      return { ok: true, msg: `◈ ORDER MODE — ${callsign} selected. Click map to set waypoints. Type CONFIRM or CANCEL.` };
    }
    if (result.ok && result.msg === "CONFIRM" && orderMode) {
      // handled below
    }
    return result;
  }, [tracker, orderMode]);

  if (auth.loading) {
    return (
      <div style={{position:"fixed",inset:0,background:"#000d02",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",color:"#22c55e"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:16,filter:"drop-shadow(0 0 20px #22c55e)"}}>🛡️</div>
          <div style={{fontSize:10,letterSpacing:3,animation:"statusPulse 1s infinite"}}>AUTHENTICATING...</div>
        </div>
        <style>{`@keyframes statusPulse{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
      </div>
    );
  }

  if (!auth.session) {
    return <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} onOAuth={auth.signInWithOAuth} authError={auth.authError}/>;
  }

  const pad = n => String(n).padStart(2,"0");
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
  const dateStr = clock.toLocaleDateString("en-IN",{ day:"2-digit", month:"short", year:"numeric" });

  const ms         = tracker.matchState;
  const bravoLive  = (tracker.assets||[]).filter(a => a.faction === "BRAVO" && !a.is_destroyed).length;
  const alphaLive  = (tracker.assets||[]).filter(a => a.faction === "ALPHA" && !a.is_destroyed).length;
  const critCount  = (tracker.alerts||[]).filter(a => a.severity==="CRITICAL"||a.severity==="EMERGENCY").length;
  const inHostile = (tracker.assets||[]).filter(a => (a.zoneStatus||[]).some(z=>z.zoneType==="HOSTILE"&&z.state==="IN")).length;
  const haltedCount = (tracker.assets||[]).filter(a => ["HALTED","MAINTENANCE","DISABLED"].includes((a.status||"").toUpperCase())).length;
  const engagedCount = (tracker.assets||[]).filter(a => (a.status||"").toUpperCase()==="ENGAGED").length;

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
          selectedConvoyId={selectedConvoy}
          onSelectConvoy={setSelectedConvoy}
          activeCmd={activeCmd}
          onCmdChange={handleCmdChange}
          activeSector={activeSector}
          onSectorChange={setActiveSector}
          onSignOut={auth.signOut}
          user={auth.user}
        />

        <div style={{ flex:1, position:"relative", display:"flex", flexDirection:"column" }}>
          <MapView
            assets={tracker.assets}
            zones={tracker.zones}
            pathResult={tracker.pathResult}
            simResult={tracker.simResult}
            simObjective={tracker.simObjective}
            convoys={tracker.convoys}
            selectedConvoyId={selectedConvoy}
            selectedAssetId={selectedAsset}
            onAssetClick={setSelectedAsset}
            activeSector={activeSector}
            fogOfWar={fogOfWar}
            orderMode={orderMode}
            onMapClick={orderMode ? (latlng) => {
              setOrderMode(prev => ({
                ...prev,
                waypoints: [...prev.waypoints, { lat: latlng.lat, lon: latlng.lng }],
              }));
            } : null}
          />

          {/* ── War Scoreboard HUD (top-left over map) */}
          {ms && (
            <div style={{
              position:"absolute", top:10, left:10, zIndex:500,
              background:"rgba(1,10,3,.95)", border:"1px solid #22c55e22",
              borderRadius:4, padding:"8px 12px", minWidth:200,
              backdropFilter:"blur(6px)", fontFamily:"'Courier New',monospace",
            }}>
              {/* Status banner */}
              <div style={{
                textAlign:"center", fontSize:8, fontWeight:700, letterSpacing:2,
                color: ms.status === "BRAVO_WINS" ? "#22c55e" : ms.status === "ALPHA_WINS" ? "#ef4444" : "#f97316",
                marginBottom:6, padding:"2px 0",
                background: ms.status !== "ACTIVE" ? (ms.status === "BRAVO_WINS" ? "#22c55e18" : "#ef444418") : "transparent",
                borderRadius:2,
              }}>{ms.status === "ACTIVE" ? "◈ BATTLE ACTIVE" : ms.status === "BRAVO_WINS" ? "★ BRAVO WINS" : ms.status === "ALPHA_WINS" ? "✦ ALPHA WINS" : "DRAW"}</div>

              {/* Score bars */}
              {[
                { label:"BRAVO", score: ms.bravo_score ?? 0, color:"#22c55e", live: bravoLive, killed: ms.alpha_assets_destroyed ?? 0, zones: ms.zones_controlled_bravo ?? 0 },
                { label:"ALPHA", score: ms.alpha_score ?? 0, color:"#ef4444", live: alphaLive, killed: ms.bravo_assets_destroyed ?? 0, zones: ms.zones_controlled_alpha ?? 0 },
              ].map(f => (
                <div key={f.label} style={{ marginBottom:6 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:2 }}>
                    <span style={{ color:f.color, fontWeight:700 }}>{f.label}</span>
                    <span style={{ color:f.color }}>{f.score.toLocaleString()} pts</span>
                  </div>
                  <div style={{ background:"#0a0f0a", borderRadius:2, height:4, overflow:"hidden" }}>
                    <div style={{
                      height:"100%", background:f.color, opacity:0.8,
                      width:`${Math.min(100, f.score / 50)}%`, transition:"width .5s",
                    }}/>
                  </div>
                  <div style={{ display:"flex", gap:10, fontSize:7.5, color:"#2d5a2d", marginTop:2 }}>
                    <span>LIVE <b style={{color:f.color}}>{f.live}</b></span>
                    <span>KILLS <b style={{color:f.color}}>{f.killed}</b></span>
                    <span>ZONES <b style={{color:f.color}}>{f.zones}</b></span>
                  </div>
                </div>
              ))}

              {/* Fog of war toggle */}
              <button onClick={()=>setFogOfWar(v=>!v)} style={{
                marginTop:2, width:"100%", background: fogOfWar ? "#22c55e18" : "transparent",
                border:`1px solid ${fogOfWar?"#22c55e44":"#162916"}`,
                color: fogOfWar ? "#22c55e" : "#2d4a2d",
                borderRadius:2, padding:"3px 0", fontSize:7, fontWeight:700,
                cursor:"pointer", fontFamily:"inherit", letterSpacing:1,
              }}>{fogOfWar ? "👁 FOG OF WAR ON" : "👁 FOG OF WAR OFF"}</button>
            </div>
          )}

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
            const isAlpha   = a.faction === "ALPHA";
            const tCol      = a.is_destroyed ? "#444444"
                            : isAlpha        ? "#ef4444"
                            : {GREEN:"#22c55e",YELLOW:"#eab308",ORANGE:"#f97316",RED:"#ef4444"}[a.threat_level]||"#22c55e";
            const statusUpper = (a.status||"ACTIVE").toUpperCase();
            const isHalted  = a.is_destroyed || ["HALTED","MAINTENANCE","DISABLED"].includes(statusUpper);
            const hpPct     = a.max_hp ? Math.round((a.hp ?? a.max_hp) / a.max_hp * 100) : 100;
            const hpColor   = a.is_destroyed ? "#444" : hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f97316" : "#ef4444";
            return (
              <div style={{
                position:"absolute", bottom:14, left:14, zIndex:500,
                background:"rgba(1,10,3,.96)", border:`1px solid ${tCol}`,
                borderRadius:4, padding:"10px 14px", minWidth:220,
                backdropFilter:"blur(8px)",
                boxShadow:`0 0 20px ${tCol}22`,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:26, filter:`drop-shadow(0 0 6px ${tCol})${a.is_destroyed?" grayscale(1) brightness(.4)":""}` }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:tCol, letterSpacing:2 }}>{a.callsign}</div>
                    <div style={{ fontSize:7, color:"#2d5a2d" }}>{a.name}</div>
                    <div style={{ fontSize:7, color: isAlpha?"#ef4444":"#22c55e", letterSpacing:1 }}>{a.faction ?? "BRAVO"}{a.is_destroyed?" · KIA":""}</div>
                  </div>
                  <button onClick={()=>setSelectedAsset(null)} style={{ marginLeft:"auto",background:"transparent",border:"none",color:"#2d4a2d",cursor:"pointer",fontSize:14 }}>✕</button>
                </div>
                {/* HP Bar */}
                <div style={{ marginBottom:6 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:7.5, marginBottom:2 }}>
                    <span style={{ color:"#2d6a3d" }}>HP</span>
                    <span style={{ color:hpColor, fontWeight:700 }}>{a.is_destroyed ? "DESTROYED" : `${a.hp ?? "?"}/${a.max_hp ?? "?"}`}</span>
                  </div>
                  <div style={{ background:"#0a0f0a", borderRadius:2, height:5, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${a.is_destroyed?0:hpPct}%`, background:hpColor, transition:"width .4s" }}/>
                  </div>
                </div>
                {[
                  ["SPEED",   `${a.current_speed?.toFixed(1)} km/h`],
                  ["HEADING", `${a.current_heading?.toFixed(0)}°`],
                  ["FUEL",    `${a.fuel_pct?.toFixed(0)}%`],
                  ["STATUS",  statusUpper],
                  ["ATTACK",  `${a.attack_power ?? 0}dmg / ${a.range_km ?? 0}km`],
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
                {!isAlpha && !a.is_destroyed && (
                  <button
                    onClick={() => {
                      setOrderMode({ assetId: a.id, callsign: a.callsign ?? a.name, waypoints: [] });
                    }}
                    style={{
                      marginTop:8, width:"100%",
                      background: orderMode?.assetId === a.id ? "#facc1522" : "transparent",
                      border:`1px solid ${orderMode?.assetId === a.id ? "#facc15" : "#22c55e44"}`,
                      color: orderMode?.assetId === a.id ? "#facc15" : "#22c55e",
                      borderRadius:2, padding:"4px 0", fontSize:7.5, fontWeight:700,
                      cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1.5,
                    }}
                  >{orderMode?.assetId === a.id ? "🎯 ISSUING ORDERS..." : "▶ ISSUE MOVEMENT ORDER"}</button>
                )}
              </div>
            );
          })()}

          {/* ── Path result HUD */}
          {tracker.pathResult && (
            <div style={{
              position:"absolute", bottom:14, right:14, zIndex:500,
              background:"rgba(1,10,3,.97)", border:"1px solid #facc1533",
              borderRadius:4, padding:"10px 14px",
              backdropFilter:"blur(8px)", minWidth:170,
            }}>
              <div style={{ fontSize:7.5, fontWeight:700, color:"#facc15", letterSpacing:2, marginBottom:6 }}>
                PATH · {tracker.pathResult.algo ?? tracker.pathResult.algorithm}
              </div>
              {[
                ["DISTANCE",  `${tracker.pathResult.distance_km?.toFixed(2)} km`],
                ["WAYPOINTS", tracker.pathResult.waypoints?.length],
                ["NODES",     tracker.pathResult.nodes_visited],
                ["COMPUTE",   `${tracker.pathResult.compute_ms?.toFixed(1)} ms`],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:2 }}>
                  <span style={{ color:"#2d5a2d" }}>{k}</span>
                  <span style={{ color:"#facc15", fontWeight:700 }}>{v}</span>
                </div>
              ))}
              <button onClick={()=>tracker.setPathResult(null)} style={{
                marginTop:6, width:"100%", background:"transparent",
                border:"1px solid #162916", color:"#1a3a1a",
                borderRadius:2, padding:"3px", fontSize:7.5,
                cursor:"pointer", fontFamily:"inherit",
              }}>CLEAR PATH</button>
            </div>
          )}

          {/* ── Order Mode HUD ──────────────────────────────── */}
          {orderMode && (
            <div style={{
              position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
              zIndex:600, pointerEvents:"none",
              fontFamily:"'Courier New',monospace", fontSize:11, color:"#facc15",
              textAlign:"center", letterSpacing:1,
              textShadow:"0 0 12px #facc15",
            }}>
              <div style={{ fontSize:9, opacity:.8 }}>CLICK MAP TO ADD WAYPOINTS</div>
              <div style={{ fontSize:8, color:"#4ade80", marginTop:3 }}>
                {orderMode.waypoints.length} waypoint{orderMode.waypoints.length !== 1 ? "s" : ""} set
              </div>
            </div>
          )}
          {orderMode && (
            <div style={{
              position:"absolute", top:10, left:"50%", transform:"translateX(-50%)",
              zIndex:600, background:"rgba(1,10,3,.97)", border:"1px solid #facc1566",
              borderRadius:4, padding:"8px 16px", display:"flex", alignItems:"center", gap:12,
              fontFamily:"'Courier New',monospace", boxShadow:"0 0 20px #facc1533",
            }}>
              <span style={{ fontSize:12 }}>🎯</span>
              <div>
                <div style={{ fontSize:9, color:"#facc15", fontWeight:700, letterSpacing:1.5 }}>
                  ORDER MODE — {orderMode.callsign}
                </div>
                <div style={{ fontSize:7.5, color:"#2d5a2d" }}>
                  Click map to add waypoints · {orderMode.waypoints.length} set
                </div>
              </div>
              <button
                onClick={async () => {
                  if (orderMode.waypoints.length === 0) { setOrderMode(null); return; }
                  try {
                    await tracker.issueOrder(orderMode.assetId, orderMode.waypoints);
                    setOrderMode(null);
                  } catch(e) { console.error(e); }
                }}
                style={{
                  background:"#22c55e22", border:"1px solid #22c55e66", color:"#22c55e",
                  borderRadius:2, padding:"4px 12px", fontSize:8, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit", letterSpacing:1,
                }}>CONFIRM ✓</button>
              <button
                onClick={() => setOrderMode(null)}
                style={{
                  background:"transparent", border:"1px solid #ef444466", color:"#ef4444",
                  borderRadius:2, padding:"4px 10px", fontSize:8, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit", letterSpacing:1,
                }}>CANCEL ✕</button>
            </div>
          )}

          {/* ── Command Console ─────────────────────────────── */}
          <CommandConsole onExec={handleExecCommand}/>
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
