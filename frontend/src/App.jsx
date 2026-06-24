import React, { useState, useCallback, useEffect as _ue } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import AuthScreen from "./components/AuthScreen";
import { useTracker } from "./hooks/useTracker";
import { useAuth } from "./hooks/useAuth";

const C = {
  bg:     "#08060c",
  panel:  "rgba(8,6,14,0.97)",
  bravo:  "#d4a843",
  alpha:  "#c41e3a",
  green:  "#2ecc71",
  purple: "#9b59d0",
  text:   "#e8dcc8",
  sub:    "#9a8f7a",
  muted:  "#5a5040",
  fire:   "#ff6b1a",
  ice:    "#7ecfea",
  dim:    "rgba(212,168,67,0.06)",
  border: "rgba(212,168,67,0.12)",
  borderBright: "rgba(212,168,67,0.35)",
};

const SVC_COLOR = { ARMY:"#d4a843", AIR_FORCE:"#7ecfea", NAVY:"#4a8aaa", SPECIAL_FORCES:"#9b59d0" };
const SVC_ICON  = { ARMY:"⚔️", AIR_FORCE:"🦅", NAVY:"⚓", SPECIAL_FORCES:"🗡️" };

// ── Mobile detection ──────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 768);
  _ue(() => {
    const h = () => setM(window.innerWidth <= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, ok=true) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, msg, ok }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), 3800);
  }, []);
  return { toasts, add };
}

function ToastLayer({ toasts, isMobile }) {
  return (
    <div style={{
      position:"absolute", bottom: isMobile ? 86 : 72, left:"50%",
      transform:"translateX(-50%)",
      zIndex:800, display:"flex", flexDirection:"column-reverse", gap:6,
      alignItems:"center", pointerEvents:"none", width:"90vw", maxWidth:520,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.ok
            ? "linear-gradient(135deg,rgba(20,14,4,0.97),rgba(30,20,6,0.97))"
            : "linear-gradient(135deg,rgba(20,4,8,0.97),rgba(30,6,10,0.97))",
          border:`1px solid ${t.ok?"rgba(212,168,67,0.55)":"rgba(196,30,58,0.55)"}`,
          borderTop:`2px solid ${t.ok?C.bravo:C.alpha}`,
          color: t.ok ? C.bravo : C.alpha,
          borderRadius:8, padding: isMobile ? "11px 18px" : "9px 22px",
          fontSize: isMobile ? 13 : 12, fontWeight:700,
          fontFamily:"'Courier New',monospace", letterSpacing:0.6,
          maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          backdropFilter:"blur(12px)",
          boxShadow:`0 4px 24px ${t.ok?"rgba(212,168,67,0.15)":"rgba(196,30,58,0.15)"}`,
          animation:"toastIn 0.25s ease-out",
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── Match HUD ─────────────────────────────────────────────────────────────────
function MatchHUD({ ms, bravoLive, alphaLive, isMobile }) {
  if (!ms) return null;
  const bScore = ms.bravo_score ?? 0;
  const aScore = ms.alpha_score ?? 0;
  const bPct   = Math.round(bScore / (bScore + aScore || 1) * 100);
  const active = ms.status === "ACTIVE";
  const accent = active ? C.bravo : ms.status === "BRAVO_WINS" ? C.bravo : C.alpha;

  if (isMobile) {
    return (
      <div style={{
        position:"absolute", top:8, left:"50%", transform:"translateX(-50%)",
        zIndex:500, fontFamily:"'Courier New',monospace",
        display:"flex", alignItems:"stretch",
        background:"linear-gradient(160deg,rgba(14,10,4,0.96),rgba(8,6,14,0.96))",
        border:`1px solid ${C.border}`, borderTop:`2px solid ${accent}`,
        borderRadius:10, backdropFilter:"blur(12px)",
        boxShadow:`0 2px 20px rgba(0,0,0,0.6)`,
        minWidth:240, overflow:"hidden",
      }}>
        <div style={{ padding:"8px 14px", textAlign:"center" }}>
          <div style={{ fontSize:9, color:C.bravo, fontWeight:700, letterSpacing:1.5, marginBottom:2 }}>◆ BRAVO</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.bravo, lineHeight:1, textShadow:`0 0 12px ${C.bravo}88` }}>
            {bScore.toLocaleString()}
          </div>
          <div style={{ fontSize:9, color:C.sub, marginTop:2 }}>{bravoLive} up</div>
        </div>
        <div style={{ width:1, background:C.border }}/>
        <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minWidth:52 }}>
          <div style={{ fontSize:10, color:C.muted, fontWeight:700, marginBottom:4 }}>
            {active ? "⚔" : ms.status === "BRAVO_WINS" ? "★" : "☠"}
          </div>
          <div style={{ width:44, height:4, background:"rgba(0,0,0,0.5)", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${bPct}%`, background:`linear-gradient(90deg,${C.bravo}88,${C.bravo})`, borderRadius:2 }}/>
          </div>
        </div>
        <div style={{ width:1, background:C.border }}/>
        <div style={{ padding:"8px 14px", textAlign:"center" }}>
          <div style={{ fontSize:9, color:C.alpha, fontWeight:700, letterSpacing:1.5, marginBottom:2 }}>▲ ALPHA</div>
          <div style={{ fontSize:22, fontWeight:900, color:C.alpha, lineHeight:1, textShadow:`0 0 12px ${C.alpha}88` }}>
            {aScore.toLocaleString()}
          </div>
          <div style={{ fontSize:9, color:C.sub, marginTop:2 }}>{alphaLive} up</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position:"absolute", top:10, left:"50%", transform:"translateX(-50%)",
      zIndex:500, fontFamily:"'Courier New',monospace", minWidth:340,
    }}>
      <div style={{
        background:"linear-gradient(160deg,rgba(14,10,4,0.98),rgba(8,6,14,0.98))",
        border:`1px solid ${C.border}`, borderTop:`2px solid ${C.bravo}`,
        borderRadius:10, padding:"12px 20px",
        backdropFilter:"blur(16px)",
        boxShadow:`0 4px 40px rgba(0,0,0,0.6)`,
      }}>
        <div style={{ textAlign:"center", marginBottom:10 }}>
          <span style={{
            fontSize:9, fontWeight:700, letterSpacing:2.5, padding:"3px 14px", borderRadius:20,
            background:active?"rgba(212,168,67,0.1)":ms.status==="BRAVO_WINS"?"rgba(212,168,67,0.12)":"rgba(196,30,58,0.12)",
            border:`1px solid ${active?`${C.bravo}44`:ms.status==="BRAVO_WINS"?`${C.bravo}55`:`${C.alpha}55`}`,
            color:active?C.bravo:ms.status==="BRAVO_WINS"?C.bravo:C.alpha,
          }}>
            {active?"⚔ BATTLE RAGES":ms.status==="BRAVO_WINS"?"★ THE REALM STANDS":"☠ REALM FALLS"}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ flex:1, textAlign:"right" }}>
            <div style={{ fontSize:9, color:C.bravo, fontWeight:700, letterSpacing:3, marginBottom:2 }}>◆ BRAVO</div>
            <div style={{ fontSize:26, fontWeight:900, color:C.bravo, lineHeight:1, textShadow:`0 0 20px ${C.bravo}88` }}>{bScore.toLocaleString()}</div>
            <div style={{ fontSize:9, color:C.sub, marginTop:3 }}>{bravoLive} standing · {ms.alpha_assets_destroyed??0} slain</div>
          </div>
          <div style={{ textAlign:"center", flexShrink:0, padding:"0 6px" }}>
            <div style={{ fontSize:10, color:C.muted, fontWeight:700 }}>VS</div>
            <div style={{ width:64, height:5, background:"rgba(0,0,0,0.5)", borderRadius:3, marginTop:5, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${bPct}%`, background:`linear-gradient(90deg,${C.bravo}88,${C.bravo})`, borderRadius:3, transition:"width .6s ease" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
              <div style={{ width:6, height:6, background:C.bravo, transform:"rotate(45deg)", boxShadow:`0 0 6px ${C.bravo}` }}/>
              <div style={{ width:6, height:6, background:C.alpha, transform:"rotate(45deg)", boxShadow:`0 0 6px ${C.alpha}` }}/>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:C.alpha, fontWeight:700, letterSpacing:3, marginBottom:2 }}>▲ ALPHA</div>
            <div style={{ fontSize:26, fontWeight:900, color:C.alpha, lineHeight:1, textShadow:`0 0 20px ${C.alpha}88` }}>{aScore.toLocaleString()}</div>
            <div style={{ fontSize:9, color:C.sub, marginTop:3 }}>{alphaLive} standing · {ms.bravo_assets_destroyed??0} slain</div>
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:14, marginTop:10, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
          <span style={{ fontSize:9, color:C.bravo }}>🏰 {ms.zones_controlled_bravo??0} HOLDS</span>
          <span style={{ fontSize:9, color:C.muted }}>·</span>
          <span style={{ fontSize:9, color:C.alpha }}>🏰 {ms.zones_controlled_alpha??0} HOLDS</span>
        </div>
      </div>
    </div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────
function AssetCard({ asset, onClose, onOrder, orderMode, isMobile }) {
  if (!asset) return null;
  const isAlpha     = asset.faction === "ALPHA";
  const isDestroyed = asset.is_destroyed === true;
  const hpPct       = asset.max_hp ? Math.max(0, Math.round((asset.hp ?? asset.max_hp) / asset.max_hp * 100)) : 100;
  const hpColor     = isDestroyed ? "#444" : hpPct > 60 ? C.bravo : hpPct > 30 ? C.fire : C.alpha;
  const accent      = isDestroyed ? "#555" : isAlpha ? C.alpha : C.bravo;
  const statusUpper = (asset.status || "ACTIVE").toUpperCase();
  const isHalted    = ["HALTED","MAINTENANCE","DISABLED"].includes(statusUpper);
  const isEngaged   = statusUpper === "ENGAGED";

  const stats = [
    ["SPD",  `${asset.current_speed?.toFixed(0) ?? 0}`],
    ["HDG",  `${asset.current_heading?.toFixed(0) ?? 0}°`],
    ["FUEL", `${asset.fuel_pct?.toFixed(0) ?? 100}%`],
    ["ATK",  `${asset.attack_power ?? 0}`],
    ["RNG",  `${asset.range_km ?? 0}km`],
    ["STATE",statusUpper.slice(0,5)],
  ];

  if (isMobile) {
    return (
      <div style={{
        position:"absolute", bottom:76, left:0, right:0, zIndex:550,
        background:"linear-gradient(160deg,rgba(12,8,2,0.99),rgba(8,6,14,0.99))",
        border:`1px solid ${accent}44`, borderTop:`2px solid ${accent}`,
        borderRadius:"14px 14px 0 0", padding:"12px 16px 14px",
        backdropFilter:"blur(20px)",
        boxShadow:`0 -8px 40px ${accent}20`,
        fontFamily:"'Courier New',monospace",
      }}>
        {/* Drag handle */}
        <div style={{ width:36, height:3, background:`${accent}40`, borderRadius:2, margin:"0 auto 10px" }}/>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <div style={{
            width:46, height:46, borderRadius:10, flexShrink:0, fontSize:26,
            background:`radial-gradient(circle,${accent}18,rgba(0,0,0,0.5))`,
            border:`1px solid ${accent}33`,
            display:"flex", alignItems:"center", justifyContent:"center",
            filter: isDestroyed ? "grayscale(1) brightness(.2)" : undefined,
          }}>{asset.icon}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:17, fontWeight:800, color:accent, letterSpacing:2, textShadow:`0 0 14px ${accent}88` }}>
                {asset.callsign}
              </span>
              <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:`${accent}18`, border:`1px solid ${accent}44`, color:accent }}>
                {isAlpha ? "☠ ALPHA" : "◆ BRAVO"}
              </span>
              {isDestroyed && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:"rgba(100,0,0,0.4)", color:"#ff4444", border:"1px solid #ff444444" }}>💀 SLAIN</span>}
              {isEngaged && !isDestroyed && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:`${C.fire}18`, color:C.fire, border:`1px solid ${C.fire}44` }}>⚔ BATTLE</span>}
              {isHalted && !isDestroyed && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:`${C.alpha}18`, color:C.alpha, border:`1px solid ${C.alpha}44` }}>⊘ HALTED</span>}
            </div>
            <div style={{ fontSize:10, color:C.sub, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{asset.name}</div>
          </div>
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,0.06)", border:`1px solid ${C.border}`,
            color:C.muted, cursor:"pointer", fontSize:16, borderRadius:8,
            width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0,
          }}>✕</button>
        </div>
        {/* HP bar */}
        <div style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:3 }}>
            <span style={{ color:C.muted, letterSpacing:1 }}>VITALITY</span>
            <span style={{ color:hpColor, fontWeight:700 }}>{isDestroyed ? "SLAIN" : `${asset.hp ?? 0} / ${asset.max_hp ?? 0}`}</span>
          </div>
          <div style={{ height:8, background:"rgba(0,0,0,0.5)", borderRadius:4, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ height:"100%", width:`${isDestroyed ? 0 : hpPct}%`, background:`linear-gradient(90deg,${hpColor}88,${hpColor})`, borderRadius:4, transition:"width .4s ease" }}/>
          </div>
        </div>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:4, marginBottom: !isAlpha && !isDestroyed ? 10 : 0 }}>
          {stats.map(([k,v]) => (
            <div key={k} style={{ background:"rgba(212,168,67,0.04)", borderRadius:6, padding:"5px 2px", textAlign:"center", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:8, color:C.muted, marginBottom:2 }}>{k}</div>
              <div style={{ fontSize:11, color:C.text, fontWeight:700 }}>{v}</div>
            </div>
          ))}
        </div>
        {!isAlpha && !isDestroyed && (
          <button onClick={onOrder} style={{
            width:"100%", height:46,
            background: orderMode ? `${C.bravo}1e` : `${C.bravo}0b`,
            border:`1px solid ${orderMode ? C.bravo : `${C.bravo}44`}`,
            color:C.bravo, borderRadius:10, fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:2,
            transition:"all .15s",
            boxShadow: orderMode ? `0 0 16px ${C.bravo}33` : "none",
          }}>{orderMode ? `🎯  DISPATCHING (${orderMode.waypoints?.length||0} pts)` : "▶  ISSUE MOVEMENT ORDERS"}</button>
        )}
        {(asset.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
          <div key={z.zoneId} style={{ marginTop:5, fontSize:9, color:z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD"?C.alpha:C.fire }}>
            ▶ ENTERED {z.zoneType}: {z.zoneName}
          </div>
        ))}
      </div>
    );
  }

  // Desktop card
  return (
    <div style={{
      position:"absolute", bottom:76, left:"50%", transform:"translateX(-50%)",
      zIndex:550,
      background:"linear-gradient(160deg,rgba(14,10,4,0.99),rgba(8,6,14,0.99))",
      border:`1px solid ${accent}44`, borderTop:`2px solid ${accent}`,
      borderRadius:10, padding:"14px 18px", minWidth:350, maxWidth:460,
      backdropFilter:"blur(20px)",
      boxShadow:`0 -4px 40px ${accent}18`,
      fontFamily:"'Courier New',monospace",
    }}>
      <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:60, height:2, background:`linear-gradient(90deg,transparent,${accent},transparent)` }}/>
      <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:12 }}>
        <div style={{
          width:58, height:58, borderRadius:8, flexShrink:0,
          background:`radial-gradient(circle,${accent}1a,rgba(0,0,0,0.6))`,
          border:`1px solid ${accent}44`,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
          filter:isDestroyed?"grayscale(1) brightness(.2)":undefined,
          boxShadow:`inset 0 0 20px ${accent}18`,
        }}>{asset.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:3 }}>
            <span style={{ fontSize:18, fontWeight:800, color:accent, letterSpacing:2.5, textShadow:`0 0 16px ${accent}88` }}>{asset.callsign}</span>
            <span style={{ fontSize:9, padding:"2px 8px", borderRadius:4, background:`${accent}18`, border:`1px solid ${accent}44`, color:accent, fontWeight:700 }}>{isAlpha?"☠ ALPHA":"◆ BRAVO"}</span>
            {isDestroyed && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:"rgba(100,0,0,0.3)", color:"#ff4444", fontWeight:700, border:"1px solid #ff444444" }}>💀 SLAIN</span>}
            {isHalted&&!isDestroyed && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:`${C.alpha}18`, color:C.alpha, fontWeight:700, border:`1px solid ${C.alpha}44` }}>⊘ HALTED</span>}
            {isEngaged && <span style={{ fontSize:9, padding:"2px 7px", borderRadius:4, background:`${C.fire}18`, color:C.fire, fontWeight:700, border:`1px solid ${C.fire}44` }}>⚔ IN BATTLE</span>}
          </div>
          <div style={{ fontSize:10, color:C.sub, marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{asset.name}</div>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:3 }}>
              <span style={{ color:C.muted, letterSpacing:1 }}>VITALITY</span>
              <span style={{ color:hpColor, fontWeight:700 }}>{isDestroyed?"SLAIN":`${asset.hp??0} / ${asset.max_hp??0}`}</span>
            </div>
            <div style={{ height:7, background:"rgba(0,0,0,0.5)", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${isDestroyed?0:hpPct}%`, background:`linear-gradient(90deg,${hpColor}88,${hpColor})`, borderRadius:4, transition:"width .4s ease" }}/>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:18, lineHeight:1, flexShrink:0, padding:0 }}>✕</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:5, marginBottom:isAlpha||isDestroyed?0:12 }}>
        {stats.map(([k,v]) => (
          <div key={k} style={{ background:"rgba(212,168,67,0.04)", borderRadius:5, padding:"5px 2px", textAlign:"center", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:7, color:C.muted, marginBottom:2 }}>{k}</div>
            <div style={{ fontSize:9, color:C.text, fontWeight:700 }}>{v}</div>
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
        }}>{orderMode ? `🎯  DISPATCHING ORDERS (${orderMode.waypoints?.length||0} pts)` : "▶  ISSUE MOVEMENT ORDERS"}</button>
      )}
      {(asset.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
        <div key={z.zoneId} style={{ marginTop:5, fontSize:9, color:z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD"?C.alpha:C.fire }}>
          ▶ ENTERED {z.zoneType}: {z.zoneName}
        </div>
      ))}
    </div>
  );
}

// ── Mobile Command Bar ────────────────────────────────────────────────────────
function MobileCommandBar({ selectedAsset, assets, onExec, clearAlerts, fogOfWar, setFogOfWar, orderMode, onOpenMenu }) {
  const asset    = selectedAsset ? assets.find(a => a.id === selectedAsset) : null;
  const isBravo  = asset && asset.faction !== "ALPHA";
  const canOrder = isBravo && !asset?.is_destroyed;

  const doCmd = async cmd => { if (cmd.trim()) await onExec(cmd); };

  const btns = [
    { icon:"⊘", label:"HALT",   color:C.alpha,   disabled:!isBravo, action:() => isBravo && doCmd(`HALT ${asset.callsign}`) },
    { icon:"⚔", label:"ENGAGE", color:C.fire,    disabled:!isBravo, action:() => isBravo && doCmd(`ENGAGE ${asset.callsign}`) },
    { icon:"✦", label:"ACTIVE", color:C.bravo,   disabled:!isBravo, action:() => isBravo && doCmd(`ACTIVE ${asset.callsign}`) },
    { icon:"🎯", label:"ORDER",  color:"#c9a84c", disabled:!canOrder, active:!!orderMode, action:() => canOrder && doCmd(`ORDER ${asset.callsign}`) },
    { icon:fogOfWar?"🌫":"🗺", label:"FOG",    color:fogOfWar?C.bravo:C.muted, disabled:false, action:() => setFogOfWar(v=>!v) },
    { icon:"⟳", label:"SEED",   color:C.purple,  disabled:false, action:() => doCmd("SEED") },
    { icon:"☰", label:"MENU",   color:C.ice,     disabled:false, action:onOpenMenu },
  ];

  const hpPct = asset?.max_hp ? Math.max(0, Math.round((asset.hp ?? asset.max_hp) / asset.max_hp * 100)) : 100;
  const hpColor = hpPct > 60 ? C.bravo : hpPct > 30 ? C.fire : C.alpha;
  const accent = asset ? (asset.faction === "ALPHA" ? C.alpha : C.bravo) : C.bravo;

  return (
    <div style={{
      position:"absolute", bottom:0, left:0, right:0, zIndex:600,
      height:72,
      background:"linear-gradient(180deg,rgba(6,4,10,0.97),rgba(8,6,14,1))",
      borderTop:`1px solid ${C.border}`,
      display:"flex", alignItems:"center",
      boxShadow:"0 -4px 20px rgba(0,0,0,0.7)",
    }}>
      {/* Selected unit chip */}
      <div style={{
        width:90, flexShrink:0, padding:"0 10px",
        borderRight:`1px solid ${C.border}`,
        height:"100%", display:"flex", flexDirection:"column",
        justifyContent:"center", gap:3,
        overflow:"hidden",
      }}>
        {asset ? (
          <>
            <div style={{ fontSize:8, color:accent, fontWeight:700, letterSpacing:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {asset.callsign}
            </div>
            <div style={{ fontSize:9, color:C.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {(asset.status||"ACTIVE").toUpperCase().slice(0,7)}
            </div>
            <div style={{ height:4, background:"rgba(0,0,0,0.4)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${hpPct}%`, background:`linear-gradient(90deg,${hpColor}88,${hpColor})`, borderRadius:2 }}/>
            </div>
          </>
        ) : (
          <div style={{ fontSize:8, color:C.muted, letterSpacing:0.5, textAlign:"center", lineHeight:1.4 }}>
            TAP<br/>UNIT
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        flex:1, display:"flex", alignItems:"center", justifyContent:"space-around",
        padding:"0 6px", height:"100%",
      }}>
        {btns.map((b, i) => (
          <button key={i} onClick={b.action} disabled={b.disabled} style={{
            background: b.active    ? `${b.color}28`
                      : b.disabled  ? "rgba(255,255,255,0.02)"
                      : `${b.color}10`,
            border:`1px solid ${b.disabled ? "rgba(255,255,255,0.05)" : b.active ? b.color : `${b.color}40`}`,
            color: b.disabled ? "rgba(255,255,255,0.15)" : b.color,
            borderRadius:10, cursor:b.disabled?"not-allowed":"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            gap:2, padding:0,
            width:44, height:50,
            flexShrink:0,
            boxShadow: b.active ? `0 0 12px ${b.color}44` : "none",
            transition:"all .1s",
            fontFamily:"'Courier New',monospace",
          }}>
            <span style={{ fontSize:16, lineHeight:1 }}>{b.icon}</span>
            <span style={{ fontSize:8, fontWeight:700, letterSpacing:0.5 }}>{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Desktop Command Bar ───────────────────────────────────────────────────────
function DesktopCommandBar({ selectedAsset, assets, onExec, clearAlerts, fogOfWar, setFogOfWar, orderMode }) {
  const asset    = selectedAsset ? assets.find(a => a.id === selectedAsset) : null;
  const canOrder = asset && asset.faction !== "ALPHA" && !asset.is_destroyed;
  const isBravo  = asset && asset.faction !== "ALPHA";

  const doCmd = async cmd => { if (cmd.trim()) await onExec(cmd); };

  const abilities = [
    { key:"Q", label:"HALT",     icon:"⊘",  color:C.alpha,   disabled:!isBravo,  active:false,        action:() => isBravo  && doCmd(`HALT ${asset.callsign}`) },
    { key:"W", label:"ENGAGE",   icon:"⚔",  color:C.fire,    disabled:!isBravo,  active:false,        action:() => isBravo  && doCmd(`ENGAGE ${asset.callsign}`) },
    { key:"E", label:"ACTIVE",   icon:"✦",  color:C.bravo,   disabled:!isBravo,  active:false,        action:() => isBravo  && doCmd(`ACTIVE ${asset.callsign}`) },
    { key:"R", label:"ORDERS",   icon:"🎯", color:"#c9a84c", disabled:!canOrder, active:!!orderMode,  action:() => canOrder && doCmd(`ORDER ${asset.callsign}`) },
    { key:"F", label:fogOfWar?"WAR FOG":"ALL MAP", icon:fogOfWar?"🌫":"🗺", color:fogOfWar?C.bravo:C.muted, disabled:false, active:fogOfWar, action:() => setFogOfWar(v=>!v) },
    { key:"G", label:"SEED",     icon:"⟳",  color:C.purple,  disabled:false,     active:false,        action:() => doCmd("SEED") },
    { key:"Z", label:"CLR LOG",  icon:"🗑", color:C.muted,   disabled:false,     active:false,        action:clearAlerts },
  ];

  return (
    <div style={{
      position:"absolute", bottom:0, left:0, right:0, zIndex:600, height:72,
      background:"linear-gradient(180deg,rgba(6,4,10,0.97),rgba(8,6,14,1))",
      borderTop:`1px solid ${C.border}`,
      display:"flex", alignItems:"center", padding:"0 20px", gap:10,
    }}>
      {/* Selected unit chip */}
      <div style={{
        flexShrink:0, minWidth:120, padding:"0 14px",
        borderRight:`1px solid ${C.border}`, height:"100%",
        display:"flex", flexDirection:"column", justifyContent:"center", gap:3,
      }}>
        {asset ? (
          <>
            <div style={{ fontSize:9, color: asset.faction==="ALPHA" ? C.alpha : C.bravo, fontWeight:700, letterSpacing:1.5 }}>{asset.callsign}</div>
            <div style={{ fontSize:10, color:C.sub }}>{(asset.status||"ACTIVE").toUpperCase()}</div>
            <div style={{ height:4, background:"rgba(0,0,0,0.4)", borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${asset.max_hp ? Math.max(0,Math.round((asset.hp??asset.max_hp)/asset.max_hp*100)) : 100}%`, background: (() => { const p = asset.max_hp ? Math.max(0,Math.round((asset.hp??asset.max_hp)/asset.max_hp*100)) : 100; return p > 60 ? C.bravo : p > 30 ? C.fire : C.alpha; })(), borderRadius:2 }}/>
            </div>
          </>
        ) : (
          <div style={{ fontSize:9, color:C.muted, letterSpacing:0.5, textAlign:"center", lineHeight:1.5 }}>
            ◆ CLICK<br/>A UNIT
          </div>
        )}
      </div>

      {/* Ability buttons */}
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        {abilities.map((b,i) => (
          <button key={i} onClick={b.action} disabled={b.disabled} title={`[${b.key}] ${b.label}`} style={{
            background: b.active   ? `${b.color}28`
                      : b.disabled ? "rgba(255,255,255,0.02)"
                      : `${b.color}0e`,
            border:`1px solid ${b.disabled ? "rgba(255,255,255,0.06)" : b.active ? b.color : `${b.color}44`}`,
            color: b.disabled ? "rgba(255,255,255,0.14)" : b.color,
            borderRadius:10, cursor:b.disabled?"not-allowed":"pointer",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            gap:3, padding:0, width:58, height:56, flexShrink:0,
            boxShadow: b.active ? `0 0 16px ${b.color}44, inset 0 0 12px ${b.color}18` : "none",
            transition:"all .1s", fontFamily:"'Courier New',monospace",
            position:"relative",
          }}>
            <span style={{ fontSize:18, lineHeight:1 }}>{b.icon}</span>
            <span style={{ fontSize:8, fontWeight:700, letterSpacing:0.8 }}>{b.label}</span>
            {/* Key badge */}
            <span style={{
              position:"absolute", top:4, right:4,
              fontSize:8, fontWeight:900, letterSpacing:0,
              color: b.disabled ? "rgba(255,255,255,0.1)" : `${b.color}cc`,
              background:`${b.color}15`, padding:"1px 4px", borderRadius:3,
              lineHeight:1,
            }}>{b.key}</span>
          </button>
        ))}
      </div>

      <div style={{ width:1, height:44, background:C.border, flexShrink:0 }}/>

      {/* Status readout */}
      <div style={{ flex:1, display:"flex", gap:12, alignItems:"center", padding:"0 8px" }}>
        {orderMode ? (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18, filter:`drop-shadow(0 0 8px ${C.bravo})` }}>🎯</span>
            <div>
              <div style={{ fontSize:11, color:C.bravo, fontWeight:700, letterSpacing:1 }}>PLACING WAYPOINTS — {orderMode.callsign}</div>
              <div style={{ fontSize:9, color:C.sub, marginTop:2 }}>{orderMode.waypoints?.length ?? 0} points marked · click map to add · press R or ESC to cancel</div>
            </div>
          </div>
        ) : asset ? (
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <span style={{ fontSize:26 }}>{asset.icon}</span>
            <div>
              <div style={{ fontSize:10, color:C.text, fontWeight:700 }}>{asset.name}</div>
              <div style={{ fontSize:9, color:C.sub, marginTop:2 }}>
                {asset.current_speed?.toFixed(0) ?? 0} km/h · {asset.current_heading?.toFixed(0) ?? 0}° · {asset.range_km ?? 0} km range
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize:10, color:C.muted, letterSpacing:1 }}>
            SELECT A UNIT · USE Q W E R KEYS · CLICK MAP TO NAVIGATE
          </div>
        )}
      </div>

      <div style={{ fontSize:26, flexShrink:0, filter:`drop-shadow(0 0 10px ${C.bravo}88)`, opacity:0.6 }}>⚜</div>
    </div>
  );
}

// ── Order Overlay ─────────────────────────────────────────────────────────────
function OrderOverlay({ orderMode, setOrderMode, onConfirm, onCancel, isMobile }) {
  if (!orderMode) return null;
  const { callsign, waypoints, patrol = true } = orderMode;

  const removeWp   = idx => setOrderMode(prev => ({ ...prev, waypoints: prev.waypoints.filter((_,i) => i!==idx) }));
  const undo       = ()  => setOrderMode(prev => ({ ...prev, waypoints: prev.waypoints.slice(0,-1) }));
  const toggleMode = ()  => setOrderMode(prev => ({ ...prev, patrol: !prev.patrol }));
  const moveWp = (idx, dir) => {
    const wps = [...waypoints];
    const t = idx + dir;
    if (t < 0 || t >= wps.length) return;
    [wps[idx], wps[t]] = [wps[t], wps[idx]];
    setOrderMode(prev => ({ ...prev, waypoints: wps }));
  };

  const totalKm = waypoints.reduce((acc, wp, i) => {
    if (i === 0) return acc;
    const p = waypoints[i-1];
    const dlat = (wp.lat - p.lat) * 111;
    const dlon = (wp.lon - p.lon) * 111 * Math.cos(p.lat * Math.PI / 180);
    return acc + Math.sqrt(dlat*dlat + dlon*dlon);
  }, 0);

  const btnBase = {
    borderRadius:8, fontSize:11, fontWeight:700,
    cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:1, border:"none",
    height: isMobile ? 44 : 36, padding: isMobile ? "0 16px" : "7px 14px",
  };

  return (
    <>
      {/* Top command banner */}
      <div style={{
        position:"absolute", top: isMobile ? 10 : 118, left:"50%", transform:"translateX(-50%)",
        zIndex:700,
        background:"linear-gradient(160deg,rgba(20,14,4,0.98),rgba(8,6,14,0.98))",
        border:`1px solid ${C.bravo}77`, borderTop:`2px solid ${C.bravo}`,
        borderRadius:10, padding: isMobile ? "12px 16px" : "11px 18px",
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
        fontFamily:"'Courier New',monospace",
        backdropFilter:"blur(16px)",
        boxShadow:`0 0 40px rgba(212,168,67,0.2)`,
        maxWidth: isMobile ? "calc(100vw - 32px)" : 700,
        width: isMobile ? "calc(100vw - 32px)" : undefined,
      }}>
        <span style={{ fontSize:22, filter:`drop-shadow(0 0 8px ${C.bravo})`, flexShrink:0 }}>🎯</span>
        <div style={{ flexShrink:0 }}>
          <div style={{ fontSize:isMobile?12:10, color:C.bravo, fontWeight:700, letterSpacing:2 }}>ORDERS — {callsign}</div>
          <div style={{ fontSize:isMobile?10:8, color:C.sub, marginTop:1 }}>
            {waypoints.length} waypoint{waypoints.length!==1?"s":""}
            {totalKm > 0 ? ` · ~${totalKm.toFixed(0)} km` : ""} · tap map to add
          </div>
        </div>
        <div style={{ width:1, height:32, background:C.border, flexShrink:0 }}/>
        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
          <button onClick={() => !patrol && toggleMode()} style={{
            ...btnBase, fontSize:isMobile?11:10,
            background: patrol ? `${C.bravo}20` : "rgba(255,255,255,0.03)",
            border:`1px solid ${patrol ? C.bravo : "rgba(255,255,255,0.08)"}`,
            color: patrol ? C.bravo : C.muted,
          }}>🔄 PATROL</button>
          <button onClick={() => patrol && toggleMode()} style={{
            ...btnBase, fontSize:isMobile?11:10,
            background: !patrol ? `${C.fire}20` : "rgba(255,255,255,0.03)",
            border:`1px solid ${!patrol ? C.fire : "rgba(255,255,255,0.08)"}`,
            color: !patrol ? C.fire : C.muted,
          }}>→ ONE-WAY</button>
        </div>
        <div style={{ width:1, height:32, background:C.border, flexShrink:0 }}/>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          <button onClick={undo} disabled={waypoints.length===0} style={{
            ...btnBase, background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`,
            color: waypoints.length===0 ? C.muted : C.sub, opacity: waypoints.length===0 ? 0.35 : 1,
            cursor: waypoints.length===0 ? "not-allowed" : "pointer",
          }}>⌫ UNDO</button>
          <button onClick={onConfirm} disabled={waypoints.length===0} style={{
            ...btnBase, background:`${C.bravo}1e`, border:`1px solid ${C.bravo}77`, color:C.bravo,
            cursor: waypoints.length===0 ? "not-allowed" : "pointer", opacity: waypoints.length===0 ? 0.35 : 1,
            boxShadow: waypoints.length>0 ? `0 0 14px ${C.bravo}33` : "none",
          }}>CONFIRM ✓</button>
          <button onClick={onCancel} style={{
            ...btnBase, background:`${C.alpha}12`, border:`1px solid ${C.alpha}55`, color:C.alpha,
          }}>CANCEL ✕</button>
        </div>
      </div>

      {/* Waypoint list — desktop only */}
      {!isMobile && waypoints.length > 0 && (
        <div style={{
          position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
          zIndex:700, width:210,
          background:"linear-gradient(160deg,rgba(14,10,4,0.97),rgba(8,6,14,0.97))",
          border:`1px solid ${C.border}`, borderTop:`2px solid ${C.bravo}`,
          borderRadius:10, padding:"12px 0", fontFamily:"'Courier New',monospace",
          backdropFilter:"blur(16px)", maxHeight:360, display:"flex", flexDirection:"column",
        }}>
          <div style={{ fontSize:9, color:C.bravo, fontWeight:700, letterSpacing:2, padding:"0 14px 8px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
            ⚔ ROUTE PLAN
          </div>
          <div style={{ overflowY:"auto", flex:1, padding:"6px 0" }}>
            {waypoints.map((wp, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderBottom:`1px solid rgba(212,168,67,0.05)` }}>
                <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0, background:`radial-gradient(circle,${C.bravo},#8b6010)`, border:"1px solid rgba(255,255,255,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:900, color:"#000" }}>{i+1}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:8, color:C.text, fontWeight:600 }}>{wp.lat.toFixed(3)}°N</div>
                  <div style={{ fontSize:8, color:C.sub }}>{wp.lon.toFixed(3)}°E</div>
                </div>
                <div style={{ display:"flex", gap:2 }}>
                  {[[-1,"↑"],[1,"↓"]].map(([d,arrow]) => (
                    <button key={d} onClick={() => moveWp(i,d)} disabled={d===-1?i===0:i===waypoints.length-1} style={{
                      background:"transparent", border:`1px solid ${C.border}`, color:C.sub, borderRadius:3,
                      width:16, height:16, fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, opacity:(d===-1?i===0:i===waypoints.length-1)?0.25:1,
                    }}>{arrow}</button>
                  ))}
                  <button onClick={() => removeWp(i)} style={{ background:`${C.alpha}12`, border:`1px solid ${C.alpha}33`, color:C.alpha, borderRadius:3, width:16, height:16, fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
          {patrol && <div style={{ padding:"7px 14px 0", borderTop:`1px solid ${C.border}`, flexShrink:0, fontSize:9, color:C.bravo }}>↩ loops back to origin</div>}
          {totalKm > 0 && (
            <div style={{ padding:"6px 14px", flexShrink:0, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:9, color:C.muted }}>TOTAL</span>
              <span style={{ fontSize:9, color:C.bravo, fontWeight:700 }}>{totalKm.toFixed(0)} km</span>
            </div>
          )}
        </div>
      )}

      {/* Crosshair hint */}
      <div style={{
        position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        zIndex:600, pointerEvents:"none", textAlign:"center",
        fontFamily:"'Courier New',monospace", color:C.bravo, textShadow:`0 0 24px ${C.bravo}`,
      }}>
        <div style={{ fontSize: isMobile ? 14 : 12, fontWeight:700, letterSpacing:2 }}>
          {isMobile ? "TAP MAP TO ADD WAYPOINTS" : "CLICK MAP TO MARK WAYPOINTS"}
        </div>
        <div style={{ fontSize:isMobile?11:9, color:C.sub, marginTop:4 }}>
          {waypoints.length} point{waypoints.length!==1?"s":""} · {patrol ? "PATROL LOOP" : "ONE-WAY"}
        </div>
      </div>
    </>
  );
}

// ── End Game Overlay ──────────────────────────────────────────────────────────
function EndGameOverlay({ ms, bravoLive, alphaLive, onReset, onDismiss }) {
  if (!ms || ms.status === "ACTIVE") return null;
  const bravoWins = ms.status === "BRAVO_WINS";
  const accent = bravoWins ? C.bravo : C.alpha;
  const bScore = ms.bravo_score ?? 0;
  const aScore = ms.alpha_score ?? 0;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:900,
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Courier New',monospace", padding:"16px",
    }}>
      <div style={{
        position:"relative",
        background:"linear-gradient(160deg,rgba(14,10,4,0.99),rgba(6,4,12,0.99))",
        border:`1px solid ${accent}55`, borderTop:`3px solid ${accent}`,
        borderRadius:14, padding:"32px 28px",
        maxWidth:520, width:"100%", textAlign:"center",
        boxShadow:`0 0 100px ${accent}22`,
      }}>
        <div style={{ fontSize:52, marginBottom:12, filter:`drop-shadow(0 0 24px ${accent})`, animation:"victoryPulse 2s ease-in-out infinite" }}>
          {bravoWins ? "🏰" : "💀"}
        </div>
        <div style={{ fontSize:22, fontWeight:900, color:accent, letterSpacing:4, marginBottom:4, textShadow:`0 0 40px ${accent}` }}>
          {bravoWins ? "★ THE REALM HOLDS" : "☠ THE REALM FALLS"}
        </div>
        <div style={{ fontSize:10, color:C.sub, letterSpacing:2, marginBottom:28 }}>
          {bravoWins ? "INDIA STANDS — HONOUR AND GLORY" : "ALPHA FORCES VICTORIOUS — THE REALM BURNS"}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:10, alignItems:"center", marginBottom:20 }}>
          {[
            { label:"◆ BRAVO", score:bScore, wins:bravoWins, accent:C.bravo,
              stats:[["KILLS",ms.alpha_assets_destroyed??0],["HOLDS",ms.zones_controlled_bravo??0],["STANDING",bravoLive]] },
            null,
            { label:"▲ ALPHA", score:aScore, wins:!bravoWins, accent:C.alpha,
              stats:[["KILLS",ms.bravo_assets_destroyed??0],["HOLDS",ms.zones_controlled_alpha??0],["STANDING",alphaLive]] },
          ].map((side, i) => side === null ? (
            <div key={i} style={{ fontSize:12, color:"rgba(255,255,255,0.1)", fontWeight:700 }}>VS</div>
          ) : (
            <div key={i} style={{
              background:side.wins?`${side.accent}0d`:"rgba(255,255,255,0.02)",
              border:`1px solid ${side.wins?`${side.accent}55`:"rgba(255,255,255,0.06)"}`,
              borderRadius:10, padding:"14px 10px",
            }}>
              <div style={{ fontSize:10, color:side.accent, letterSpacing:2, marginBottom:5 }}>{side.label}</div>
              <div style={{ fontSize:28, fontWeight:900, color:side.accent, marginBottom:3, textShadow:`0 0 16px ${side.accent}88` }}>
                {side.score.toLocaleString()}
              </div>
              <div style={{ fontSize:8, color:C.muted, marginBottom:8 }}>POINTS</div>
              {side.stats.map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:10, marginBottom:4 }}>
                  <span style={{ color:C.muted }}>{k}</span>
                  <span style={{ color:side.accent, fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ background:`linear-gradient(90deg,transparent,${accent}18,transparent)`, border:`1px solid ${accent}33`, borderRadius:6, padding:"9px 0", marginBottom:22, fontSize:10, color:accent, fontWeight:700, letterSpacing:1 }}>
          {bravoWins
            ? `BRAVO +${(bScore-aScore).toLocaleString()} pts · ${ms.alpha_assets_destroyed??0} enemies slain`
            : `ALPHA +${(aScore-bScore).toLocaleString()} pts · ${ms.bravo_assets_destroyed??0} BRAVO fallen`}
        </div>

        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button onClick={onReset} style={{
            background:`${C.bravo}18`, border:`1px solid ${C.bravo}77`, color:C.bravo,
            borderRadius:10, padding:"14px 28px", fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"'Courier New',monospace", letterSpacing:2,
            boxShadow:`0 0 20px ${C.bravo}33`,
          }}>⟳  NEW BATTLE</button>
          <button onClick={onDismiss} style={{
            background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`,
            color:C.sub, borderRadius:10, padding:"14px 20px",
            fontSize:12, cursor:"pointer", fontFamily:"'Courier New',monospace",
          }}>SURVEY MAP</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const auth    = useAuth();
  const tracker = useTracker();
  const isMobile = useIsMobile();

  const [selectedAsset,  setSelectedAsset]  = useState(null);
  const [selectedConvoy, setSelectedConvoy] = useState(null);
  const [clock,          setClock]          = useState(new Date());
  const [activeCmd,      setActiveCmd]      = useState("ALL");
  const [activeSector,   setActiveSector]   = useState("ALL");
  const [fogOfWar,       setFogOfWar]       = useState(true);
  const [orderMode,      setOrderMode]      = useState(null);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const { toasts, add: addToast } = useToasts();

  _ue(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  _ue(() => {
    if (tracker.matchState?.status === "ACTIVE") setMatchDismissed(false);
  }, [tracker.matchState?.status]);

  // Global keyboard shortcuts — Q W E R F G Z (no text input needed)
  _ue(() => {
    const onKey = e => {
      // Don't fire if user is typing in an actual input/textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      const key = e.key.toUpperCase();
      const selectedA2 = selectedAsset ? (tracker.assets||[]).find(x => x.id===selectedAsset) : null;
      const isBravo2 = selectedA2 && selectedA2.faction !== "ALPHA" && !selectedA2.is_destroyed;
      switch (key) {
        case "Q": if (isBravo2) { handleExecCommand(`HALT ${selectedA2.callsign}`); } break;
        case "W": if (isBravo2) { handleExecCommand(`ENGAGE ${selectedA2.callsign}`); } break;
        case "E": if (isBravo2) { handleExecCommand(`ACTIVE ${selectedA2.callsign}`); } break;
        case "R":
          if (isBravo2) {
            if (orderMode?.assetId === selectedA2.id) setOrderMode(null);
            else setOrderMode({ assetId:selectedA2.id, callsign:selectedA2.callsign??selectedA2.name, waypoints:[], patrol:true });
          }
          break;
        case "F": setFogOfWar(v=>!v); break;
        case "G": handleExecCommand("SEED"); break;
        case "Z": tracker.clearAlerts?.(); break;
        case "ESCAPE": if (orderMode) setOrderMode(null); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedAsset, tracker.assets, tracker.clearAlerts, orderMode, handleExecCommand]);

  // Close sidebar on map tap (mobile)
  _ue(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleCmdChange = useCallback(cmd => {
    setActiveCmd(cmd); setActiveSector(cmd);
  }, []);

  const handleExecCommand = useCallback(async cmd => {
    const result = await tracker.executeCommand(cmd);
    if (result.ok && result.msg?.startsWith("__ORDER__:")) {
      const [, assetId, callsign] = result.msg.split(":");
      setOrderMode({ assetId, callsign, waypoints:[], patrol:true });
      setSelectedAsset(assetId);
      addToast(`🎯 ORDERS — ${callsign}. Mark waypoints on the map.`, true);
      return result;
    }
    if (result.msg && result.msg !== "__CLEAR__") addToast(result.msg, result.ok);
    return result;
  }, [tracker, addToast]);

  if (auth.loading) {
    return (
      <div style={{ position:"fixed", inset:0, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Courier New',monospace" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:56, marginBottom:18, filter:`drop-shadow(0 0 24px ${C.bravo}) drop-shadow(0 0 50px ${C.bravo}44)` }}>⚜</div>
          <div style={{ fontSize:12, letterSpacing:4, color:C.bravo, animation:"pulse 1s infinite", textShadow:`0 0 16px ${C.bravo}` }}>AWAKENING THE REALM...</div>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.15}}`}</style>
      </div>
    );
  }

  if (!auth.session) {
    return <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} onOAuth={auth.signInWithOAuth} authError={auth.authError}/>;
  }

  const pad = n => String(n).padStart(2, "0");
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
  const ms         = tracker.matchState;
  const bravoLive  = (tracker.assets||[]).filter(a => a.faction==="BRAVO" && !a.is_destroyed).length;
  const alphaLive  = (tracker.assets||[]).filter(a => a.faction==="ALPHA" && !a.is_destroyed).length;
  const critCount  = (tracker.alerts||[]).filter(a => a.severity==="CRITICAL" || a.severity==="EMERGENCY").length;
  const selectedA  = selectedAsset ? (tracker.assets||[]).find(x => x.id===selectedAsset) : null;
  const engagedCnt = (tracker.assets||[]).filter(a => (a.status||"").toUpperCase()==="ENGAGED").length;

  const sidebarProps = {
    ...tracker,
    selectedAssetId: selectedAsset,
    onSelectAsset: setSelectedAsset,
    selectedConvoyId: selectedConvoy,
    onSelectConvoy: setSelectedConvoy,
    activeCmd, onCmdChange: handleCmdChange,
    activeSector, onSectorChange: setActiveSector,
    onSignOut: auth.signOut,
    user: auth.user,
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:C.bg, overflow:"hidden", fontFamily:"'Courier New',monospace" }}>

      {/* ── TOP BAR ───────────────────────────────────────────── */}
      <div style={{
        height: isMobile ? 48 : 54, flexShrink:0,
        background:"linear-gradient(180deg,rgba(14,10,4,0.99),rgba(8,6,14,0.99))",
        borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding: isMobile ? "0 14px" : "0 18px", gap:12, zIndex:600,
        boxShadow:"0 2px 20px rgba(0,0,0,0.6)",
      }}>
        {/* Left: brand */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ fontSize:22, filter:`drop-shadow(0 0 12px ${C.bravo})` }}>⚜</div>
          <div>
            <div style={{ fontSize: isMobile ? 14 : 16, fontWeight:900, color:C.bravo, letterSpacing:4, lineHeight:1, textShadow:`0 0 16px ${C.bravo}` }}>BRCS</div>
            {!isMobile && <div style={{ fontSize:7, color:C.muted, letterSpacing:2.5 }}>BHARAT RAKSHA COMMAND SYSTEM</div>}
          </div>
          {!isMobile && (
            <>
              <div style={{ width:1, height:30, background:C.border }}/>
              <div style={{ fontSize:10, color:C.sub, letterSpacing:1.5 }}>{activeCmd==="ALL"?"ALL SECTORS":activeCmd}</div>
            </>
          )}
        </div>

        {/* Center: stat pills — hidden on mobile */}
        {!isMobile && (
          <div style={{ display:"flex", gap:5 }}>
            {[
              { label:"FORCES",   value:(tracker.assets||[]).length,  color:C.bravo },
              { label:"IN BATTLE",value:engagedCnt,                   color:C.fire  },
              { label:"HALTED",   value:(tracker.assets||[]).filter(a=>["HALTED","MAINTENANCE","DISABLED"].includes((a.status||"").toUpperCase())).length, color:C.alpha },
              { label:"ALERTS",   value:(tracker.alerts||[]).length,  color:critCount>0?C.alpha:"#d47820" },
              { label:"ZONES",    value:(tracker.zones||[]).length,   color:C.ice   },
            ].map(s => (
              <div key={s.label} style={{ background:`${s.color}0c`, border:`1px solid ${s.color}2a`, borderRadius:6, padding:"3px 11px", textAlign:"center", minWidth:56 }}>
                <div style={{ fontSize:17, fontWeight:900, color:s.color, lineHeight:1, textShadow:`0 0 10px ${s.color}88` }}>{s.value}</div>
                <div style={{ fontSize:7, color:C.muted, letterSpacing:0.8, marginTop:1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Mobile: compact stat pills */}
        {isMobile && (
          <div style={{ display:"flex", gap:6, flex:1, justifyContent:"center" }}>
            {[
              { value:(tracker.assets||[]).length, color:C.bravo, icon:"⚔" },
              { value:critCount, color:critCount>0?C.alpha:"#d47820", icon:"⚠" },
              { value:(tracker.zones||[]).length, color:C.ice, icon:"🗺" },
            ].map((s,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:4, background:`${s.color}10`, border:`1px solid ${s.color}25`, borderRadius:6, padding:"3px 8px" }}>
                <span style={{ fontSize:11 }}>{s.icon}</span>
                <span style={{ fontSize:13, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Right: clock + status */}
        <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 8 : 16, flexShrink:0 }}>
          {!isMobile && (
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:17, fontWeight:700, color:C.text, letterSpacing:2.5, fontVariantNumeric:"tabular-nums" }}>{timeStr}</div>
              <div style={{ fontSize:7, color:C.muted, letterSpacing:1.5 }}>
                {clock.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})} IST
              </div>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{
              width:8, height:8, borderRadius:"50%",
              background:tracker.connected?C.bravo:C.alpha,
              boxShadow:tracker.connected?`0 0 8px ${C.bravo}`:`0 0 8px ${C.alpha}`,
              animation:tracker.connected?"pulse 1.5s ease-in-out infinite":"none",
            }}/>
            {!isMobile && (
              <span style={{ fontSize:9, fontWeight:700, color:tracker.connected?C.bravo:C.alpha, letterSpacing:1 }}>
                {tracker.connected?"LIVE":"OFFLINE"}
              </span>
            )}
          </div>
          {/* Sidebar toggle (both mobile and desktop for convenience) */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{
              background: sidebarOpen ? `${C.bravo}18` : "rgba(255,255,255,0.04)",
              border:`1px solid ${sidebarOpen ? `${C.bravo}55` : C.border}`,
              color: sidebarOpen ? C.bravo : C.sub,
              borderRadius:8, cursor:"pointer",
              width: isMobile ? 38 : 34, height: isMobile ? 38 : 30,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, transition:"all .15s",
            }}
          >☰</button>
        </div>
      </div>

      {/* ── CRITICAL ALERT TICKER ─────────────────────────────── */}
      {critCount > 0 && (
        <div style={{
          height:28, flexShrink:0,
          background:"rgba(139,26,42,0.08)", borderBottom:"1px solid rgba(196,30,58,0.3)",
          display:"flex", alignItems:"center", overflow:"hidden",
        }}>
          <div style={{ flexShrink:0, background:C.alpha, color:"#fff", fontSize:9, fontWeight:700, padding:"0 14px", height:"100%", display:"flex", alignItems:"center", letterSpacing:1.5 }}>☠ CRITICAL</div>
          <div style={{ display:"flex", gap:24, padding:"0 16px", overflow:"hidden" }}>
            {tracker.alerts.filter(a=>a.severity==="CRITICAL"||a.severity==="EMERGENCY").slice(0,5).map(a=>(
              <span key={a.id} style={{ fontSize:10, color:C.alpha, whiteSpace:"nowrap" }}>
                {a.asset_icon} <b>{a.asset_name}</b> — {a.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN BODY ─────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>

        {/* ── Sidebar (desktop: inline | mobile: overlay drawer) ── */}
        {!isMobile && sidebarOpen && (
          <div style={{ flexShrink:0, width:320, overflow:"hidden", display:"flex" }}>
            <Sidebar {...sidebarProps}/>
          </div>
        )}

        {/* Mobile sidebar drawer + backdrop */}
        {isMobile && (
          <>
            {sidebarOpen && (
              <div
                onClick={() => setSidebarOpen(false)}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:800, backdropFilter:"blur(2px)" }}
              />
            )}
            <div style={{
              position:"fixed", top:0, right: sidebarOpen ? 0 : "-100%",
              height:"100%", zIndex:801,
              width:"min(340px, 90vw)",
              transition:"right 0.28s cubic-bezier(.4,0,.2,1)",
              overflow:"hidden",
              boxShadow: sidebarOpen ? "-8px 0 40px rgba(0,0,0,0.8)" : "none",
            }}>
              <Sidebar {...sidebarProps}/>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  position:"absolute", top:10, left:10, zIndex:10,
                  background:"rgba(0,0,0,0.8)", border:`1px solid ${C.border}`,
                  color:C.sub, borderRadius:8, width:36, height:36,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer", fontSize:16,
                }}>✕</button>
            </div>
          </>
        )}

        {/* ── MAP AREA ─────────────────────────────────────────── */}
        <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
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
              setOrderMode(prev => ({ ...prev, waypoints:[...prev.waypoints, {lat:latlng.lat, lon:latlng.lng}] }));
            } : null}
          />

          {/* Score HUD */}
          <MatchHUD ms={ms} bravoLive={bravoLive} alphaLive={alphaLive} isMobile={isMobile}/>

          {/* Service counters — desktop only */}
          {!isMobile && (
            <div style={{ position:"absolute", top:10, right:10, zIndex:500, display:"flex", flexDirection:"column", gap:5 }}>
              {Object.entries(SVC_ICON).map(([svc,icon]) => {
                const cnt = (tracker.assets||[]).filter(a=>a.service===svc&&!a.is_destroyed).length;
                if (!cnt) return null;
                return (
                  <div key={svc} style={{
                    background:"linear-gradient(135deg,rgba(14,10,4,0.97),rgba(8,6,14,0.97))",
                    border:`1px solid ${SVC_COLOR[svc]}33`, borderLeft:`2px solid ${SVC_COLOR[svc]}88`,
                    borderRadius:7, padding:"5px 11px", display:"flex", alignItems:"center", gap:8,
                    backdropFilter:"blur(10px)",
                  }}>
                    <span style={{ fontSize:15 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize:14, fontWeight:900, color:SVC_COLOR[svc], lineHeight:1, textShadow:`0 0 10px ${SVC_COLOR[svc]}88` }}>{cnt}</div>
                      <div style={{ fontSize:7, color:C.muted, letterSpacing:1 }}>{svc.replace("_"," ")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Path result HUD */}
          {tracker.pathResult && !isMobile && (
            <div style={{
              position:"absolute", bottom:74, left:10, zIndex:500,
              background:"linear-gradient(160deg,rgba(14,10,4,0.97),rgba(8,6,14,0.97))",
              border:`1px solid ${C.bravo}33`, borderTop:`2px solid ${C.bravo}`,
              borderRadius:8, padding:"12px 16px", backdropFilter:"blur(12px)", minWidth:185,
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.bravo, letterSpacing:2, marginBottom:8 }}>
                PATH · {tracker.pathResult.algo??tracker.pathResult.algorithm}
              </div>
              {[
                ["DISTANCE",`${tracker.pathResult.distance_km?.toFixed(2)} km`],
                ["WAYPOINTS", tracker.pathResult.waypoints?.length],
                ["NODES",    tracker.pathResult.nodes_visited],
                ["COMPUTE",  `${tracker.pathResult.compute_ms?.toFixed(1)} ms`],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:3 }}>
                  <span style={{ color:C.muted }}>{k}</span>
                  <span style={{ color:C.bravo, fontWeight:700 }}>{v}</span>
                </div>
              ))}
              <button onClick={()=>tracker.setPathResult(null)} style={{ marginTop:7, width:"100%", background:`${C.bravo}0c`, border:`1px solid ${C.border}`, color:C.muted, borderRadius:5, padding:"4px", fontSize:9, cursor:"pointer", fontFamily:"inherit" }}>CLEAR PATH</button>
            </div>
          )}

          {/* Order overlay */}
          <OrderOverlay
            orderMode={orderMode}
            setOrderMode={setOrderMode}
            isMobile={isMobile}
            onConfirm={async () => {
              if (!orderMode?.waypoints?.length) { setOrderMode(null); return; }
              try {
                await tracker.issueOrder(orderMode.assetId, orderMode.waypoints, orderMode.patrol ?? true);
                setOrderMode(null);
                const modeLabel = (orderMode.patrol ?? true) ? "PATROL" : "ONE-WAY";
                addToast(`✓ Orders dispatched — ${modeLabel} route (${orderMode.waypoints.length} waypoints)`, true);
              } catch(e) { addToast("Orders failed: "+e.message, false); }
            }}
            onCancel={() => setOrderMode(null)}
          />

          {/* Selected unit card */}
          <AssetCard
            asset={selectedA}
            onClose={() => setSelectedAsset(null)}
            onOrder={() => selectedA && setOrderMode({ assetId:selectedA.id, callsign:selectedA.callsign??selectedA.name, waypoints:[], patrol:true })}
            orderMode={orderMode?.assetId===selectedA?.id ? orderMode : null}
            isMobile={isMobile}
          />

          {/* Toasts */}
          <ToastLayer toasts={toasts} isMobile={isMobile}/>

          {/* Command bars */}
          {isMobile ? (
            <MobileCommandBar
              selectedAsset={selectedAsset}
              assets={tracker.assets||[]}
              onExec={handleExecCommand}
              clearAlerts={tracker.clearAlerts}
              fogOfWar={fogOfWar}
              setFogOfWar={setFogOfWar}
              orderMode={orderMode}
              onOpenMenu={() => setSidebarOpen(true)}
            />
          ) : (
            <DesktopCommandBar
              selectedAsset={selectedAsset}
              assets={tracker.assets||[]}
              onExec={handleExecCommand}
              clearAlerts={tracker.clearAlerts}
              fogOfWar={fogOfWar}
              setFogOfWar={setFogOfWar}
              orderMode={orderMode}
              setOrderMode={setOrderMode}
            />
          )}
        </div>
      </div>

      {/* End game overlay */}
      {ms && ms.status !== "ACTIVE" && !matchDismissed && (
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
        @keyframes pulse           { 0%,100%{opacity:1}       50%{opacity:.15} }
        @keyframes pulseOpacity    { from{opacity:.6}          to{opacity:1}    }
        @keyframes victoryPulse    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes toastIn         { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        ::-webkit-scrollbar        { width:3px }
        ::-webkit-scrollbar-track  { background:transparent }
        ::-webkit-scrollbar-thumb  { background:rgba(212,168,67,0.2); border-radius:2px }
        select option              { background:#08060c; color:#e8dcc8 }
        input::placeholder         { color:#5a5040; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none }
        button:hover:not(:disabled){ filter:brightness(1.15); }
        button:active:not(:disabled){ transform:scale(0.96); }
      `}</style>
    </div>
  );
}
