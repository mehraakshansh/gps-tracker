import React, { useState, useCallback, useRef, useEffect as _ue } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import AuthScreen from "./components/AuthScreen";
import { useTracker } from "./hooks/useTracker";
import { useAuth } from "./hooks/useAuth";

// ── Fantasy Design Tokens ─────────────────────────────────────────────────────
const C = {
  bg:      "#08060c",            // void black
  panel:   "rgba(8,6,14,0.97)", // glass panel
  bravo:   "#d4a843",            // kingdom gold
  alpha:   "#c41e3a",            // blood crimson
  green:   "#2ecc71",            // victory emerald
  purple:  "#9b59d0",            // arcane
  text:    "#e8dcc8",            // parchment
  sub:     "#9a8f7a",            // aged parchment dim
  muted:   "#5a5040",
  fire:    "#ff6b1a",
  ice:     "#7ecfea",
  dim:     "rgba(212,168,67,0.06)",
  border:  "rgba(212,168,67,0.12)",
  borderBright:"rgba(212,168,67,0.35)",
};

const SVC_COLOR = { ARMY:"#d4a843", AIR_FORCE:"#7ecfea", NAVY:"#4a8aaa", SPECIAL_FORCES:"#9b59d0" };
const SVC_ICON  = { ARMY:"⚔️", AIR_FORCE:"🦅", NAVY:"⚓", SPECIAL_FORCES:"🗡️" };

// ── Toast (scroll unfurling style) ────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, ok=true) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, msg, ok }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), 3800);
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
          background: t.ok
            ? "linear-gradient(135deg,rgba(20,14,4,0.97),rgba(30,20,6,0.97))"
            : "linear-gradient(135deg,rgba(20,4,8,0.97),rgba(30,6,10,0.97))",
          border:`1px solid ${t.ok ? "rgba(212,168,67,0.55)" : "rgba(196,30,58,0.55)"}`,
          borderTop:`2px solid ${t.ok ? C.bravo : C.alpha}`,
          color: t.ok ? C.bravo : C.alpha,
          borderRadius:6, padding:"9px 22px", fontSize:12, fontWeight:700,
          fontFamily:"'Courier New',monospace", letterSpacing:0.6,
          whiteSpace:"nowrap", maxWidth:520,
          backdropFilter:"blur(12px)",
          boxShadow:`0 4px 24px ${t.ok?"rgba(212,168,67,0.15)":"rgba(196,30,58,0.15)"}`,
          animation:"toastIn 0.25s ease-out",
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── Valorant-style Ability Command Bar ────────────────────────────────────────
function GameCommandBar({ selectedAsset, assets, onExec, clearAlerts, fogOfWar, setFogOfWar, orderMode }) {
  const [input, setInput] = useState("");
  const asset    = selectedAsset ? assets.find(a => a.id===selectedAsset) : null;
  const canOrder = asset && asset.faction!=="ALPHA" && !asset.is_destroyed;
  const isBravo  = asset && asset.faction!=="ALPHA";

  const doCmd = async cmd => {
    if (!cmd.trim()) return;
    await onExec(cmd);
    setInput("");
  };

  // Ability-style buttons (Q W E R + extras) like Valorant
  const abilities = [
    {
      key:"Q", label:"HALT", icon:"⊘", color:C.alpha,
      desc:"Stop unit", disabled:!isBravo,
      action:() => isBravo && doCmd(`HALT ${asset.callsign}`),
    },
    {
      key:"W", label:"ENGAGE", icon:"⚔", color:C.fire,
      desc:"Enter combat", disabled:!isBravo,
      action:() => isBravo && doCmd(`ENGAGE ${asset.callsign}`),
    },
    {
      key:"E", label:"ACTIVE", icon:"✦", color:C.bravo,
      desc:"Resume patrol", disabled:!isBravo,
      action:() => isBravo && doCmd(`ACTIVE ${asset.callsign}`),
    },
    {
      key:"R", label:"ORDER", icon:"🎯", color:"#c9a84c",
      desc:"Issue orders", disabled:!canOrder, active:!!orderMode,
      action:() => canOrder && doCmd(`ORDER ${asset.callsign}`),
    },
    {
      key:"F", label:fogOfWar?"WAR FOG":"FULL MAP", icon:fogOfWar?"🌫":"🗺",
      color:fogOfWar?C.bravo:C.muted,
      desc:"Toggle fog", disabled:false,
      action:() => setFogOfWar(v=>!v),
    },
    {
      key:"G", label:"SEED", icon:"⟳", color:C.purple,
      desc:"Reset armies", disabled:false,
      action:() => doCmd("SEED"),
    },
    {
      key:"Z", label:"CLR LOG", icon:"🗑", color:C.muted,
      desc:"Clear alerts", disabled:false,
      action:clearAlerts,
    },
  ];

  return (
    <div style={{
      position:"absolute", bottom:0, left:0, right:0, zIndex:600, height:66,
      background:"linear-gradient(180deg,rgba(6,4,10,0.96) 0%,rgba(8,6,14,0.99) 100%)",
      borderTop:`1px solid ${C.border}`,
      display:"flex", alignItems:"center", gap:8, padding:"0 16px",
    }}>
      {/* Faction emblem */}
      <div style={{
        fontSize:24, flexShrink:0, lineHeight:1,
        filter:`drop-shadow(0 0 10px ${C.bravo})`,
      }}>⚜</div>

      <div style={{ width:1, height:40, background:C.border, flexShrink:0 }}/>

      {/* Ability buttons */}
      <div style={{ display:"flex", gap:5, flexShrink:0 }}>
        {abilities.map((b,i) => (
          <button key={i} onClick={b.action} disabled={b.disabled} title={b.desc} style={{
            background: b.active    ? `${b.color}2a`
                      : b.disabled  ? "rgba(255,255,255,0.02)"
                      : `${b.color}10`,
            border:`1px solid ${b.disabled?"rgba(255,255,255,0.05)":b.active?b.color:`${b.color}44`}`,
            color: b.disabled ? "rgba(255,255,255,0.12)" : b.color,
            borderRadius:6, padding:"3px 8px", cursor:b.disabled?"not-allowed":"pointer",
            fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column",
            alignItems:"center", gap:1, minWidth:46, transition:"all .12s",
            boxShadow:b.active?`0 0 12px ${b.color}44`:"none",
          }}>
            <span style={{ fontSize:13, lineHeight:1 }}>{b.icon}</span>
            <span style={{ fontSize:6, fontWeight:700, letterSpacing:0.8 }}>{b.label}</span>
            <span style={{
              fontSize:8, fontWeight:900, color:b.disabled?"rgba(255,255,255,0.08)":b.active?b.color:`${b.color}99`,
              letterSpacing:0.5, marginTop:1,
              background:`${b.color}18`, padding:"0 4px", borderRadius:2,
            }}>[{b.key}]</span>
          </button>
        ))}
      </div>

      <div style={{ width:1, height:40, background:C.border, flexShrink:0 }}/>

      {/* Command input — styled as BRCS terminal */}
      <div style={{
        flex:1, display:"flex", alignItems:"center", gap:8,
        background:"rgba(212,168,67,0.04)", border:`1px solid ${C.border}`,
        borderRadius:6, padding:"0 12px", height:40,
        boxShadow:"inset 0 1px 6px rgba(0,0,0,0.5)",
      }}>
        <span style={{ fontSize:11, color:C.bravo, fontFamily:"'Courier New',monospace", flexShrink:0, fontWeight:700,
          textShadow:`0 0 8px ${C.bravo}` }}>⚜ BRCS›</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key==="Enter") doCmd(input);
            if (e.key==="Escape") setInput("");
          }}
          placeholder="command — HALT, ENGAGE, ORDER, STATUS, LIST, HELP"
          style={{
            flex:1, background:"transparent", border:"none", outline:"none",
            color:C.text, fontSize:11, fontFamily:"'Courier New',monospace",
            caretColor:C.bravo,
          }}
        />
        {input && (
          <button onClick={() => doCmd(input)} style={{
            background:`${C.bravo}1a`, border:`1px solid ${C.bravo}55`, color:C.bravo,
            borderRadius:4, padding:"4px 12px", fontSize:9, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1,
          }}>DISPATCH</button>
        )}
      </div>
    </div>
  );
}

// ── Selected Unit Card ────────────────────────────────────────────────────────
function AssetCard({ asset, onClose, onOrder, orderMode }) {
  if (!asset) return null;
  const isAlpha     = asset.faction==="ALPHA";
  const isDestroyed = asset.is_destroyed===true;
  const hpPct       = asset.max_hp ? Math.max(0,Math.round((asset.hp??asset.max_hp)/asset.max_hp*100)) : 100;
  const hpColor     = isDestroyed ? "#444" : hpPct>60 ? C.bravo : hpPct>30 ? C.fire : C.alpha;
  const accent      = isDestroyed ? "#555" : isAlpha ? C.alpha : C.bravo;
  const statusUpper = (asset.status||"ACTIVE").toUpperCase();
  const isHalted    = ["HALTED","MAINTENANCE","DISABLED"].includes(statusUpper);
  const isEngaged   = statusUpper==="ENGAGED";

  return (
    <div style={{
      position:"absolute", bottom:76, left:"50%", transform:"translateX(-50%)",
      zIndex:550,
      background:"linear-gradient(160deg,rgba(14,10,4,0.99) 0%,rgba(8,6,14,0.99) 100%)",
      border:`1px solid ${accent}44`,
      borderTop:`2px solid ${accent}`,
      borderRadius:10, padding:"14px 18px", minWidth:350, maxWidth:460,
      backdropFilter:"blur(20px)",
      boxShadow:`0 -4px 40px ${accent}18, inset 0 0 60px rgba(0,0,0,0.6)`,
      fontFamily:"'Courier New',monospace",
    }}>
      {/* Ornamental top line */}
      <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
        width:60, height:2, background:`linear-gradient(90deg,transparent,${accent},transparent)` }}/>

      <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:12 }}>
        {/* Unit icon box */}
        <div style={{
          width:58, height:58, borderRadius:8, flexShrink:0,
          background:`radial-gradient(circle,${accent}1a,rgba(0,0,0,0.6))`,
          border:`1px solid ${accent}44`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
          filter:isDestroyed?"grayscale(1) brightness(.2)":undefined,
          boxShadow:`inset 0 0 20px ${accent}18, 0 0 20px ${accent}18`,
        }}>{asset.icon}</div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:3 }}>
            <span style={{
              fontSize:18, fontWeight:800, color:accent, letterSpacing:2.5,
              textShadow:`0 0 16px ${accent}88`,
            }}>{asset.callsign}</span>
            <span style={{
              fontSize:8, padding:"2px 8px", borderRadius:4,
              background:`${accent}18`, border:`1px solid ${accent}44`,
              color:accent, fontWeight:700, letterSpacing:1,
            }}>{isAlpha?"☠ ALPHA":"◆ BRAVO"}</span>
            {isDestroyed && <span style={{ fontSize:8, padding:"2px 7px", borderRadius:4, background:"rgba(100,0,0,0.3)", color:"#ff4444", fontWeight:700, border:"1px solid #ff444444" }}>💀 SLAIN</span>}
            {isHalted&&!isDestroyed && <span style={{ fontSize:8, padding:"2px 7px", borderRadius:4, background:`${C.alpha}18`, color:C.alpha, fontWeight:700, border:`1px solid ${C.alpha}44` }}>⊘ HALTED</span>}
            {isEngaged && <span style={{ fontSize:8, padding:"2px 7px", borderRadius:4, background:`${C.fire}18`, color:C.fire, fontWeight:700, border:`1px solid ${C.fire}44`, animation:"pulseOpacity 0.5s infinite alternate" }}>⚔ IN BATTLE</span>}
          </div>
          <div style={{ fontSize:10, color:C.sub, marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{asset.name}</div>

          {/* HP bar — fantasy style */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:3 }}>
              <span style={{ color:C.muted, letterSpacing:1 }}>VITALITY</span>
              <span style={{ color:hpColor, fontWeight:700 }}>{isDestroyed?"SLAIN":`${asset.hp??0} / ${asset.max_hp??0}`}</span>
            </div>
            <div style={{ height:7, background:"rgba(0,0,0,0.5)", borderRadius:4, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{
                height:"100%", width:`${isDestroyed?0:hpPct}%`,
                background:`linear-gradient(90deg,${hpColor}88,${hpColor})`,
                borderRadius:4, transition:"width .4s ease",
                boxShadow:`0 0 8px ${hpColor}`,
              }}/>
            </div>
          </div>
        </div>

        <button onClick={onClose} style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:18, lineHeight:1, flexShrink:0, padding:0 }}>✕</button>
      </div>

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:5, marginBottom:isAlpha||isDestroyed?0:12 }}>
        {[
          ["SPD",   `${asset.current_speed?.toFixed(0)??0}`],
          ["HDG",   `${asset.current_heading?.toFixed(0)??0}°`],
          ["FUEL",  `${asset.fuel_pct?.toFixed(0)??100}%`],
          ["ATK",   `${asset.attack_power??0}`],
          ["RNG",   `${asset.range_km??0}km`],
          ["STATE", statusUpper.slice(0,6)],
        ].map(([k,v]) => (
          <div key={k} style={{
            background:"rgba(212,168,67,0.04)", borderRadius:5, padding:"5px 2px", textAlign:"center",
            border:`1px solid ${C.border}`,
          }}>
            <div style={{ fontSize:7, color:C.muted, marginBottom:2, letterSpacing:0.5 }}>{k}</div>
            <div style={{ fontSize:9, color:k==="STATE"&&isHalted?C.alpha:k==="STATE"&&isEngaged?C.fire:C.text, fontWeight:700 }}>{v}</div>
          </div>
        ))}
      </div>

      {!isAlpha && !isDestroyed && (
        <button onClick={onOrder} style={{
          width:"100%",
          background:orderMode?`${C.bravo}1e`:`${C.bravo}0b`,
          border:`1px solid ${orderMode?C.bravo:`${C.bravo}44`}`,
          color:C.bravo, borderRadius:7, padding:"9px 0",
          fontSize:11, fontWeight:700, cursor:"pointer",
          fontFamily:"'Courier New',monospace", letterSpacing:2,
          transition:"all .15s",
          boxShadow:orderMode?`0 0 16px ${C.bravo}33`:"none",
        }}>{orderMode?"🎯  DISPATCHING ORDERS...":"▶  ISSUE MOVEMENT ORDERS"}</button>
      )}

      {(asset.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
        <div key={z.zoneId} style={{ marginTop:5, fontSize:8, color:z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD"?C.alpha:C.fire, letterSpacing:0.3 }}>
          ▶ ENTERED {z.zoneType}: {z.zoneName}
        </div>
      ))}
    </div>
  );
}

// ── War Score HUD (GoT-style scoreboard top-center) ───────────────────────────
function MatchHUD({ ms, bravoLive, alphaLive }) {
  if (!ms) return null;
  const bScore = ms.bravo_score??0;
  const aScore = ms.alpha_score??0;
  const bPct   = Math.round(bScore/(bScore+aScore||1)*100);
  const active = ms.status==="ACTIVE";

  return (
    <div style={{
      position:"absolute", top:10, left:"50%", transform:"translateX(-50%)",
      zIndex:500, fontFamily:"'Courier New',monospace", minWidth:340,
    }}>
      <div style={{
        background:"linear-gradient(160deg,rgba(14,10,4,0.98),rgba(8,6,14,0.98))",
        border:`1px solid ${C.border}`,
        borderTop:`2px solid ${C.bravo}`,
        borderRadius:10, padding:"12px 20px",
        backdropFilter:"blur(16px)",
        boxShadow:`0 4px 40px rgba(0,0,0,0.6), 0 0 0 1px ${C.dim}`,
      }}>
        {/* Status rune */}
        <div style={{ textAlign:"center", marginBottom:10 }}>
          <span style={{
            fontSize:8, fontWeight:700, letterSpacing:2.5, padding:"3px 14px", borderRadius:20,
            background:active?"rgba(212,168,67,0.1)":ms.status==="BRAVO_WINS"?"rgba(212,168,67,0.12)":"rgba(196,30,58,0.12)",
            border:`1px solid ${active?`${C.bravo}44`:ms.status==="BRAVO_WINS"?`${C.bravo}55`:`${C.alpha}55`}`,
            color:active?C.bravo:ms.status==="BRAVO_WINS"?C.bravo:C.alpha,
            boxShadow:`0 0 12px ${active?C.bravo:ms.status==="BRAVO_WINS"?C.bravo:C.alpha}22`,
          }}>
            {active?"⚔ BATTLE RAGES":ms.status==="BRAVO_WINS"?"★ THE REALM STANDS":"☠ REALM FALLS"}
          </span>
        </div>

        {/* Score row */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* BRAVO — The Kingdom */}
          <div style={{ flex:1, textAlign:"right" }}>
            <div style={{ fontSize:8, color:C.bravo, fontWeight:700, letterSpacing:3, marginBottom:2, textShadow:`0 0 8px ${C.bravo}` }}>
              ◆ BRAVO
            </div>
            <div style={{ fontSize:26, fontWeight:900, color:C.bravo, letterSpacing:1, lineHeight:1,
              textShadow:`0 0 20px ${C.bravo}88` }}>{bScore.toLocaleString()}</div>
            <div style={{ fontSize:8, color:C.sub, marginTop:3 }}>{bravoLive} standing · {ms.alpha_assets_destroyed??0} slain</div>
          </div>

          {/* VS / progress bar */}
          <div style={{ textAlign:"center", flexShrink:0, padding:"0 6px" }}>
            <div style={{ fontSize:9, color:C.muted, fontWeight:700, letterSpacing:1 }}>VS</div>
            <div style={{ width:64, height:5, background:"rgba(0,0,0,0.5)", borderRadius:3, marginTop:5, overflow:"hidden",
              border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{
                height:"100%", width:`${bPct}%`,
                background:`linear-gradient(90deg,${C.bravo}88,${C.bravo})`,
                borderRadius:3, transition:"width .6s ease",
                boxShadow:`0 0 6px ${C.bravo}`,
              }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
              <div style={{ width:6, height:6, background:C.bravo, transform:"rotate(45deg)", boxShadow:`0 0 6px ${C.bravo}` }}/>
              <div style={{ width:6, height:6, background:C.alpha, transform:"rotate(45deg)", boxShadow:`0 0 6px ${C.alpha}` }}/>
            </div>
          </div>

          {/* ALPHA — The Enemy */}
          <div style={{ flex:1 }}>
            <div style={{ fontSize:8, color:C.alpha, fontWeight:700, letterSpacing:3, marginBottom:2, textShadow:`0 0 8px ${C.alpha}` }}>
              ▲ ALPHA
            </div>
            <div style={{ fontSize:26, fontWeight:900, color:C.alpha, letterSpacing:1, lineHeight:1,
              textShadow:`0 0 20px ${C.alpha}88` }}>{aScore.toLocaleString()}</div>
            <div style={{ fontSize:8, color:C.sub, marginTop:3 }}>{alphaLive} standing · {ms.bravo_assets_destroyed??0} slain</div>
          </div>
        </div>

        {/* Zone control */}
        <div style={{ display:"flex", justifyContent:"center", gap:14, marginTop:10, paddingTop:8,
          borderTop:`1px solid ${C.border}` }}>
          <span style={{ fontSize:8, color:C.bravo }}>🏰 {ms.zones_controlled_bravo??0} HOLDS</span>
          <span style={{ fontSize:8, color:C.muted }}>·</span>
          <span style={{ fontSize:8, color:C.alpha }}>🏰 {ms.zones_controlled_alpha??0} HOLDS</span>
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
      <div style={{
        position:"absolute", top:10, left:"50%", transform:"translateX(-50%)",
        zIndex:700,
        background:"linear-gradient(160deg,rgba(20,14,4,0.98),rgba(8,6,14,0.98))",
        border:`1px solid ${C.bravo}77`, borderTop:`2px solid ${C.bravo}`,
        borderRadius:10, padding:"12px 22px",
        display:"flex", alignItems:"center", gap:16,
        fontFamily:"'Courier New',monospace",
        backdropFilter:"blur(16px)",
        boxShadow:`0 0 40px rgba(212,168,67,0.2), 0 0 0 1px rgba(212,168,67,0.05)`,
        marginTop:100,
      }}>
        <span style={{ fontSize:22, filter:`drop-shadow(0 0 8px ${C.bravo})` }}>🎯</span>
        <div>
          <div style={{ fontSize:10, color:C.bravo, fontWeight:700, letterSpacing:2.5 }}>ORDERS — {orderMode.callsign}</div>
          <div style={{ fontSize:8, color:C.sub }}>{orderMode.waypoints.length} waypoint{orderMode.waypoints.length!==1?"s":""} marked · click map to add more</div>
        </div>
        <div style={{ display:"flex", gap:8, marginLeft:6 }}>
          <button onClick={onConfirm} disabled={orderMode.waypoints.length===0} style={{
            background:`${C.bravo}1e`, border:`1px solid ${C.bravo}77`, color:C.bravo,
            borderRadius:6, padding:"7px 18px", fontSize:10, fontWeight:700,
            cursor:orderMode.waypoints.length===0?"not-allowed":"pointer",
            fontFamily:"'Courier New',monospace", letterSpacing:1.5,
            opacity:orderMode.waypoints.length===0?0.35:1,
            boxShadow:orderMode.waypoints.length>0?`0 0 14px ${C.bravo}33`:"none",
          }}>CONFIRM ✓</button>
          <button onClick={onCancel} style={{
            background:`${C.alpha}12`, border:`1px solid ${C.alpha}55`, color:C.alpha,
            borderRadius:6, padding:"7px 16px", fontSize:10, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1,
          }}>CANCEL ✕</button>
        </div>
      </div>
      <div style={{
        position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        zIndex:600, pointerEvents:"none", textAlign:"center",
        fontFamily:"'Courier New',monospace",
        color:C.bravo, textShadow:`0 0 24px ${C.bravo}`,
      }}>
        <div style={{ fontSize:12, fontWeight:700, letterSpacing:2 }}>CLICK MAP TO MARK WAYPOINTS</div>
        <div style={{ fontSize:9, color:C.sub, marginTop:4 }}>{orderMode.waypoints.length} point{orderMode.waypoints.length!==1?"s":""} planned</div>
      </div>
    </>
  );
}

// ── Victory / Defeat Overlay ──────────────────────────────────────────────────
function EndGameOverlay({ ms, bravoLive, alphaLive, onReset, onDismiss }) {
  if (!ms||ms.status==="ACTIVE") return null;
  const bravoWins = ms.status==="BRAVO_WINS";
  const accent = bravoWins ? C.bravo : C.alpha;
  const bScore = ms.bravo_score??0;
  const aScore = ms.alpha_score??0;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:900,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Courier New',monospace",
    }}>
      {/* Particle background */}
      <div style={{
        position:"absolute", inset:0, zIndex:0, pointerEvents:"none",
        background:bravoWins
          ? "radial-gradient(ellipse at center,rgba(212,168,67,0.08) 0%,transparent 70%)"
          : "radial-gradient(ellipse at center,rgba(196,30,58,0.08) 0%,transparent 70%)",
      }}/>

      <div style={{
        position:"relative", zIndex:1,
        background:"linear-gradient(160deg,rgba(14,10,4,0.99),rgba(6,4,12,0.99))",
        border:`1px solid ${accent}55`, borderTop:`3px solid ${accent}`,
        borderRadius:14, padding:"40px 52px",
        maxWidth:560, width:"90%", textAlign:"center",
        boxShadow:`0 0 100px ${accent}22, 0 0 40px rgba(0,0,0,0.8), inset 0 0 80px rgba(0,0,0,0.6)`,
      }}>
        {/* Ornamental line */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:58, filter:`drop-shadow(0 0 24px ${accent})`, animation:"victoryPulse 2s ease-in-out infinite" }}>
            {bravoWins?"🏰":"💀"}
          </div>
        </div>

        <div style={{ fontSize:26, fontWeight:900, color:accent, letterSpacing:5, marginBottom:4,
          textShadow:`0 0 40px ${accent}` }}>
          {bravoWins?"★ THE REALM HOLDS":"☠ THE REALM FALLS"}
        </div>
        <div style={{ fontSize:9, color:C.sub, letterSpacing:3, marginBottom:32 }}>
          {bravoWins?"INDIA STANDS — HONOUR AND GLORY":"ALPHA FORCES VICTORIOUS — THE REALM BURNS"}
        </div>

        {/* Score comparison */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"center", marginBottom:22 }}>
          {/* BRAVO card */}
          <div style={{
            background:bravoWins?`${C.bravo}0d`:"rgba(255,255,255,0.02)",
            border:`1px solid ${bravoWins?`${C.bravo}55`:"rgba(255,255,255,0.06)"}`,
            borderRadius:10, padding:"16px 12px",
            boxShadow:bravoWins?`0 0 24px ${C.bravo}18`:"none",
          }}>
            <div style={{ fontSize:9, color:C.bravo, letterSpacing:2, marginBottom:6 }}>◆ BRAVO</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.bravo, marginBottom:4, textShadow:`0 0 16px ${C.bravo}88` }}>
              {bScore.toLocaleString()}
            </div>
            <div style={{ fontSize:7, color:C.muted, marginBottom:10 }}>POINTS</div>
            {[["KILLS",ms.alpha_assets_destroyed??0],["HOLDS",ms.zones_controlled_bravo??0],["STANDING",bravoLive]].map(([k,v])=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:4 }}>
                <span style={{ color:C.muted }}>{k}</span>
                <span style={{ color:C.bravo, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize:13, color:"rgba(255,255,255,0.08)", fontWeight:700 }}>VS</div>

          {/* ALPHA card */}
          <div style={{
            background:!bravoWins?`${C.alpha}0d`:"rgba(255,255,255,0.02)",
            border:`1px solid ${!bravoWins?`${C.alpha}55`:"rgba(255,255,255,0.06)"}`,
            borderRadius:10, padding:"16px 12px",
            boxShadow:!bravoWins?`0 0 24px ${C.alpha}18`:"none",
          }}>
            <div style={{ fontSize:9, color:C.alpha, letterSpacing:2, marginBottom:6 }}>▲ ALPHA</div>
            <div style={{ fontSize:32, fontWeight:900, color:C.alpha, marginBottom:4, textShadow:`0 0 16px ${C.alpha}88` }}>
              {aScore.toLocaleString()}
            </div>
            <div style={{ fontSize:7, color:C.muted, marginBottom:10 }}>POINTS</div>
            {[["KILLS",ms.bravo_assets_destroyed??0],["HOLDS",ms.zones_controlled_alpha??0],["STANDING",alphaLive]].map(([k,v])=>(
              <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:4 }}>
                <span style={{ color:C.muted }}>{k}</span>
                <span style={{ color:C.alpha, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Margin banner */}
        <div style={{
          background:`linear-gradient(90deg,transparent,${accent}18,transparent)`,
          border:`1px solid ${accent}33`,
          borderRadius:6, padding:"9px 0", marginBottom:26,
          fontSize:9, color:accent, fontWeight:700, letterSpacing:2,
        }}>
          {bravoWins
            ? `BRAVO LEADS +${(bScore-aScore).toLocaleString()} pts · ${ms.alpha_assets_destroyed??0} enemies slain`
            : `ALPHA LEADS +${(aScore-bScore).toLocaleString()} pts · ${ms.bravo_assets_destroyed??0} BRAVO fallen`}
        </div>

        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button onClick={onReset} style={{
            background:`${C.bravo}18`, border:`1px solid ${C.bravo}77`, color:C.bravo,
            borderRadius:8, padding:"12px 32px", fontSize:11, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:2,
            boxShadow:`0 0 20px ${C.bravo}33`, transition:"all .15s",
          }}>⟳  NEW BATTLE</button>
          <button onClick={onDismiss} style={{
            background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`,
            color:C.sub, borderRadius:8, padding:"12px 22px",
            fontSize:11, cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1,
          }}>SURVEY MAP</button>
        </div>

        <div style={{ marginTop:16, fontSize:8, color:"rgba(255,255,255,0.12)", letterSpacing:1 }}>
          NEW BATTLE re-seeds all forces and restarts the simulation
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
    if (tracker.matchState?.status==="ACTIVE") setMatchDismissed(false);
  }, [tracker.matchState?.status]);

  const handleCmdChange = useCallback(cmd => {
    setActiveCmd(cmd); setActiveSector(cmd);
  }, []);

  const handleExecCommand = useCallback(async cmd => {
    const result = await tracker.executeCommand(cmd);
    if (result.ok && result.msg?.startsWith("__ORDER__:")) {
      const [, assetId, callsign] = result.msg.split(":");
      setOrderMode({ assetId, callsign, waypoints:[] });
      setSelectedAsset(assetId);
      addToast(`🎯 ORDERS — ${callsign}. Mark waypoints on the map.`, true);
      return result;
    }
    if (result.msg && result.msg!=="__CLEAR__") addToast(result.msg, result.ok);
    return result;
  }, [tracker, addToast]);

  if (auth.loading) {
    return (
      <div style={{
        position:"fixed", inset:0, background:C.bg,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"'Courier New',monospace",
      }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:56, marginBottom:18, filter:`drop-shadow(0 0 24px ${C.bravo}) drop-shadow(0 0 50px ${C.bravo}44)` }}>⚜</div>
          <div style={{ fontSize:11, letterSpacing:4, color:C.bravo, animation:"pulse 1s infinite",
            textShadow:`0 0 16px ${C.bravo}` }}>AWAKENING THE REALM...</div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.15}}`}</style>
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
  const engagedCnt = (tracker.assets||[]).filter(a => (a.status||"").toUpperCase()==="ENGAGED").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:C.bg, overflow:"hidden", fontFamily:"'Courier New',monospace" }}>

      {/* ── WAR ROOM TOP BAR ──────────────────────────────────── */}
      <div style={{
        height:54, flexShrink:0,
        background:"linear-gradient(180deg,rgba(14,10,4,0.99),rgba(8,6,14,0.99))",
        borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 18px", gap:12, zIndex:600,
        boxShadow:"0 2px 20px rgba(0,0,0,0.6)",
      }}>
        {/* Left: Brand */}
        <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <div style={{ fontSize:26, filter:`drop-shadow(0 0 14px ${C.bravo}) drop-shadow(0 0 30px ${C.bravo}44)` }}>⚜</div>
          <div>
            <div style={{ fontSize:16, fontWeight:900, color:C.bravo, letterSpacing:5, lineHeight:1,
              textShadow:`0 0 16px ${C.bravo}` }}>BRCS</div>
            <div style={{ fontSize:7, color:C.muted, letterSpacing:2.5 }}>BHARAT RAKSHA COMMAND SYSTEM</div>
          </div>
          <div style={{ width:1, height:30, background:C.border, marginLeft:4 }}/>
          <div style={{ fontSize:9, color:C.sub, letterSpacing:1.5 }}>{activeCmd==="ALL"?"ALL SECTORS":activeCmd}</div>
        </div>

        {/* Center: Live stat pills */}
        <div style={{ display:"flex", gap:5 }}>
          {[
            { label:"FORCES",  value:(tracker.assets||[]).length,   color:C.bravo },
            { label:"IN BATTLE",value:engagedCnt,                   color:C.fire  },
            { label:"HALTED",  value:(tracker.assets||[]).filter(a=>["HALTED","MAINTENANCE","DISABLED"].includes((a.status||"").toUpperCase())).length, color:C.alpha },
            { label:"ALERTS",  value:(tracker.alerts||[]).length,   color:critCount>0?C.alpha:"#d47820" },
            { label:"ZONES",   value:(tracker.zones||[]).length,    color:C.ice   },
          ].map(s => (
            <div key={s.label} style={{
              background:`${s.color}0c`, border:`1px solid ${s.color}2a`,
              borderRadius:6, padding:"3px 11px", textAlign:"center", minWidth:56,
            }}>
              <div style={{ fontSize:17, fontWeight:900, color:s.color, lineHeight:1,
                textShadow:`0 0 10px ${s.color}88` }}>{s.value}</div>
              <div style={{ fontSize:7, color:C.muted, letterSpacing:0.8, marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Right: Clock + connection */}
        <div style={{ display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:17, fontWeight:700, color:C.text, letterSpacing:2.5,
              fontVariantNumeric:"tabular-nums", textShadow:"0 0 10px rgba(232,220,200,0.3)" }}>{timeStr}</div>
            <div style={{ fontSize:7, color:C.muted, letterSpacing:1.5 }}>
              {clock.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})} IST
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{
              width:9, height:9, borderRadius:"50%",
              background:tracker.connected?C.bravo:C.alpha,
              boxShadow:tracker.connected?`0 0 10px ${C.bravo}`:` 0 0 10px ${C.alpha}`,
              animation:tracker.connected?"pulse 1.5s ease-in-out infinite":"none",
            }}/>
            <span style={{ fontSize:9, fontWeight:700, color:tracker.connected?C.bravo:C.alpha, letterSpacing:1.5,
              textShadow:tracker.connected?`0 0 8px ${C.bravo}`:undefined }}>
              {tracker.connected?"LIVE":"OFFLINE"}
            </span>
            {tracker.connected&&<span style={{ fontSize:7, color:C.muted }}>{tracker.tickMs}ms</span>}
          </div>
        </div>
      </div>

      {/* ── CRITICAL ALERT TICKER ─────────────────────────────── */}
      {critCount>0 && (
        <div style={{
          height:28, flexShrink:0,
          background:"rgba(139,26,42,0.08)", borderBottom:"1px solid rgba(196,30,58,0.3)",
          display:"flex", alignItems:"center", overflow:"hidden",
        }}>
          <div style={{
            flexShrink:0, background:C.alpha, color:"#fff",
            fontSize:8, fontWeight:700, padding:"0 14px", height:"100%",
            display:"flex", alignItems:"center", letterSpacing:1.5,
            boxShadow:`2px 0 12px ${C.alpha}44`,
          }}>☠ CRITICAL</div>
          <div style={{ display:"flex", gap:24, padding:"0 16px", overflow:"hidden" }}>
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
              setOrderMode(prev => ({...prev, waypoints:[...prev.waypoints,{lat:latlng.lat,lon:latlng.lng}]}));
            } : null}
          />

          {/* War score HUD */}
          <MatchHUD ms={ms} bravoLive={bravoLive} alphaLive={alphaLive}/>

          {/* Service type counters — top right */}
          <div style={{ position:"absolute", top:10, right:10, zIndex:500, display:"flex", flexDirection:"column", gap:5 }}>
            {Object.entries(SVC_ICON).map(([svc,icon]) => {
              const cnt = (tracker.assets||[]).filter(a=>a.service===svc&&!a.is_destroyed).length;
              if (!cnt) return null;
              return (
                <div key={svc} style={{
                  background:"linear-gradient(135deg,rgba(14,10,4,0.97),rgba(8,6,14,0.97))",
                  border:`1px solid ${SVC_COLOR[svc]}33`,
                  borderLeft:`2px solid ${SVC_COLOR[svc]}88`,
                  borderRadius:7, padding:"5px 11px",
                  display:"flex", alignItems:"center", gap:8,
                  backdropFilter:"blur(10px)",
                }}>
                  <span style={{ fontSize:15 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:900, color:SVC_COLOR[svc], lineHeight:1,
                      textShadow:`0 0 10px ${SVC_COLOR[svc]}88` }}>{cnt}</div>
                    <div style={{ fontSize:6, color:C.muted, letterSpacing:1 }}>{svc.replace("_"," ")}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Path result HUD */}
          {tracker.pathResult && (
            <div style={{
              position:"absolute", bottom:74, left:10, zIndex:500,
              background:"linear-gradient(160deg,rgba(14,10,4,0.97),rgba(8,6,14,0.97))",
              border:`1px solid ${C.bravo}33`,
              borderTop:`2px solid ${C.bravo}`,
              borderRadius:8, padding:"12px 16px",
              backdropFilter:"blur(12px)", minWidth:185,
            }}>
              <div style={{ fontSize:9, fontWeight:700, color:C.bravo, letterSpacing:2, marginBottom:8,
                textShadow:`0 0 8px ${C.bravo}` }}>
                PATH · {tracker.pathResult.algo??tracker.pathResult.algorithm}
              </div>
              {[
                ["DISTANCE", `${tracker.pathResult.distance_km?.toFixed(2)} km`],
                ["WAYPOINTS",  tracker.pathResult.waypoints?.length],
                ["NODES",      tracker.pathResult.nodes_visited],
                ["COMPUTE",  `${tracker.pathResult.compute_ms?.toFixed(1)} ms`],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:3 }}>
                  <span style={{ color:C.muted }}>{k}</span>
                  <span style={{ color:C.bravo, fontWeight:700 }}>{v}</span>
                </div>
              ))}
              <button onClick={()=>tracker.setPathResult(null)} style={{
                marginTop:7, width:"100%", background:`${C.bravo}0c`,
                border:`1px solid ${C.border}`, color:C.muted,
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
              try {
                await tracker.issueOrder(orderMode.assetId, orderMode.waypoints);
                setOrderMode(null);
                addToast("✓ Orders dispatched — unit re-routing", true);
              } catch(e) { addToast("Orders failed: "+e.message, false); }
            }}
            onCancel={() => setOrderMode(null)}
          />

          {/* Selected unit card */}
          <AssetCard
            asset={selectedA}
            onClose={() => setSelectedAsset(null)}
            onOrder={() => selectedA && setOrderMode({ assetId:selectedA.id, callsign:selectedA.callsign??selectedA.name, waypoints:[] })}
            orderMode={orderMode?.assetId===selectedA?.id ? orderMode : null}
          />

          {/* Toasts */}
          <ToastLayer toasts={toasts}/>

          {/* Command bar */}
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

      {/* Victory/defeat overlay */}
      {ms && ms.status!=="ACTIVE" && !matchDismissed && (
        <EndGameOverlay
          ms={ms} bravoLive={bravoLive} alphaLive={alphaLive}
          onReset={async () => {
            setMatchDismissed(false);
            await tracker.seedAssets();
            addToast("⟳ New battle — armies re-assembled", true);
          }}
          onDismiss={() => setMatchDismissed(true)}
        />
      )}

      <style>{`
        @keyframes pulse           { 0%,100%{opacity:1}       50%{opacity:.15}     }
        @keyframes pulseOpacity    { from{opacity:.6}          to{opacity:1}        }
        @keyframes victoryPulse    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes toastIn         { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar        { width:3px }
        ::-webkit-scrollbar-track  { background:transparent }
        ::-webkit-scrollbar-thumb  { background:rgba(212,168,67,0.2); border-radius:2px }
        select option              { background:#08060c; color:#e8dcc8 }
        input::placeholder         { color:#5a5040; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none }
        button:hover:not(:disabled){ filter:brightness(1.15); }
      `}</style>
    </div>
  );
}
