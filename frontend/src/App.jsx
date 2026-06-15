import React, { useState, useCallback, useRef, useEffect as _ue } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import AuthScreen from "./components/AuthScreen";
import { useTracker } from "./hooks/useTracker";
import { useAuth } from "./hooks/useAuth";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     "#060910",
  panel:  "rgba(6,9,16,0.97)",
  bravo:  "#00e5a0",
  alpha:  "#ff3355",
  gold:   "#fbbf24",
  purple: "#a78bfa",
  text:   "#e2e8f0",
  sub:    "#94a3b8",
  muted:  "#475569",
  dim:    "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.09)",
};

const SVC_COLOR = { ARMY:"#22c55e", AIR_FORCE:"#38bdf8", NAVY:"#0ea5e9", SPECIAL_FORCES:"#f59e0b" };
const SVC_ICON  = { ARMY:"⚔️", AIR_FORCE:"✈️", NAVY:"⚓", SPECIAL_FORCES:"🪖" };

// ── Toast system ──────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, ok = true) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, msg, ok }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}

function ToastLayer({ toasts }) {
  return (
    <div style={{
      position:"absolute", bottom:72, left:"50%", transform:"translateX(-50%)",
      zIndex:800, display:"flex", flexDirection:"column-reverse", gap:6,
      alignItems:"center", pointerEvents:"none",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.ok ? "rgba(0,229,160,0.12)" : "rgba(255,51,85,0.12)",
          border:`1px solid ${t.ok ? "#00e5a044" : "#ff335544"}`,
          color: t.ok ? C.bravo : C.alpha,
          borderRadius:8, padding:"8px 22px", fontSize:12, fontWeight:700,
          fontFamily:"'Courier New',monospace", letterSpacing:0.5,
          whiteSpace:"nowrap", maxWidth:500,
          backdropFilter:"blur(8px)",
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── Game Command Bar ──────────────────────────────────────────────────────────
function GameCommandBar({ selectedAsset, assets, onExec, clearAlerts, fogOfWar, setFogOfWar, orderMode, setOrderMode }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const asset = selectedAsset ? assets.find(a => a.id === selectedAsset) : null;
  const canOrder = asset && asset.faction !== "ALPHA" && !asset.is_destroyed;
  const isBravo  = asset && asset.faction !== "ALPHA";

  const doCmd = async cmd => {
    if (!cmd.trim()) return;
    await onExec(cmd);
    setInput("");
  };

  const btns = [
    { icon:"⊘",  label:"HALT",    color:"#ff3355", disabled:!isBravo, action:() => isBravo && doCmd(`HALT ${asset.callsign}`) },
    { icon:"⚡", label:"ENGAGE",  color:"#f97316", disabled:!isBravo, action:() => isBravo && doCmd(`ENGAGE ${asset.callsign}`) },
    { icon:"✅", label:"ACTIVE",  color:C.bravo,   disabled:!isBravo, action:() => isBravo && doCmd(`ACTIVE ${asset.callsign}`) },
    { icon:"🎯", label:"ORDER",   color:C.gold,    disabled:!canOrder, active:!!orderMode, action:() => canOrder && doCmd(`ORDER ${asset.callsign}`) },
    { icon: fogOfWar?"👁":"🌐", label:fogOfWar?"FOG ON":"FOG OFF", color:fogOfWar?C.bravo:C.muted, action:() => setFogOfWar(v=>!v) },
    { icon:"⟳",  label:"SEED",   color:C.purple,  action:() => doCmd("SEED") },
    { icon:"🗑",  label:"CLR LOG", color:C.muted,  action:clearAlerts },
  ];

  return (
    <div style={{
      position:"absolute", bottom:0, left:0, right:0, zIndex:600, height:62,
      background:"rgba(5,7,14,0.99)", borderTop:"1px solid rgba(255,255,255,0.07)",
      display:"flex", alignItems:"center", gap:8, padding:"0 14px",
    }}>
      {/* Quick-action buttons */}
      <div style={{ display:"flex", gap:5, flexShrink:0 }}>
        {btns.map((b, i) => (
          <button key={i} onClick={b.action} disabled={b.disabled} title={b.label} style={{
            background: b.active ? `${b.color}28` : b.disabled ? "transparent" : `${b.color}0e`,
            border:`1px solid ${b.disabled ? "rgba(255,255,255,0.05)" : b.active ? b.color : `${b.color}44`}`,
            color: b.disabled ? "#2a3240" : b.color,
            borderRadius:7, padding:"4px 9px", cursor:b.disabled?"not-allowed":"pointer",
            fontFamily:"'Courier New',monospace", fontSize:8, fontWeight:700, letterSpacing:0.8,
            display:"flex", flexDirection:"column", alignItems:"center", gap:1, minWidth:44,
            transition:"all .13s",
          }}>
            <span style={{ fontSize:14, lineHeight:1 }}>{b.icon}</span>
            <span>{b.label}</span>
          </button>
        ))}
      </div>

      <div style={{ width:1, height:34, background:"rgba(255,255,255,0.06)", flexShrink:0 }}/>

      {/* Text input */}
      <div style={{
        flex:1, display:"flex", alignItems:"center", gap:8,
        background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:7, padding:"0 12px", height:38,
      }}>
        <span style={{ fontSize:11, color:C.bravo, fontFamily:"'Courier New',monospace", flexShrink:0, fontWeight:700 }}>BRCS›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") doCmd(input);
            if (e.key === "Escape") setInput("");
          }}
          placeholder="type command — HALT, ENGAGE, ORDER, STATUS, LIST, HELP"
          style={{
            flex:1, background:"transparent", border:"none", outline:"none",
            color:C.text, fontSize:11, fontFamily:"'Courier New',monospace", caretColor:C.bravo,
          }}
        />
        {input && (
          <button onClick={() => doCmd(input)} style={{
            background:`${C.bravo}18`, border:`1px solid ${C.bravo}44`, color:C.bravo,
            borderRadius:5, padding:"3px 10px", fontSize:9, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1, flexShrink:0,
          }}>EXEC</button>
        )}
      </div>
    </div>
  );
}

// ── Selected Asset Card ───────────────────────────────────────────────────────
function AssetCard({ asset, onClose, onOrder, orderMode }) {
  if (!asset) return null;
  const isAlpha     = asset.faction === "ALPHA";
  const isDestroyed = asset.is_destroyed === true;
  const hpPct       = asset.max_hp ? Math.max(0, Math.round((asset.hp ?? asset.max_hp) / asset.max_hp * 100)) : 100;
  const hpColor     = isDestroyed ? "#444" : hpPct > 60 ? C.bravo : hpPct > 30 ? "#f97316" : C.alpha;
  const accent      = isDestroyed ? "#444" : isAlpha ? C.alpha : C.bravo;
  const statusUpper = (asset.status || "ACTIVE").toUpperCase();
  const isHalted    = ["HALTED","MAINTENANCE","DISABLED"].includes(statusUpper);

  return (
    <div style={{
      position:"absolute", bottom:72, left:"50%", transform:"translateX(-50%)",
      zIndex:550, background:"rgba(5,8,16,0.98)",
      border:`1px solid ${accent}55`, borderTop:`2px solid ${accent}`,
      borderRadius:10, padding:"14px 18px", minWidth:340, maxWidth:440,
      backdropFilter:"blur(16px)", boxShadow:`0 -2px 40px ${accent}15`,
      fontFamily:"'Courier New',monospace",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:10 }}>
        {/* Big icon */}
        <div style={{
          width:54, height:54, borderRadius:10, flexShrink:0,
          background:`${accent}14`, border:`1px solid ${accent}33`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:30,
          filter:isDestroyed?"grayscale(1) brightness(.35)":undefined,
        }}>{asset.icon}</div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:3 }}>
            <span style={{ fontSize:17, fontWeight:800, color:accent, letterSpacing:2 }}>{asset.callsign}</span>
            <span style={{
              fontSize:8, padding:"2px 8px", borderRadius:5,
              background:`${accent}18`, border:`1px solid ${accent}44`, color:accent, fontWeight:700, letterSpacing:1,
            }}>{isAlpha?"ALPHA":"BRAVO"}</span>
            {isDestroyed && <span style={{ fontSize:8, padding:"2px 7px", borderRadius:5, background:"#44444420", color:"#888", fontWeight:700 }}>KIA</span>}
            {isHalted && !isDestroyed && <span style={{ fontSize:8, padding:"2px 7px", borderRadius:5, background:`${C.alpha}18`, color:C.alpha, fontWeight:700 }}>HALT</span>}
          </div>
          <div style={{ fontSize:10, color:C.muted, marginBottom:7, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{asset.name}</div>

          {/* HP Bar */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:3 }}>
              <span style={{ color:C.muted, letterSpacing:1 }}>HEALTH</span>
              <span style={{ color:hpColor, fontWeight:700 }}>{isDestroyed?"DESTROYED":`${asset.hp??0} / ${asset.max_hp??0}`}</span>
            </div>
            <div style={{ height:7, background:"rgba(255,255,255,0.07)", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${isDestroyed?0:hpPct}%`, background:hpColor, borderRadius:4, transition:"width .4s ease" }}/>
            </div>
          </div>
        </div>

        <button onClick={onClose} style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:18, lineHeight:1, flexShrink:0, padding:0, marginTop:-2 }}>✕</button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:5, marginBottom:isAlpha||isDestroyed?0:10 }}>
        {[
          ["SPD",    `${asset.current_speed?.toFixed(0)??0}kmh`],
          ["HDG",    `${asset.current_heading?.toFixed(0)??0}°`],
          ["FUEL",   `${asset.fuel_pct?.toFixed(0)??100}%`],
          ["ATK",    `${asset.attack_power??0}`],
          ["RNG",    `${asset.range_km??0}km`],
          ["STATUS", statusUpper.slice(0,6)],
        ].map(([k,v]) => (
          <div key={k} style={{
            background:"rgba(255,255,255,0.04)", borderRadius:6, padding:"5px 3px", textAlign:"center",
            border:"1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize:7, color:C.muted, marginBottom:2, letterSpacing:0.5 }}>{k}</div>
            <div style={{ fontSize:9, color:k==="STATUS"&&isHalted?C.alpha:C.text, fontWeight:700 }}>{v}</div>
          </div>
        ))}
      </div>

      {!isAlpha && !isDestroyed && (
        <button onClick={onOrder} style={{
          width:"100%",
          background:orderMode?`${C.gold}20`:`${C.gold}0c`,
          border:`1px solid ${orderMode?C.gold:`${C.gold}44`}`,
          color:C.gold, borderRadius:7, padding:"9px 0",
          fontSize:11, fontWeight:700, cursor:"pointer",
          fontFamily:"'Courier New',monospace", letterSpacing:1.5, transition:"all .15s",
        }}>{orderMode?"🎯  ISSUING ORDERS...":"▶  ISSUE MOVEMENT ORDER"}</button>
      )}

      {(asset.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
        <div key={z.zoneId} style={{ marginTop:5, fontSize:8, color:z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD"?C.alpha:"#f97316", letterSpacing:0.3 }}>
          ▶ IN {z.zoneType}: {z.zoneName}
        </div>
      ))}
    </div>
  );
}

// ── Match HUD (Valorant-style top center) ─────────────────────────────────────
function MatchHUD({ ms, bravoLive, alphaLive }) {
  if (!ms) return null;
  const bScore = ms.bravo_score ?? 0;
  const aScore = ms.alpha_score ?? 0;
  const max    = Math.max(bScore, aScore, 500);
  const active = ms.status === "ACTIVE";

  return (
    <div style={{
      position:"absolute", top:10, left:"50%", transform:"translateX(-50%)",
      zIndex:500, fontFamily:"'Courier New',monospace", minWidth:320,
    }}>
      <div style={{
        background:"rgba(5,8,15,0.96)", border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:10, padding:"10px 18px", backdropFilter:"blur(12px)",
      }}>
        {/* Status pill */}
        <div style={{ textAlign:"center", marginBottom:8 }}>
          <span style={{
            fontSize:8, fontWeight:700, letterSpacing:2, padding:"3px 12px", borderRadius:20,
            background:active?"rgba(251,191,36,0.12)":ms.status==="BRAVO_WINS"?"rgba(0,229,160,0.14)":"rgba(255,51,85,0.14)",
            border:`1px solid ${active?`${C.gold}44`:ms.status==="BRAVO_WINS"?`${C.bravo}44`:`${C.alpha}44`}`,
            color:active?C.gold:ms.status==="BRAVO_WINS"?C.bravo:C.alpha,
          }}>
            {active?"● BATTLE ACTIVE":ms.status==="BRAVO_WINS"?"★ BRAVO VICTORY":"✦ ALPHA VICTORY"}
          </span>
        </div>

        {/* Score row */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* BRAVO */}
          <div style={{ flex:1, textAlign:"right" }}>
            <div style={{ fontSize:9, color:C.bravo, fontWeight:700, letterSpacing:2, marginBottom:2 }}>BRAVO</div>
            <div style={{ fontSize:22, fontWeight:800, color:C.bravo, letterSpacing:1, lineHeight:1 }}>{bScore.toLocaleString()}</div>
            <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>{bravoLive} alive · {ms.alpha_assets_destroyed??0} kills</div>
          </div>

          {/* VS divider */}
          <div style={{ textAlign:"center", flexShrink:0, padding:"0 4px" }}>
            <div style={{ fontSize:10, color:C.muted, fontWeight:700 }}>VS</div>
            {/* Progress bar */}
            <div style={{ width:60, height:4, background:"rgba(255,255,255,0.08)", borderRadius:2, marginTop:4, overflow:"hidden" }}>
              <div style={{
                height:"100%",
                width:`${Math.round(bScore/(bScore+aScore||1)*100)}%`,
                background:`linear-gradient(90deg,${C.bravo},${C.bravo}88)`,
                borderRadius:2, transition:"width .6s ease",
              }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.bravo }}/>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.alpha }}/>
            </div>
          </div>

          {/* ALPHA */}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:C.alpha, fontWeight:700, letterSpacing:2, marginBottom:2 }}>ALPHA</div>
            <div style={{ fontSize:22, fontWeight:800, color:C.alpha, letterSpacing:1, lineHeight:1 }}>{aScore.toLocaleString()}</div>
            <div style={{ fontSize:8, color:C.muted, marginTop:2 }}>{alphaLive} alive · {ms.bravo_assets_destroyed??0} kills</div>
          </div>
        </div>

        {/* Zone control row */}
        <div style={{ display:"flex", justifyContent:"center", gap:12, marginTop:8, paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize:8, color:C.bravo }}>ZONES: <b>{ms.zones_controlled_bravo??0}</b></span>
          <span style={{ fontSize:8, color:C.muted }}>·</span>
          <span style={{ fontSize:8, color:C.alpha }}>ZONES: <b>{ms.zones_controlled_alpha??0}</b></span>
        </div>
      </div>
    </div>
  );
}

// ── Order Mode Overlay ────────────────────────────────────────────────────────
function OrderOverlay({ orderMode, onConfirm, onCancel }) {
  if (!orderMode) return null;
  return (
    <>
      {/* Top banner */}
      <div style={{
        position:"absolute", top:10, left:"50%", transform:"translateX(-50%)",
        zIndex:700, background:"rgba(5,8,15,0.97)",
        border:`1px solid ${C.gold}66`, borderRadius:10,
        padding:"10px 20px", display:"flex", alignItems:"center", gap:14,
        fontFamily:"'Courier New',monospace", backdropFilter:"blur(12px)",
        boxShadow:`0 0 30px ${C.gold}22`,
        marginTop:100,
      }}>
        <span style={{ fontSize:20 }}>🎯</span>
        <div>
          <div style={{ fontSize:10, color:C.gold, fontWeight:700, letterSpacing:2 }}>ORDER MODE — {orderMode.callsign}</div>
          <div style={{ fontSize:8, color:C.muted }}>{orderMode.waypoints.length} waypoint{orderMode.waypoints.length!==1?"s":""} set · click map to add</div>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:8 }}>
          <button onClick={onConfirm} disabled={orderMode.waypoints.length===0} style={{
            background:`${C.bravo}20`, border:`1px solid ${C.bravo}66`, color:C.bravo,
            borderRadius:6, padding:"7px 16px", fontSize:10, fontWeight:700,
            cursor:orderMode.waypoints.length===0?"not-allowed":"pointer",
            fontFamily:"'Courier New',monospace", letterSpacing:1, opacity:orderMode.waypoints.length===0?0.4:1,
          }}>CONFIRM ✓</button>
          <button onClick={onCancel} style={{
            background:`${C.alpha}12`, border:`1px solid ${C.alpha}55`, color:C.alpha,
            borderRadius:6, padding:"7px 14px", fontSize:10, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1,
          }}>CANCEL</button>
        </div>
      </div>
      {/* Map hint */}
      <div style={{
        position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        zIndex:600, pointerEvents:"none", textAlign:"center", fontFamily:"'Courier New',monospace",
        color:C.gold, textShadow:`0 0 20px ${C.gold}`,
      }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5 }}>CLICK MAP TO ADD WAYPOINTS</div>
        <div style={{ fontSize:9, color:C.bravo, marginTop:4 }}>{orderMode.waypoints.length} point{orderMode.waypoints.length!==1?"s":""} planned</div>
      </div>
    </>
  );
}

// ── End-Game Overlay ──────────────────────────────────────────────────────────
function EndGameOverlay({ ms, bravoLive, alphaLive, onReset, onDismiss }) {
  if (!ms || ms.status === "ACTIVE") return null;
  const bravoWins = ms.status === "BRAVO_WINS";
  const accent = bravoWins ? C.bravo : C.alpha;
  const bScore = ms.bravo_score ?? 0;
  const aScore = ms.alpha_score ?? 0;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:900,
      background:"rgba(0,0,0,0.88)", backdropFilter:"blur(6px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Courier New',monospace",
    }}>
      <div style={{
        background:"rgba(6,9,16,0.99)", border:`1px solid ${accent}55`,
        borderTop:`3px solid ${accent}`, borderRadius:14, padding:"36px 48px",
        maxWidth:520, width:"90%", textAlign:"center",
        boxShadow:`0 0 80px ${accent}18`,
      }}>
        <div style={{ fontSize:52, marginBottom:10 }}>{bravoWins?"🛡️":"⚔️"}</div>
        <div style={{ fontSize:24, fontWeight:800, color:accent, letterSpacing:4, marginBottom:4, textShadow:`0 0 30px ${accent}88` }}>
          {bravoWins ? "★ BRAVO VICTORY" : "✦ ALPHA VICTORY"}
        </div>
        <div style={{ fontSize:9, color:C.muted, letterSpacing:3, marginBottom:28 }}>
          {bravoWins?"INDIA PREVAILS — MISSION ACCOMPLISHED":"ALPHA FORCES VICTORIOUS — STAND DOWN"}
        </div>

        {/* Score cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:10, alignItems:"center", marginBottom:20 }}>
          {/* BRAVO */}
          <div style={{
            background:bravoWins?`${C.bravo}10`:"rgba(255,255,255,0.03)",
            border:`1px solid ${bravoWins?`${C.bravo}44`:"rgba(255,255,255,0.07)"}`,
            borderRadius:10, padding:"14px 10px",
          }}>
            <div style={{ fontSize:9, color:C.bravo, letterSpacing:2, marginBottom:6 }}>BRAVO</div>
            <div style={{ fontSize:30, fontWeight:800, color:C.bravo, marginBottom:4 }}>{bScore.toLocaleString()}</div>
            <div style={{ fontSize:7, color:C.muted }}>POINTS</div>
            <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:3 }}>
              {[["KILLS",(ms.alpha_assets_destroyed??0)],["ZONES",(ms.zones_controlled_bravo??0)],["ALIVE",bravoLive]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9 }}>
                  <span style={{ color:C.muted }}>{k}</span>
                  <span style={{ color:C.bravo, fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize:12, color:"rgba(255,255,255,0.1)", fontWeight:700 }}>VS</div>

          {/* ALPHA */}
          <div style={{
            background:!bravoWins?`${C.alpha}10`:"rgba(255,255,255,0.03)",
            border:`1px solid ${!bravoWins?`${C.alpha}44`:"rgba(255,255,255,0.07)"}`,
            borderRadius:10, padding:"14px 10px",
          }}>
            <div style={{ fontSize:9, color:C.alpha, letterSpacing:2, marginBottom:6 }}>ALPHA</div>
            <div style={{ fontSize:30, fontWeight:800, color:C.alpha, marginBottom:4 }}>{aScore.toLocaleString()}</div>
            <div style={{ fontSize:7, color:C.muted }}>POINTS</div>
            <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:3 }}>
              {[["KILLS",(ms.bravo_assets_destroyed??0)],["ZONES",(ms.zones_controlled_alpha??0)],["ALIVE",alphaLive]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9 }}>
                  <span style={{ color:C.muted }}>{k}</span>
                  <span style={{ color:C.alpha, fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Margin bar */}
        <div style={{
          background:`${accent}14`, border:`1px solid ${accent}33`,
          borderRadius:6, padding:"8px 0", marginBottom:22,
          fontSize:9, color:accent, fontWeight:700, letterSpacing:1.5,
        }}>
          {bravoWins
            ? `BRAVO +${(bScore-aScore).toLocaleString()} pts · ${ms.alpha_assets_destroyed??0} enemy eliminated`
            : `ALPHA +${(aScore-bScore).toLocaleString()} pts · ${ms.bravo_assets_destroyed??0} BRAVO eliminated`}
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onReset} style={{
            background:`${C.bravo}18`, border:`1px solid ${C.bravo}66`, color:C.bravo,
            borderRadius:8, padding:"11px 28px", fontSize:11, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1.5,
          }}>⟳  RESET MATCH</button>
          <button onClick={onDismiss} style={{
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
            color:C.muted, borderRadius:8, padding:"11px 20px",
            fontSize:11, cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1,
          }}>INSPECT MAP</button>
        </div>

        <div style={{ marginTop:14, fontSize:8, color:"rgba(255,255,255,0.15)", letterSpacing:1 }}>
          RESET MATCH re-seeds all forces and restarts the simulation
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const auth    = useAuth();
  const tracker = useTracker();
  const [selectedAsset,  setSelectedAsset]  = useState(null);
  const [selectedConvoy, setSelectedConvoy] = useState(null);
  const [clock,          setClock]          = useState(new Date());
  const [activeCmd,      setActiveCmd]      = useState("ALL");
  const [activeSector,   setActiveSector]   = useState("ALL");
  const [fogOfWar,       setFogOfWar]       = useState(true);
  const [orderMode,      setOrderMode]      = useState(null);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const { toasts, add: addToast } = useToasts();

  _ue(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  _ue(() => {
    if (tracker.matchState?.status === "ACTIVE") setMatchDismissed(false);
  }, [tracker.matchState?.status]);

  const handleCmdChange = useCallback(cmd => {
    setActiveCmd(cmd);
    setActiveSector(cmd);
  }, []);

  const handleExecCommand = useCallback(async cmd => {
    const result = await tracker.executeCommand(cmd);
    if (result.ok && result.msg?.startsWith("__ORDER__:")) {
      const [, assetId, callsign] = result.msg.split(":");
      setOrderMode({ assetId, callsign, waypoints: [] });
      setSelectedAsset(assetId);
      addToast(`◈ ORDER MODE — ${callsign}. Click map to place waypoints.`, true);
      return result;
    }
    if (result.msg && result.msg !== "__CLEAR__") addToast(result.msg, result.ok);
    return result;
  }, [tracker, addToast]);

  if (auth.loading) {
    return (
      <div style={{ position:"fixed", inset:0, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Courier New',monospace" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16, filter:`drop-shadow(0 0 20px ${C.bravo})` }}>🛡️</div>
          <div style={{ fontSize:11, letterSpacing:3, color:C.bravo, animation:"pulse 1s infinite" }}>AUTHENTICATING...</div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
      </div>
    );
  }

  if (!auth.session) {
    return <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} onOAuth={auth.signInWithOAuth} authError={auth.authError}/>;
  }

  const pad = n => String(n).padStart(2,"0");
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;

  const ms         = tracker.matchState;
  const bravoLive  = (tracker.assets||[]).filter(a => a.faction==="BRAVO"&&!a.is_destroyed).length;
  const alphaLive  = (tracker.assets||[]).filter(a => a.faction==="ALPHA"&&!a.is_destroyed).length;
  const critCount  = (tracker.alerts||[]).filter(a => a.severity==="CRITICAL"||a.severity==="EMERGENCY").length;
  const selectedA  = selectedAsset ? (tracker.assets||[]).find(x=>x.id===selectedAsset) : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:C.bg, overflow:"hidden", fontFamily:"'Courier New',monospace" }}>

      {/* ── TOP BAR ──────────────────────────────────────────── */}
      <div style={{
        height:52, flexShrink:0, background:"rgba(5,8,14,0.99)",
        borderBottom:"1px solid rgba(255,255,255,0.07)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 16px", gap:12, zIndex:600,
      }}>
        {/* Left: Brand */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ fontSize:22, filter:`drop-shadow(0 0 10px ${C.bravo})` }}>🛡️</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.bravo, letterSpacing:4, lineHeight:1 }}>BRCS</div>
            <div style={{ fontSize:7, color:C.muted, letterSpacing:2 }}>BHARAT RAKSHA COMMAND SYSTEM</div>
          </div>
          <div style={{ width:1, height:28, background:"rgba(255,255,255,0.08)", marginLeft:6 }}/>
          <div style={{ fontSize:9, color:C.sub, letterSpacing:1 }}>{activeCmd==="ALL"?"ALL SECTORS":activeCmd}</div>
        </div>

        {/* Center: Live stat pills */}
        <div style={{ display:"flex", gap:5 }}>
          {[
            { label:"ASSETS",  value:(tracker.assets||[]).length, color:C.bravo },
            { label:"ENGAGED", value:(tracker.assets||[]).filter(a=>(a.status||"").toUpperCase()==="ENGAGED").length, color:"#f97316" },
            { label:"HALTED",  value:(tracker.assets||[]).filter(a=>["HALTED","MAINTENANCE","DISABLED"].includes((a.status||"").toUpperCase())).length, color:C.alpha },
            { label:"ALERTS",  value:(tracker.alerts||[]).length, color:critCount>0?C.alpha:"#f97316" },
            { label:"ZONES",   value:(tracker.zones||[]).length,  color:"#38bdf8" },
          ].map(s => (
            <div key={s.label} style={{
              background:`${s.color}0d`, border:`1px solid ${s.color}2a`,
              borderRadius:6, padding:"3px 10px", textAlign:"center", minWidth:52,
            }}>
              <div style={{ fontSize:16, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:7, color:C.muted, letterSpacing:0.8, marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Right: Clock + status */}
        <div style={{ display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:16, fontWeight:700, color:C.text, letterSpacing:2, fontVariantNumeric:"tabular-nums" }}>{timeStr}</div>
            <div style={{ fontSize:7, color:C.muted, letterSpacing:1 }}>{clock.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})} IST</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{
              width:8, height:8, borderRadius:"50%",
              background:tracker.connected?C.bravo:C.alpha,
              boxShadow:tracker.connected?`0 0 8px ${C.bravo}`:`0 0 8px ${C.alpha}`,
              animation:tracker.connected?"pulse 1.5s ease-in-out infinite":"none",
            }}/>
            <span style={{ fontSize:9, fontWeight:700, color:tracker.connected?C.bravo:C.alpha, letterSpacing:1 }}>
              {tracker.connected?"LIVE":"OFFLINE"}
            </span>
            {tracker.connected && <span style={{ fontSize:7, color:C.muted }}>{tracker.tickMs}ms</span>}
          </div>
        </div>
      </div>

      {/* ── ALERT TICKER ──────────────────────────────────────── */}
      {critCount > 0 && (
        <div style={{
          height:28, flexShrink:0,
          background:"rgba(255,51,85,0.07)", borderBottom:"1px solid rgba(255,51,85,0.25)",
          display:"flex", alignItems:"center", overflow:"hidden",
        }}>
          <div style={{
            flexShrink:0, background:C.alpha, color:"white",
            fontSize:8, fontWeight:700, padding:"0 12px", height:"100%",
            display:"flex", alignItems:"center", letterSpacing:1,
          }}>⚠ CRITICAL</div>
          <div style={{ display:"flex", gap:24, padding:"0 14px", overflow:"hidden" }}>
            {tracker.alerts.filter(a=>a.severity==="CRITICAL"||a.severity==="EMERGENCY").slice(0,5).map(a=>(
              <span key={a.id} style={{ fontSize:10, color:C.alpha, whiteSpace:"nowrap", letterSpacing:0.5 }}>
                {a.asset_icon} <b>{a.asset_name}</b> — {a.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN BODY ─────────────────────────────────────────── */}
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

        {/* ── MAP AREA ──────────────────────────────────────── */}
        <div style={{ flex:1, position:"relative" }}>
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
            onMapClick={orderMode ? latlng => {
              setOrderMode(prev => ({ ...prev, waypoints:[...prev.waypoints,{lat:latlng.lat,lon:latlng.lng}] }));
            } : null}
          />

          {/* Match HUD (Valorant-style, top center) */}
          <MatchHUD ms={ms} bravoLive={bravoLive} alphaLive={alphaLive}/>

          {/* Service type counters (top right) */}
          <div style={{ position:"absolute", top:10, right:10, zIndex:500, display:"flex", flexDirection:"column", gap:4 }}>
            {Object.entries(SVC_ICON).map(([svc, icon]) => {
              const cnt = (tracker.assets||[]).filter(a=>a.service===svc&&!a.is_destroyed).length;
              if (!cnt) return null;
              return (
                <div key={svc} style={{
                  background:"rgba(5,8,14,0.94)", border:`1px solid ${SVC_COLOR[svc]}33`,
                  borderRadius:7, padding:"4px 10px",
                  display:"flex", alignItems:"center", gap:7, backdropFilter:"blur(6px)",
                }}>
                  <span style={{ fontSize:14 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:800, color:SVC_COLOR[svc], lineHeight:1 }}>{cnt}</div>
                    <div style={{ fontSize:6, color:C.muted, letterSpacing:0.8 }}>{svc.replace("_"," ")}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fog of War toggle (bottom-right of map above command bar) */}
          <div style={{ position:"absolute", bottom:70, right:10, zIndex:500 }}>
            <button onClick={()=>setFogOfWar(v=>!v)} style={{
              background:fogOfWar?`${C.bravo}14`:"rgba(255,255,255,0.04)",
              border:`1px solid ${fogOfWar?`${C.bravo}55`:"rgba(255,255,255,0.1)"}`,
              color:fogOfWar?C.bravo:C.muted, borderRadius:7,
              padding:"7px 14px", fontSize:9, fontWeight:700,
              cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1,
            }}>{fogOfWar?"👁 FOG ON":"🌐 FOG OFF"}</button>
          </div>

          {/* Path result HUD */}
          {tracker.pathResult && (
            <div style={{
              position:"absolute", bottom:70, left:10, zIndex:500,
              background:"rgba(5,8,14,0.97)", border:`1px solid ${C.gold}33`,
              borderRadius:8, padding:"12px 16px", backdropFilter:"blur(8px)",
              minWidth:180, fontFamily:"'Courier New',monospace",
            }}>
              <div style={{ fontSize:9, fontWeight:700, color:C.gold, letterSpacing:2, marginBottom:8 }}>
                PATH · {tracker.pathResult.algo??tracker.pathResult.algorithm}
              </div>
              {[
                ["DISTANCE",  `${tracker.pathResult.distance_km?.toFixed(2)} km`],
                ["WAYPOINTS", tracker.pathResult.waypoints?.length],
                ["NODES",     tracker.pathResult.nodes_visited],
                ["COMPUTE",   `${tracker.pathResult.compute_ms?.toFixed(1)} ms`],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:3 }}>
                  <span style={{ color:C.muted }}>{k}</span>
                  <span style={{ color:C.gold, fontWeight:700 }}>{v}</span>
                </div>
              ))}
              <button onClick={()=>tracker.setPathResult(null)} style={{
                marginTop:6, width:"100%", background:"transparent",
                border:"1px solid rgba(255,255,255,0.08)", color:C.muted,
                borderRadius:5, padding:"4px", fontSize:8,
                cursor:"pointer", fontFamily:"inherit",
              }}>CLEAR PATH</button>
            </div>
          )}

          {/* Order mode overlay */}
          <OrderOverlay
            orderMode={orderMode}
            onConfirm={async () => {
              if (!orderMode?.waypoints?.length) { setOrderMode(null); return; }
              try { await tracker.issueOrder(orderMode.assetId, orderMode.waypoints); setOrderMode(null); addToast("✓ Orders issued — asset re-routing", true); }
              catch(e) { addToast("Order failed: "+e.message, false); }
            }}
            onCancel={() => setOrderMode(null)}
          />

          {/* Selected asset card */}
          <AssetCard
            asset={selectedA}
            onClose={() => setSelectedAsset(null)}
            onOrder={() => selectedA && setOrderMode({ assetId:selectedA.id, callsign:selectedA.callsign??selectedA.name, waypoints:[] })}
            orderMode={orderMode?.assetId===selectedA?.id ? orderMode : null}
          />

          {/* Toast notifications */}
          <ToastLayer toasts={toasts}/>

          {/* Game Command Bar */}
          <GameCommandBar
            selectedAsset={selectedAsset}
            assets={tracker.assets||[]}
            onExec={handleExecCommand}
            clearAlerts={tracker.clearAlerts}
            fogOfWar={fogOfWar}
            setFogOfWar={setFogOfWar}
            orderMode={orderMode}
            setOrderMode={setOrderMode}
          />
        </div>
      </div>

      {/* End-game overlay */}
      {ms && ms.status !== "ACTIVE" && !matchDismissed && (
        <EndGameOverlay
          ms={ms}
          bravoLive={bravoLive}
          alphaLive={alphaLive}
          onReset={async () => { setMatchDismissed(false); await tracker.seedAssets(); addToast("⟳ Match reset — armies re-seeded", true); }}
          onDismiss={() => setMatchDismissed(true)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:2px }
        select option { background:#060910; color:#e2e8f0 }
        input::placeholder { color:#475569; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none }
        button:hover:not(:disabled) { filter:brightness(1.15); }
      `}</style>
    </div>
  );
}
