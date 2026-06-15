import React, { useState, useMemo } from "react";
import ConvoyTab from "./ConvoyTab";

// ── Fantasy Design tokens ──────────────────────────────────────
const T = {
  bg0:"#08060c", bg1:"#0c0a10", bg2:"#100e18", bg3:"#141020",
  green:"#d4a843", g2:"#d4a843", g3:"#b8922e",
  red:"#c41e3a", orange:"#d47820", yellow:"#c9a84c",
  blue:"#4a8aaa", purple:"#9b59d0",
  muted:"#5a5040", dim:"rgba(212,168,67,0.07)", faint:"rgba(212,168,67,0.04)",
  textSub:"#7a6a50",
};

const SEV  = { CRITICAL:"#c41e3a", WARNING:"#d47820", INFO:"#d4a843", EMERGENCY:"#9b59d0" };
const SVC  = { ARMY:"#d4a843", AIR_FORCE:"#7ecfea", NAVY:"#4a8aaa", SPECIAL_FORCES:"#9b59d0", MARINES:"#d47820" };
const ZC   = { FOB:"#d4a843", HOSTILE:"#c41e3a", RESTRICTED:"#d47820", CIVILIAN:"#4a8aaa", MINEFIELD:"#8b1a1a", NO_FLY:"#9b59d0", SUPPLY:"#3a8a5a" };

// Indian Armed Forces command hierarchy
const COMMANDS = {
  ALL:      { label:"All Sectors",          short:"ALL",  hq:"—",              svc:null },
  WESTERN:  { label:"Western Command",      short:"WC",   hq:"Chandimandir",   svc:"ARMY",          corps:["I Corps","X Corps","XI Corps"] },
  SW:       { label:"South Western Command",short:"SWC",  hq:"Jaipur",         svc:"ARMY",          corps:["II Corps"] },
  NORTHERN: { label:"Northern Command",     short:"NC",   hq:"Udhampur",       svc:"ARMY",          corps:["XIV Corps","XV Corps","XVI Corps"] },
  EASTERN:  { label:"Eastern Command",      short:"EC",   hq:"Fort William",   svc:"ARMY",          corps:["III Corps","IV Corps","XXXIII Corps"] },
  SOUTHERN: { label:"Southern Command",     short:"SC",   hq:"Pune",           svc:"ARMY",          corps:["XII Corps","XXI Corps"] },
  CENTRAL:  { label:"Central Command",      short:"CC",   hq:"Lucknow",        svc:"ARMY",          corps:["VI Corps"] },
  ARTC:     { label:"Army Training Cmd",    short:"ATC",  hq:"Shimla",         svc:"ARMY" },
  WAC:      { label:"Western Air Command",  short:"WAC",  hq:"New Delhi",      svc:"AIR_FORCE" },
  SWAC:     { label:"SW Air Command",       short:"SWAC", hq:"Gandhinagar",    svc:"AIR_FORCE" },
  CAC:      { label:"Central Air Command",  short:"CAC",  hq:"Allahabad",      svc:"AIR_FORCE" },
  EAC:      { label:"Eastern Air Command",  short:"EAC",  hq:"Shillong",       svc:"AIR_FORCE" },
  SAC:      { label:"Southern Air Command", short:"SAC",  hq:"Thiruvananthapuram", svc:"AIR_FORCE" },
  WNC:      { label:"Western Naval Command",short:"WNC",  hq:"Mumbai",         svc:"NAVY" },
  ENC:      { label:"Eastern Naval Command",short:"ENC",  hq:"Visakhapatnam",  svc:"NAVY" },
  SNC:      { label:"Southern Naval Command",short:"SNC", hq:"Kochi",          svc:"NAVY" },
  SFC:      { label:"Special Forces Command",short:"SFC", hq:"Agra",           svc:"SPECIAL_FORCES" },
};

function getCommandForAsset(a) {
  const svc = a.service || "ARMY";
  const lat  = a.current_lat  || 28;
  const lon  = a.current_lon  || 77;
  if (svc === "SPECIAL_FORCES") return "SFC";
  if (svc === "AIR_FORCE") {
    if (lon < 79) return "WAC";
    if (lat < 20) return "SAC";
    if (lat > 25 && lon < 78) return "CAC";
    if (lon > 85) return "EAC";
    return "SWAC";
  }
  if (svc === "NAVY") {
    if (lon > 82) return "ENC";
    if (lat < 12) return "SNC";
    return "WNC";
  }
  // Army
  if (lat > 32) return "NORTHERN";
  if (lat > 28 && lon < 76) return "WESTERN";
  if (lat > 26 && lat <= 28 && lon < 77) return "SW";
  if (lat > 23 && lon > 84) return "EASTERN";
  if (lat > 18 && lat <= 23) return "SOUTHERN";
  if (lat > 23 && lat <= 28 && lon > 77) return "CENTRAL";
  return "SOUTHERN";
}

const ALGOS = [
  { id:"ASTAR",          label:"A*",            desc:"Optimal heuristic search — best overall performance" },
  { id:"AO_STAR",        label:"AO*",           desc:"AND-OR graph decomposition — optimal for compound goals" },
  { id:"DIJKSTRA",       label:"Dijkstra",      desc:"Shortest path, exhaustive edge exploration" },
  { id:"BFS",            label:"BFS",           desc:"Breadth-first, uniform cost unweighted" },
  { id:"DFS",            label:"DFS",           desc:"Depth-first stack traversal" },
  { id:"FLOYD_WARSHALL", label:"Floyd-Warshall",desc:"All-pairs shortest path O(n³)" },
  { id:"PRIMS",          label:"Prim's MST",    desc:"Minimum spanning tree — greedy approach" },
  { id:"KRUSKALS",       label:"Kruskal's MST", desc:"MST via sorted edge union-find" },
];

const inp = {
  width:"100%", background:"rgba(255,255,255,0.04)", color:"#e2e8f0",
  border:`1px solid rgba(255,255,255,0.1)`, borderRadius:6, padding:"7px 10px",
  fontSize:11, fontFamily:"'Courier New',monospace", outline:"none",
  display:"block", marginTop:4,
};

const Btn = ({ children, onClick, color=T.g2, disabled=false, full=false, small=false, style:s={} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background:disabled?"transparent":`${color}12`,
    border:`1px solid ${disabled?"rgba(255,255,255,0.06)":color+"44"}`,
    color:disabled?"rgba(255,255,255,0.18)":color,
    borderRadius:6, padding: small?"3px 10px":"7px 16px",
    fontSize:small?9:11, fontWeight:700, cursor:disabled?"not-allowed":"pointer",
    fontFamily:"'Courier New',monospace", letterSpacing:1,
    width:full?"100%":undefined, transition:"all .13s",
    ...s,
  }}>{children}</button>
);

const Row = ({ label, value, color=T.green, small=false }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0", borderBottom:`1px solid ${T.faint}` }}>
    <span style={{ fontSize:small?8:10, color:T.textSub, letterSpacing:0.5 }}>{label}</span>
    <span style={{ fontSize:small?8:10, color, fontWeight:700 }}>{value}</span>
  </div>
);

const SectionHead = ({ children, extra }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${T.dim}` }}>
    <span style={{ fontSize:11, fontWeight:700, color:T.g2, letterSpacing:2 }}>{children}</span>
    {extra}
  </div>
);

const Badge = ({ text, color }) => (
  <span style={{ fontSize:8, padding:"1px 5px", borderRadius:2, background:`${color}1a`, border:`1px solid ${color}55`, color, fontWeight:700, letterSpacing:0.5 }}>{text}</span>
);

// ── COMMAND SELECTOR BAR ────────────────────────────────────────
function CommandBar({ activeCmd, onSelect }) {
  const armyCmds  = ["WESTERN","SW","NORTHERN","EASTERN","SOUTHERN","CENTRAL"];
  const airCmds   = ["WAC","SWAC","CAC","EAC","SAC"];
  const navyCmds  = ["WNC","ENC","SNC"];
  const sfCmds    = ["SFC"];
  const groups = [
    { label:"ARMY",          color:SVC.ARMY,           ids:armyCmds },
    { label:"AIR FORCE",     color:SVC.AIR_FORCE,      ids:airCmds  },
    { label:"NAVY",          color:SVC.NAVY,            ids:navyCmds },
    { label:"SPECIAL FORCES",color:SVC.SPECIAL_FORCES, ids:sfCmds   },
  ];

  return (
    <div style={{ marginBottom:10 }}>
      {/* ALL button */}
      <button onClick={()=>onSelect("ALL")} style={{
        width:"100%", marginBottom:6, padding:"4px 8px", fontFamily:"inherit",
        background:activeCmd==="ALL"?`${T.g2}18`:"transparent",
        border:`1px solid ${activeCmd==="ALL"?T.g2:T.dim}`,
        color:activeCmd==="ALL"?T.g2:T.muted,
        borderRadius:3, fontSize:9, fontWeight:700, cursor:"pointer", letterSpacing:1,
      }}>◈ ALL SECTORS — JOINT OPERATIONS</button>

      {groups.map(g => (
        <div key={g.label} style={{ marginBottom:6 }}>
          <div style={{ fontSize:7, color:T.textSub, letterSpacing:1, marginBottom:3 }}>{g.label}</div>
          <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
            {g.ids.map(id => {
              const cmd = COMMANDS[id];
              const active = activeCmd === id;
              return (
                <button key={id} onClick={()=>onSelect(active?"ALL":id)} title={`${cmd.label} · HQ: ${cmd.hq}`} style={{
                  background:active?`${g.color}1a`:"transparent",
                  border:`1px solid ${active?g.color:T.dim}`,
                  color:active?g.color:T.muted,
                  borderRadius:2, padding:"2px 6px", fontSize:8, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5, transition:"all .15s",
                }}>{cmd.short}</button>
              );
            })}
          </div>
          {activeCmd !== "ALL" && g.ids.includes(activeCmd) && COMMANDS[activeCmd].corps && (
            <div style={{ marginTop:4, paddingLeft:4, borderLeft:`2px solid ${g.color}44` }}>
              <div style={{ fontSize:7, color:T.textSub, letterSpacing:1, marginBottom:2 }}>CORPS</div>
              <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                {COMMANDS[activeCmd].corps.map(c => (
                  <span key={c} style={{ fontSize:8, color:T.muted, background:T.bg0, border:`1px solid ${T.dim}`, borderRadius:2, padding:"1px 5px" }}>{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── ASSETS TAB ─────────────────────────────────────────────────
function AssetsTab({ assets, selectedAssetId, onSelect, svcFilter, setSvcFilter, activeCmd }) {
  const SVCS = ["ALL","ARMY","AIR_FORCE","NAVY","SPECIAL_FORCES"];

  const filtered = useMemo(() => {
    return (assets || []).filter(a => {
      const svcOk = svcFilter === "ALL" || a.service === svcFilter;
      const cmdOk = activeCmd === "ALL" || getCommandForAsset(a) === activeCmd;
      return svcOk && cmdOk;
    });
  }, [assets, svcFilter, activeCmd]);

  const statusCount = useMemo(() => {
    const counts = { ACTIVE:0, ENGAGED:0, HALTED:0, OTHER:0 };
    filtered.forEach(a => {
      const s = (a.status || "ACTIVE").toUpperCase();
      if (s === "ACTIVE" || s === "OPERATIONAL" || s === "STANDBY") counts.ACTIVE++;
      else if (s === "ENGAGED") counts.ENGAGED++;
      else if (s === "HALTED" || s === "MAINTENANCE") counts.HALTED++;
      else counts.OTHER++;
    });
    return counts;
  }, [filtered]);

  return (
    <>
      {/* Status overview */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:4, marginBottom:10 }}>
        {[
          ["ACTIVE",   statusCount.ACTIVE,  T.g2],
          ["ENGAGED",  statusCount.ENGAGED, T.orange],
          ["HALTED",   statusCount.HALTED,  T.red],
        ].map(([k,v,c])=>(
          <div key={k} style={{ background:T.bg0, border:`1px solid ${T.dim}`, borderRadius:3, padding:"4px", textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:800, color:c, lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:7, color:T.textSub, letterSpacing:0.5, marginTop:1 }}>{k}</div>
          </div>
        ))}
      </div>

      {/* Service filter pills */}
      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:10 }}>
        {SVCS.map(s=>(
          <button key={s} onClick={()=>setSvcFilter(s)} style={{
            background:svcFilter===s?`${SVC[s]||T.g2}1a`:"transparent",
            border:`1px solid ${svcFilter===s?SVC[s]||T.g2:T.dim}`,
            color:svcFilter===s?SVC[s]||T.g2:T.muted,
            borderRadius:2, padding:"2px 6px", fontSize:7, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5, transition:"all .15s",
          }}>{s==="AIR_FORCE"?"IAF":s==="SPECIAL_FORCES"?"SF":s}</button>
        ))}
        <span style={{ marginLeft:"auto", fontSize:9, color:T.muted, alignSelf:"center" }}>{filtered.length} units</span>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:24, color:T.muted }}>
          <div style={{ fontSize:22, marginBottom:8 }}>📡</div>
          <div style={{ fontSize:10 }}>No units in this sector</div>
        </div>
      )}

      {filtered.map(a => {
        const tCol = {GREEN:T.g2,YELLOW:T.yellow,ORANGE:T.orange,RED:T.red}[a.threat_level]||T.g2;
        const sel  = a.id === selectedAssetId;
        const statusUpper = (a.status||"ACTIVE").toUpperCase();
        const isHalted  = ["HALTED","MAINTENANCE","DISABLED"].includes(statusUpper);
        const isEngaged = statusUpper === "ENGAGED";
        const inDanger  = (a.zoneStatus||[]).some(z=>(z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD")&&z.state==="IN");
        const statusColor = isHalted ? T.red : isEngaged ? T.orange : T.g2;

        return (
          <div key={a.id} onClick={()=>onSelect(sel?null:a.id)} style={{
            background: sel ? T.bg3 : inDanger ? "#ef440508" : T.bg2,
            border: `1px solid ${sel?tCol:inDanger?"#ef444433":T.dim}`,
            borderLeft: `3px solid ${tCol}`,
            borderRadius:3, padding:"7px 10px", cursor:"pointer",
            marginBottom:4, transition:"all .15s",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:20, filter:`drop-shadow(0 0 4px ${tCol})`, flexShrink:0 }}>{a.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", gap:3, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:T.green, letterSpacing:1 }}>{a.callsign}</span>
                  <Badge text={(a.service||"").replace("_"," ").slice(0,3)} color={SVC[a.service]||T.g2}/>
                  <Badge text={a.threat_level} color={tCol}/>
                  {isHalted  && <Badge text="HALT" color={T.red}/>}
                  {isEngaged && <Badge text="ENGAGED" color={T.orange}/>}
                </div>
                <div style={{ fontSize:8, color:T.muted, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</div>
                {a.current_lat && (
                  <div style={{ fontSize:8, color:T.textSub, marginTop:2 }}>
                    {a.current_speed?.toFixed(0)}km/h · {a.current_heading?.toFixed(0)}° · {a.asset_type}
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:8, color:statusColor, fontWeight:700, marginBottom:2 }}>{statusUpper}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  <div title="Fuel" style={{ width:32, height:3, background:T.dim, borderRadius:1 }}>
                    <div style={{ height:"100%", width:`${a.fuel_pct||100}%`, background:(a.fuel_pct||100)<20?T.red:T.g2, borderRadius:1 }}/>
                  </div>
                  <div title="Ammo" style={{ width:32, height:3, background:T.dim, borderRadius:1 }}>
                    <div style={{ height:"100%", width:`${a.ammo_pct||100}%`, background:(a.ammo_pct||100)<20?T.red:T.yellow, borderRadius:1 }}/>
                  </div>
                </div>
              </div>
            </div>
            {(a.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
              <div key={z.zoneId} style={{ fontSize:8, color:ZC[z.zoneType]||T.orange, marginTop:3, letterSpacing:0.3 }}>
                ▶ IN {z.zoneType}: {z.zoneName}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── ALERTS TAB ─────────────────────────────────────────────────
function AlertsTab({ alerts, onClear }) {
  const [filter, setFilter] = useState("ALL");
  const sevs = ["ALL","CRITICAL","WARNING","INFO"];
  const shown = filter==="ALL" ? alerts : alerts.filter(a=>a.severity===filter);
  return (
    <>
      <div style={{ display:"flex", gap:4, marginBottom:10, justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:3 }}>
          {sevs.map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{
              background:filter===s?`${SEV[s]||T.g2}1a`:"transparent",
              border:`1px solid ${filter===s?SEV[s]||T.g2:T.dim}`,
              color:filter===s?SEV[s]||T.g2:T.muted,
              borderRadius:2,padding:"2px 5px",fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            }}>{s}</button>
          ))}
        </div>
        <Btn onClick={onClear} color="#374151" small>CLR ALL</Btn>
      </div>
      {!shown.length ? (
        <div style={{ textAlign:"center", padding:32, color:T.muted }}>
          <div style={{ fontSize:22, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:11, letterSpacing:1 }}>ALL CLEAR</div>
          <div style={{ fontSize:9, marginTop:4, color:T.textSub }}>No active alerts</div>
        </div>
      ) : shown.map(a => {
        const c = SEV[a.severity]||T.g2;
        return (
          <div key={a.id} style={{
            background:`${c}08`, border:`1px solid ${c}2a`,
            borderLeft:`3px solid ${c}`, borderRadius:3,
            padding:"7px 10px", marginBottom:4,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
              <span style={{ width:5,height:5,borderRadius:"50%",background:c,display:"block",flexShrink:0,boxShadow:`0 0 4px ${c}` }}/>
              <span style={{ fontSize:8,color:c,fontWeight:700,letterSpacing:1 }}>{a.severity}</span>
              <Badge text={a.event_type} color={c}/>
              <span style={{ fontSize:7,color:T.muted,marginLeft:"auto" }}>{new Date(a.created_at).toLocaleTimeString("en-IN")}</span>
            </div>
            <div style={{ fontSize:11,color:T.green }}>{a.asset_icon} <b>{a.asset_name}</b></div>
            <div style={{ fontSize:9,color:T.muted,marginTop:2 }}>{a.message||`${a.event_type} · ${a.zone_name}`}</div>
          </div>
        );
      })}
    </>
  );
}

// ── ZONES TAB ──────────────────────────────────────────────────
function ZonesTab({ zones, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [form, setF]    = useState({ name:"", zone_type:"FOB", center_lat:"28.618", center_lon:"77.210", radius_meters:"5000" });
  const set = k => e => setF(f=>({...f,[k]:e.target.value}));
  const TYPES = ["FOB","HOSTILE","RESTRICTED","CIVILIAN","MINEFIELD","NO_FLY","SUPPLY","OBJECTIVE","BASE","SAFE","PATROL"];

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:10,color:T.muted }}>{(zones||[]).length} active zones</span>
        <Btn onClick={()=>setOpen(!open)} color={open?T.red:T.g2} small>{open?"✕ CANCEL":"+ DEPLOY ZONE"}</Btn>
      </div>

      {open && (
        <form onSubmit={e=>{e.preventDefault();onAdd({...form,center_lat:+form.center_lat,center_lon:+form.center_lon,radius_meters:+form.radius_meters});setOpen(false);}}
          style={{ background:T.bg0, border:`1px solid ${T.dim}`, borderRadius:3, padding:10, marginBottom:10 }}>
          <div style={{ fontSize:10,fontWeight:700,color:T.g2,letterSpacing:1,marginBottom:8 }}>DEPLOY NEW ZONE</div>
          {[["ZONE NAME","name","text"],["CENTER LAT","center_lat","number"],["CENTER LON","center_lon","number"],["RADIUS (m)","radius_meters","number"]].map(([l,k,t])=>(
            <label key={k} style={{ display:"block",fontSize:8,color:T.muted,marginBottom:6 }}>
              {l}
              <input type={t} value={form[k]} onChange={set(k)} required step="any" style={inp}/>
            </label>
          ))}
          <label style={{ display:"block",fontSize:8,color:T.muted,marginBottom:10 }}>
            ZONE TYPE
            <select value={form.zone_type} onChange={set("zone_type")} style={inp}>
              {TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <Btn color={T.g2} full>⊕ DEPLOY</Btn>
        </form>
      )}

      {(zones||[]).map(z => {
        const c = ZC[z.zone_type]||T.g2;
        return (
          <div key={z.id} style={{
            background:T.bg2, border:`1px solid ${T.dim}`, borderLeft:`3px solid ${c}`,
            borderRadius:3, padding:"7px 10px", marginBottom:3,
            display:"flex", alignItems:"center", gap:8,
          }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                <span style={{ fontSize:11,color:T.green,fontWeight:700 }}>{z.name}</span>
                <Badge text={z.zone_type} color={c}/>
              </div>
              <div style={{ fontSize:8,color:T.muted,marginTop:2 }}>
                {z.center_lat?.toFixed(4)}°N · {z.center_lon?.toFixed(4)}°E · r={z.radius_meters}m
              </div>
            </div>
            <Btn onClick={()=>onRemove(z.id)} color={T.red} small>✕</Btn>
          </div>
        );
      })}
    </>
  );
}

// ── PATHFINDING TAB ────────────────────────────────────────────
function PathfindTab({ assets, pathResult, pathLoading, onRun, onClear, selectedAssetId }) {
  const [assetId, setAssetId] = useState(selectedAssetId ?? "");
  const [endLat,  setEndLat]  = useState("28.6260");
  const [endLon,  setEndLon]  = useState("77.2280");
  const [algo,    setAlgo]    = useState("ASTAR");

  React.useEffect(() => {
    if (selectedAssetId) setAssetId(selectedAssetId);
  }, [selectedAssetId]);

  const algoInfo = ALGOS.find(a => a.id === algo);

  return (
    <>
      <SectionHead>PATHFINDING ENGINE</SectionHead>
      <form onSubmit={e=>{e.preventDefault();onRun(assetId,+endLat,+endLon,algo);}} style={{ display:"flex",flexDirection:"column",gap:8 }}>
        <label style={{ fontSize:8,color:T.muted }}>
          SELECT ASSET
          <select value={assetId} onChange={e=>setAssetId(e.target.value)} required style={inp}>
            <option value="">— SELECT UNIT —</option>
            {(assets||[]).filter(a=>a.current_lat).map(a=>(
              <option key={a.id} value={a.id}>{a.callsign} · {a.asset_type}</option>
            ))}
          </select>
        </label>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:5 }}>
          <label style={{ fontSize:8,color:T.muted }}>TARGET LAT<input type="number" step="any" value={endLat} onChange={e=>setEndLat(e.target.value)} style={inp}/></label>
          <label style={{ fontSize:8,color:T.muted }}>TARGET LON<input type="number" step="any" value={endLon} onChange={e=>setEndLon(e.target.value)} style={inp}/></label>
        </div>

        <div>
          <div style={{ fontSize:8,color:T.muted,marginBottom:4 }}>ALGORITHM</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:3 }}>
            {ALGOS.map(a=>(
              <button key={a.id} type="button" onClick={()=>setAlgo(a.id)} style={{
                background:algo===a.id?`${T.yellow}18`:T.bg0,
                border:`1px solid ${algo===a.id?T.yellow:T.dim}`,
                color:algo===a.id?T.yellow:T.muted,
                borderRadius:2,padding:"4px 5px",fontSize:8,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",letterSpacing:0.3,
                textAlign:"left",transition:"all .15s",
              }}>{a.label}</button>
            ))}
          </div>
          {algoInfo && (
            <div style={{ marginTop:5,fontSize:8,color:T.muted,background:T.bg0,padding:"4px 7px",borderRadius:2,borderLeft:`2px solid ${T.yellow}55` }}>
              {algoInfo.desc}
            </div>
          )}
        </div>

        <Btn color={T.yellow} full disabled={pathLoading||!assetId}>
          {pathLoading ? "⟳ COMPUTING..." : "◈ COMPUTE ROUTE"}
        </Btn>
      </form>

      {pathResult && (
        <div style={{ marginTop:12,background:T.bg0,border:`1px solid ${T.yellow}2a`,borderRadius:3,padding:10 }}>
          <div style={{ fontSize:9,fontWeight:700,color:T.yellow,letterSpacing:2,marginBottom:8 }}>
            RESULT — {pathResult.algo || pathResult.algorithm}
          </div>
          <Row label="Distance"      value={`${pathResult.distance_km?.toFixed(2)} km`} color={T.yellow}/>
          <Row label="Waypoints"     value={pathResult.waypoints?.length}              color={T.yellow}/>
          <Row label="Nodes Visited" value={pathResult.nodes_visited}                  color={T.yellow}/>
          <Row label="Compute Time"  value={`${pathResult.compute_ms?.toFixed(1)} ms`} color={T.yellow}/>
          <Row label="Grid Size"     value={`${pathResult.grid_size}×${pathResult.grid_size}`} color={T.yellow}/>
          <Btn onClick={onClear} color="#374151" full small style={{marginTop:8}}>✕ CLEAR PATH</Btn>
        </div>
      )}
    </>
  );
}

// ── SIMULATION TAB ─────────────────────────────────────────────
function SimulateTab({ assets, simResult, simLoading, onRun }) {
  const [form, setF] = useState({
    opType:"STRIKE", objLat:"28.626", objLon:"77.228",
    terrain:"PLAINS", weather:"CLEAR", time:"DAY", hostile:"50",
  });
  const [sel, setSel] = useState([]);
  const set = k => e => setF(f=>({...f,[k]:e.target.value}));
  const toggle = id => setSel(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);

  const REC_COLOR = {
    "PROCEED":              T.g2,
    "PROCEED WITH CAUTION": T.yellow,
    "ABORT - HIGH RISK":    T.red,
  };

  return (
    <>
      <SectionHead>OPERATION SIMULATOR</SectionHead>
      <form onSubmit={e=>{
        e.preventDefault();
        onRun("00000000-0000-0000-0000-000000000001",sel,form.opType,+form.objLat,+form.objLon,form.terrain,form.weather,form.time,+form.hostile);
      }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8 }}>
          <label style={{ fontSize:8,color:T.muted }}>OP TYPE
            <select value={form.opType} onChange={set("opType")} style={inp}>
              {["STRIKE","RECON","RESCUE","PATROL","AMBUSH","SIEGE","AIRSTRIKE","NAVAL","SUPPLY"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize:8,color:T.muted }}>HOSTILE STRENGTH
            <input type="number" min="1" max="1000" value={form.hostile} onChange={set("hostile")} style={inp}/>
          </label>
          <label style={{ fontSize:8,color:T.muted }}>OBJ LAT
            <input type="number" step="any" value={form.objLat} onChange={set("objLat")} style={inp}/>
          </label>
          <label style={{ fontSize:8,color:T.muted }}>OBJ LON
            <input type="number" step="any" value={form.objLon} onChange={set("objLon")} style={inp}/>
          </label>
          <label style={{ fontSize:8,color:T.muted }}>TERRAIN
            <select value={form.terrain} onChange={set("terrain")} style={inp}>
              {["PLAINS","URBAN","MOUNTAIN","JUNGLE","DESERT","COASTAL"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize:8,color:T.muted }}>WEATHER
            <select value={form.weather} onChange={set("weather")} style={inp}>
              {["CLEAR","RAIN","STORM","FOG","BLIZZARD"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize:8,color:T.muted,gridColumn:"1/-1" }}>TIME OF DAY
            <select value={form.time} onChange={set("time")} style={inp}>
              {["DAY","NIGHT","DAWN","DUSK"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <div style={{ fontSize:8,color:T.muted,marginBottom:4,display:"flex",justifyContent:"space-between" }}>
          <span>ASSIGN ASSETS ({sel.length}/{(assets||[]).length})</span>
          <span>
            <button type="button" onClick={()=>setSel(assets.map(a=>a.id))} style={{ background:"transparent",border:"none",color:T.g2,cursor:"pointer",fontSize:8,fontFamily:"inherit" }}>ALL</button>
            {" · "}
            <button type="button" onClick={()=>setSel([])} style={{ background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:8,fontFamily:"inherit" }}>CLR</button>
          </span>
        </div>
        <div style={{ maxHeight:110,overflowY:"auto",border:`1px solid ${T.dim}`,borderRadius:3,padding:4,marginBottom:8 }}>
          {(assets||[]).map(a=>(
            <div key={a.id} onClick={()=>toggle(a.id)} style={{
              display:"flex",alignItems:"center",gap:6,padding:"2px 5px",
              cursor:"pointer",borderRadius:2,marginBottom:1,
              background:sel.includes(a.id)?T.bg3:"transparent",
            }}>
              <div style={{ width:9,height:9,borderRadius:2,flexShrink:0,
                background:sel.includes(a.id)?T.g2:T.dim,
                border:`1px solid ${sel.includes(a.id)?T.g2:T.muted}`,
              }}/>
              <span style={{ fontSize:13,flexShrink:0 }}>{a.icon}</span>
              <span style={{ fontSize:9,color:sel.includes(a.id)?T.green:T.muted }}>{a.callsign}</span>
              <span style={{ fontSize:7,color:T.muted,marginLeft:"auto" }}>{a.asset_type}</span>
            </div>
          ))}
        </div>

        <Btn color={T.red} full disabled={simLoading||sel.length===0}>
          {simLoading ? "⟳ SIMULATING..." : "⚡ LAUNCH SIMULATION"}
        </Btn>
      </form>

      {simResult && (
        <div style={{ marginTop:10 }}>
          <div style={{
            background:`${REC_COLOR[simResult.intel?.recommended_action]||T.g2}12`,
            border:`1px solid ${REC_COLOR[simResult.intel?.recommended_action]||T.g2}`,
            borderRadius:3, padding:"7px 10px", marginBottom:10,
            fontSize:10, fontWeight:700, textAlign:"center", letterSpacing:1,
            color: REC_COLOR[simResult.intel?.recommended_action]||T.g2,
          }}>
            {simResult.intel?.recommended_action}
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3,marginBottom:10 }}>
            {[
              ["SUCCESS",  `${(simResult.success_probability*100).toFixed(0)}%`, simResult.success_probability>0.7?T.g2:simResult.success_probability>0.5?T.yellow:T.red],
              ["RISK",     `${(simResult.risk_score*100).toFixed(0)}%`,          simResult.risk_score<0.3?T.g2:simResult.risk_score<0.6?T.yellow:T.red],
              ["COST",     `₹${simResult.total_cost_crore?.toFixed(0)}Cr`,       T.yellow],
              ["MIL KIA",  simResult.military_casualties,  simResult.military_casualties===0?T.g2:T.orange],
              ["CIVILIAN", simResult.civilian_casualties,  simResult.civilian_casualties===0?T.g2:T.red],
              ["EQUIP ✝", simResult.equipment_lost,        simResult.equipment_lost===0?T.g2:T.orange],
            ].map(([k,v,c])=>(
              <div key={k} style={{ background:T.bg0,border:`1px solid ${T.dim}`,borderRadius:3,padding:"5px 3px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:c,lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:7,color:T.muted,letterSpacing:0.3,marginTop:2 }}>{k}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize:8,color:T.muted,letterSpacing:1,marginBottom:5 }}>OPERATION PHASES · MAP OVERLAY ACTIVE</div>
          {(simResult.phases||[]).map(p=>{
            const c=p.status==="SUCCESS"?T.g2:p.status==="PARTIAL"?T.yellow:T.red;
            return (
              <div key={p.phase} style={{ display:"flex",alignItems:"center",gap:5,padding:"3px 0",borderBottom:`1px solid ${T.faint}` }}>
                <div style={{ width:16,height:16,borderRadius:"50%",background:`${c}1a`,border:`1px solid ${c}`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:c,flexShrink:0 }}>{p.phase}</div>
                <span style={{ fontSize:9,color:T.green,flex:1 }}>{p.name}</span>
                <Badge text={p.status} color={c}/>
                <span style={{ fontSize:7,color:T.muted }}>{p.duration_min}m</span>
              </div>
            );
          })}

          <div style={{ marginTop:8,background:T.bg0,borderRadius:3,padding:8,border:`1px solid ${T.dim}` }}>
            <div style={{ fontSize:7,color:T.muted,letterSpacing:1,marginBottom:4 }}>INTELLIGENCE ASSESSMENT</div>
            <Row small label="Force Ratio"    value={`${simResult.intel?.force_ratio}× friendly`} color={T.green}/>
            <Row small label="Terrain Factor" value={`×${simResult.intel?.terrain_factor}`}        color={T.yellow}/>
            <Row small label="Weather Factor" value={`×${simResult.intel?.weather_factor}`}        color={T.blue}/>
            <Row small label="Civilian Risk"  value={simResult.civilian_risk}                      color={simResult.civilian_risk==="LOW"?T.g2:simResult.civilian_risk==="MEDIUM"?T.yellow:T.red}/>
          </div>
        </div>
      )}
    </>
  );
}

// ── ARMORY TAB ─────────────────────────────────────────────────
function ArmoryTab({ armory }) {
  const [cat, setCat] = useState("ALL");
  const cats = ["ALL",...new Set((armory||[]).map(i=>i.item_type))];
  const shown = cat==="ALL" ? armory : armory.filter(i=>i.item_type===cat);

  return (
    <>
      <div style={{ display:"flex",gap:3,flexWrap:"wrap",marginBottom:10 }}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            background:cat===c?`${T.purple}18`:"transparent",
            border:`1px solid ${cat===c?T.purple:T.dim}`,
            color:cat===c?T.purple:T.muted,
            borderRadius:2,padding:"2px 5px",fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
          }}>{c}</button>
        ))}
      </div>
      {!shown.length ? (
        <div style={{ textAlign:"center",padding:24,color:T.muted,fontSize:11 }}>[ LOADING INVENTORY... ]</div>
      ) : shown.map(i => {
        const pct = Math.min(100,(i.quantity/Math.max(i.min_threshold*10,1))*100);
        const c   = pct>50?T.g2:pct>20?T.yellow:T.red;
        const low = i.quantity<=i.min_threshold;
        return (
          <div key={i.id} style={{
            background:T.bg2,border:`1px solid ${low?"#ef444422":T.dim}`,
            borderLeft:`3px solid ${c}`,borderRadius:3,padding:"7px 10px",marginBottom:3,
          }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11,color:T.green,fontWeight:700 }}>{i.name}</div>
                <div style={{ display:"flex",gap:3,marginTop:2 }}>
                  <Badge text={i.item_type} color={T.purple}/>
                  <Badge text={i.category}  color={T.blue}/>
                </div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0,marginLeft:8 }}>
                <div style={{ fontSize:15,fontWeight:800,color:c }}>{i.quantity.toLocaleString()}</div>
                <div style={{ fontSize:8,color:T.muted }}>{i.unit}</div>
              </div>
            </div>
            <div style={{ marginTop:5,height:3,background:T.dim,borderRadius:2 }}>
              <div style={{ height:"100%",width:`${Math.min(pct,100)}%`,background:c,borderRadius:2,transition:"width .4s" }}/>
            </div>
            {low && <div style={{ fontSize:8,color:T.red,marginTop:3,letterSpacing:0.3 }}>⚠ BELOW MIN THRESHOLD ({i.min_threshold} {i.unit})</div>}
          </div>
        );
      })}
    </>
  );
}

// ── MAIN SIDEBAR ───────────────────────────────────────────────
const TABS = [
  { id:"ASSETS",   label:"ASSETS",  icon:"📡" },
  { id:"ALERTS",   label:"ALERTS",  icon:"🚨" },
  { id:"ZONES",    label:"ZONES",   icon:"🎯" },
  { id:"CONVOY",   label:"CONVOY",  icon:"🚛" },
  { id:"PATHFIND", label:"ROUTES",  icon:"🗺" },
  { id:"SIMULATE", label:"SIM",     icon:"⚡" },
  { id:"ARMORY",   label:"ARMORY",  icon:"🔫" },
];

export default function Sidebar(props) {
  const {
    assets=[], zones=[], alerts=[], armory=[], convoys=[],
    pathResult, simResult, simLoading, pathLoading,
    connected, clearAlerts, addZone, removeZone,
    runPathfind, runSimulation, setPathResult, setSimResult,
    addConvoy, updateConvoyStatus, deleteConvoy,
    selectedAssetId, onSelectAsset,
    selectedConvoyId, onSelectConvoy,
    activeCmd, onCmdChange, activeSector, onSectorChange,
    onSignOut, user,
  } = props;

  const [tab,       setTab]       = useState("ASSETS");
  const [svcFilter, setSvcFilter] = useState("ALL");
  const [showCmdPanel, setShowCmdPanel] = useState(false);

  const critCount = alerts.filter(a=>a.severity==="CRITICAL"||a.severity==="EMERGENCY").length;

  const activeLabel = COMMANDS[activeCmd]?.label || "All Sectors";

  return (
    <div style={{
      width:300, flexShrink:0, display:"flex", flexDirection:"column",
      background:T.bg1, borderRight:"1px solid rgba(255,255,255,0.07)",
      fontFamily:"'Courier New',monospace",
    }}>
      {/* ── Sector/Command selector */}
      <div style={{
        padding:"6px 10px", borderBottom:`1px solid ${T.dim}`,
        background:T.bg0, flexShrink:0,
      }}>
        <button onClick={()=>setShowCmdPanel(!showCmdPanel)} style={{
          width:"100%", background:"transparent",
          border:`1px solid ${showCmdPanel?T.g2:T.dim}`, borderRadius:3,
          padding:"4px 10px", color:showCmdPanel?T.g2:T.muted,
          cursor:"pointer", fontFamily:"inherit", fontSize:9, fontWeight:700,
          letterSpacing:1, display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <span>◈ {activeLabel.toUpperCase()}</span>
          <span style={{ opacity:0.6 }}>{showCmdPanel?"▲":"▼"}</span>
        </button>
      </div>

      {showCmdPanel && (
        <div style={{ padding:"8px 10px", borderBottom:`1px solid ${T.dim}`, background:T.bg0, overflowY:"auto", maxHeight:280 }}>
          <CommandBar activeCmd={activeCmd} onSelect={id=>{ onCmdChange(id); setShowCmdPanel(false); }}/>
        </div>
      )}

      {/* ── Tab bar */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.07)", background:T.bg0, flexShrink:0 }}>
        {TABS.map(t => {
          const badge = t.id==="ALERTS" && critCount > 0 ? critCount : null;
          const active = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"8px 2px", background:active?`${T.g2}0c`:"transparent",
              border:"none", borderBottom:`2px solid ${active?T.g2:"transparent"}`,
              cursor:"pointer", fontFamily:"inherit", transition:"all .15s", position:"relative",
            }}>
              <div style={{ fontSize:13, marginBottom:2 }}>{t.icon}</div>
              <div style={{ fontSize:7, fontWeight:700, color:active?T.g2:T.muted, letterSpacing:0.3 }}>{t.label}</div>
              {badge && (
                <div style={{
                  position:"absolute", top:4, right:4,
                  background:T.red, color:"white", borderRadius:8, padding:"0 5px",
                  fontSize:7, fontWeight:700, minWidth:14, textAlign:"center",
                }}>{badge}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content */}
      <div style={{ flex:1, overflowY:"auto", padding:10 }}>
        {tab==="ASSETS"   && <AssetsTab assets={assets} selectedAssetId={selectedAssetId} onSelect={onSelectAsset} svcFilter={svcFilter} setSvcFilter={setSvcFilter} activeCmd={activeCmd}/>}
        {tab==="ALERTS"   && <AlertsTab alerts={alerts} onClear={clearAlerts}/>}
        {tab==="ZONES"    && <ZonesTab zones={zones} onAdd={addZone} onRemove={removeZone}/>}
        {tab==="CONVOY"   && <ConvoyTab convoys={convoys} assets={assets} onAdd={addConvoy} onStatusChange={updateConvoyStatus} onDelete={deleteConvoy} onSelectConvoy={onSelectConvoy} selectedConvoyId={selectedConvoyId}/>}
        {tab==="PATHFIND" && <PathfindTab assets={assets} pathResult={pathResult} pathLoading={pathLoading} onRun={runPathfind} onClear={()=>setPathResult(null)} selectedAssetId={selectedAssetId}/>}
        {tab==="SIMULATE" && <SimulateTab assets={assets} simResult={simResult} simLoading={simLoading} onRun={runSimulation}/>}
        {tab==="ARMORY"   && <ArmoryTab armory={armory}/>}
      </div>

      {/* ── Status footer */}
      <div style={{
        padding:"6px 10px", borderTop:"1px solid rgba(255,255,255,0.07)",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        background:T.bg0, flexShrink:0,
      }}>
        <span style={{ fontSize:8,color:T.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140 }} title={user?.email}>
          {user?.email || "BRCS v5.0"}
        </span>
        {onSignOut && <button onClick={onSignOut} style={{
          background:"rgba(255,51,85,0.1)", border:"1px solid rgba(255,51,85,0.3)",
          color:"#ff3355", cursor:"pointer", borderRadius:5, padding:"2px 8px",
          fontSize:8, fontFamily:"inherit", letterSpacing:0.5,
        }}>LOGOUT</button>}
        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
          <div style={{ width:6,height:6,borderRadius:"50%",
            background:connected?T.g2:"#ff3355",
            boxShadow:connected?`0 0 6px ${T.g2}`:"none",
            animation:connected?"pulse 1.5s ease-in-out infinite":"none" }}/>
          <span style={{ fontSize:8,color:connected?T.g2:"#ff3355",fontWeight:700 }}>{connected?"LIVE":"OFFLINE"}</span>
        </div>
      </div>

      <style>{`select option{background:#060910;color:#e2e8f0;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}
