import React, { useState, useMemo } from "react";

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg0:"#020c04", bg1:"#071207", bg2:"#0a1a0a", bg3:"#0f2410",
  green:"#4ade80", g2:"#22c55e", g3:"#16a34a",
  red:"#ef4444",  orange:"#f97316", yellow:"#facc15",
  blue:"#38bdf8", purple:"#a855f7",
  muted:"#2d5a2d", dim:"#1a3a1a", faint:"#0f2010",
};

const SEV = { CRITICAL:"#ef4444", WARNING:"#f97316", INFO:"#22c55e", EMERGENCY:"#a855f7" };
const SVC = { ARMY:"#22c55e", AIR_FORCE:"#38bdf8", NAVY:"#0ea5e9", SPECIAL_FORCES:"#f59e0b", MARINES:"#ec4899" };
const ZC  = { FOB:"#22c55e", HOSTILE:"#ef4444", RESTRICTED:"#f97316", CIVILIAN:"#60a5fa", MINEFIELD:"#dc2626", NO_FLY:"#e879f9", SUPPLY:"#34d399" };

const ALGOS = [
  { id:"ASTAR",         label:"A*",             desc:"Optimal heuristic search (best overall)" },
  { id:"AO_STAR",       label:"AO*",            desc:"AND-OR graph optimal decomposition" },
  { id:"DIJKSTRA",      label:"Dijkstra",        desc:"Shortest path, all edges explored" },
  { id:"BFS",           label:"BFS",             desc:"Breadth-first, unweighted uniform cost" },
  { id:"DFS",           label:"DFS",             desc:"Depth-first stack traversal" },
  { id:"FLOYD_WARSHALL",label:"Floyd-Warshall",  desc:"All-pairs shortest path O(n³)" },
  { id:"PRIMS",         label:"Prim's MST",      desc:"Minimum spanning tree greedy" },
  { id:"KRUSKALS",      label:"Kruskal's MST",   desc:"MST via sorted edge union-find" },
];

// ── Shared atoms ──────────────────────────────────────────────
const inp = {
  width:"100%", background:T.bg0, color:T.green,
  border:`1px solid ${T.dim}`, borderRadius:3, padding:"6px 10px",
  fontSize:11, fontFamily:"'Courier New',monospace", outline:"none",
  display:"block", marginTop:3,
};
const Btn = ({ children, onClick, color=T.g2, disabled=false, full=false, small=false, style:s={} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background:"transparent", border:`1px solid ${disabled?"#374151":color}`,
    color:disabled?"#374151":color, borderRadius:3,
    padding: small?"3px 8px":"6px 14px",
    fontSize:small?9:11, fontWeight:700, cursor:disabled?"not-allowed":"pointer",
    fontFamily:"'Courier New',monospace", letterSpacing:1,
    width:full?"100%":undefined, transition:"all .15s",
    ...s,
  }}>{children}</button>
);
const Row = ({ label, value, color=T.green, small=false }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0", borderBottom:`1px solid ${T.faint}` }}>
    <span style={{ fontSize:small?9:10, color:T.muted, letterSpacing:0.5 }}>{label}</span>
    <span style={{ fontSize:small?9:10, color, fontWeight:700 }}>{value}</span>
  </div>
);
const SectionHead = ({ children, extra }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, paddingBottom:6, borderBottom:`1px solid ${T.dim}` }}>
    <span style={{ fontSize:11, fontWeight:700, color:T.g2, letterSpacing:2 }}>{children}</span>
    {extra}
  </div>
);
const Badge = ({ text, color }) => (
  <span style={{ fontSize:8, padding:"1px 5px", borderRadius:2, background:`${color}22`, border:`1px solid ${color}66`, color, fontWeight:700, letterSpacing:0.5 }}>{text}</span>
);

// ── ASSETS TAB ────────────────────────────────────────────────
function AssetsTab({ assets, selectedAssetId, onSelect, filter, setFilter }) {
  const SVCS = ["ALL","ARMY","AIR_FORCE","NAVY","SPECIAL_FORCES"];
  const filtered = useMemo(()=>(assets||[]).filter(a=>filter==="ALL"||a.service===filter),[assets,filter]);

  return (
    <>
      {/* Service filter pills */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
        {SVCS.map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            background:filter===s?`${SVC[s]||T.g2}22`:"transparent",
            border:`1px solid ${filter===s?SVC[s]||T.g2:T.dim}`,
            color:filter===s?SVC[s]||T.g2:T.muted,
            borderRadius:2, padding:"2px 7px", fontSize:8, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit", letterSpacing:0.5, transition:"all .15s",
          }}>{s==="AIR_FORCE"?"IAF":s==="SPECIAL_FORCES"?"SF":s}</button>
        ))}
        <span style={{ marginLeft:"auto", fontSize:9, color:T.muted, alignSelf:"center" }}>{filtered.length} units</span>
      </div>

      {filtered.map(a => {
        const tCol = {GREEN:T.g2,YELLOW:T.yellow,ORANGE:T.orange,RED:T.red}[a.threat_level]||T.g2;
        const sel  = a.id === selectedAssetId;
        const inDanger = (a.zoneStatus||[]).some(z=>(z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD")&&z.state==="IN");
        return (
          <div key={a.id} onClick={()=>onSelect(sel?null:a.id)} style={{
            background: sel ? T.bg3 : inDanger ? "#ef444409" : T.bg2,
            border: `1px solid ${sel?tCol:inDanger?"#ef444444":T.dim}`,
            borderLeft: `3px solid ${tCol}`,
            borderRadius:3, padding:"8px 10px", cursor:"pointer",
            marginBottom:4, transition:"all .15s",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:22, filter:`drop-shadow(0 0 4px ${tCol})`, flexShrink:0 }}>{a.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:T.green, letterSpacing:1 }}>{a.callsign}</span>
                  <Badge text={a.service.replace("_"," ").slice(0,3)} color={SVC[a.service]||T.g2}/>
                  <Badge text={a.threat_level} color={tCol}/>
                </div>
                <div style={{ fontSize:9, color:T.muted, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</div>
                {a.current_lat && (
                  <div style={{ fontSize:9, color:T.g3, marginTop:2 }}>
                    {a.current_speed?.toFixed(0)}km/h · {a.current_heading?.toFixed(0)}° · {a.asset_type}
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                {a.alert_count > 0 && (
                  <div style={{ fontSize:15, fontWeight:800, color:T.orange, lineHeight:1 }}>{a.alert_count}</div>
                )}
                <div style={{ display:"flex", flexDirection:"column", gap:2, marginTop:2 }}>
                  <div style={{ width:32, height:3, background:T.dim, borderRadius:1 }}>
                    <div style={{ height:"100%", width:`${a.fuel_pct||100}%`, background:(a.fuel_pct||100)<20?T.red:T.g2, borderRadius:1 }}/>
                  </div>
                  <div style={{ width:32, height:3, background:T.dim, borderRadius:1 }}>
                    <div style={{ height:"100%", width:`${a.ammo_pct||100}%`, background:(a.ammo_pct||100)<20?T.red:T.yellow, borderRadius:1 }}/>
                  </div>
                </div>
              </div>
            </div>
            {(a.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
              <div key={z.zoneId} style={{ fontSize:9, color:ZC[z.zoneType]||T.orange, marginTop:4, letterSpacing:0.5 }}>
                ▶ IN {z.zoneType}: {z.zoneName}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── ALERTS TAB ────────────────────────────────────────────────
function AlertsTab({ alerts, onClear }) {
  const [filter, setFilter] = useState("ALL");
  const sevs = ["ALL","CRITICAL","WARNING","INFO"];
  const shown = filter==="ALL" ? alerts : alerts.filter(a=>a.severity===filter);
  return (
    <>
      <div style={{ display:"flex", gap:4, marginBottom:10, justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:4 }}>
          {sevs.map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{
              background:filter===s?`${SEV[s]||T.g2}22`:"transparent",
              border:`1px solid ${filter===s?SEV[s]||T.g2:T.dim}`,
              color:filter===s?SEV[s]||T.g2:T.muted,
              borderRadius:2,padding:"2px 6px",fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
            }}>{s}</button>
          ))}
        </div>
        <Btn onClick={onClear} color="#475569" small>CLR</Btn>
      </div>
      {!shown.length ? (
        <div style={{ textAlign:"center", padding:32, color:T.muted }}>
          <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:11, letterSpacing:1 }}>ALL CLEAR</div>
          <div style={{ fontSize:9, marginTop:4 }}>No active alerts</div>
        </div>
      ) : shown.map(a => {
        const c = SEV[a.severity]||T.g2;
        return (
          <div key={a.id} style={{
            background:`${c}08`, border:`1px solid ${c}33`,
            borderLeft:`3px solid ${c}`, borderRadius:3,
            padding:"7px 10px", marginBottom:5,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:c,display:"block",flexShrink:0,boxShadow:`0 0 4px ${c}` }}/>
              <span style={{ fontSize:9,color:c,fontWeight:700,letterSpacing:1 }}>{a.severity}</span>
              <Badge text={a.event_type} color={c}/>
              <span style={{ fontSize:8,color:T.muted,marginLeft:"auto" }}>{new Date(a.created_at).toLocaleTimeString("en-IN")}</span>
            </div>
            <div style={{ fontSize:11,color:T.green }}>{a.asset_icon} <b>{a.asset_name}</b></div>
            <div style={{ fontSize:9,color:T.muted,marginTop:2 }}>{a.message||`${a.event_type} · ${a.zone_name}`}</div>
          </div>
        );
      })}
    </>
  );
}

// ── ZONES TAB ─────────────────────────────────────────────────
function ZonesTab({ zones, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  const [form, setF]    = useState({ name:"", zone_type:"FOB", center_lat:"28.618", center_lon:"77.210", radius_meters:"500" });
  const set = k => e => setF(f=>({...f,[k]:e.target.value}));
  const TYPES = ["FOB","HOSTILE","RESTRICTED","CIVILIAN","MINEFIELD","NO_FLY","SUPPLY","OBJECTIVE"];

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontSize:10,color:T.muted }}>{(zones||[]).length} active zones</span>
        <Btn onClick={()=>setOpen(!open)} color={open?T.red:T.g2} small>{open?"✕ CANCEL":"+ DEPLOY ZONE"}</Btn>
      </div>

      {open && (
        <form onSubmit={e=>{e.preventDefault();onAdd({...form,center_lat:+form.center_lat,center_lon:+form.center_lon,radius_meters:+form.radius_meters});setOpen(false);}}
          style={{ background:T.bg0, border:`1px solid ${T.dim}`, borderRadius:3, padding:12, marginBottom:12 }}>
          <div style={{ fontSize:10,fontWeight:700,color:T.g2,letterSpacing:1,marginBottom:8 }}>DEPLOY NEW ZONE</div>
          {[["ZONE NAME","name","text"],["CENTER LAT","center_lat","number"],["CENTER LON","center_lon","number"],["RADIUS (m)","radius_meters","number"]].map(([l,k,t])=>(
            <label key={k} style={{ display:"block",fontSize:9,color:T.muted,marginBottom:6 }}>
              {l}
              <input type={t} value={form[k]} onChange={set(k)} required step="any" style={inp}/>
            </label>
          ))}
          <label style={{ display:"block",fontSize:9,color:T.muted,marginBottom:10 }}>
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
            background:T.bg2,border:`1px solid ${T.dim}`,borderLeft:`3px solid ${c}`,
            borderRadius:3,padding:"8px 10px",marginBottom:4,
            display:"flex",alignItems:"center",gap:8,
          }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                <span style={{ fontSize:11,color:T.green,fontWeight:700 }}>{z.name}</span>
                <Badge text={z.zone_type} color={c}/>
              </div>
              <div style={{ fontSize:9,color:T.muted,marginTop:2 }}>
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

// ── PATHFIND TAB ──────────────────────────────────────────────
function PathfindTab({ assets, pathResult, pathLoading, onRun, onClear }) {
  const [assetId, setAssetId] = useState("");
  const [endLat,  setEndLat]  = useState("28.6260");
  const [endLon,  setEndLon]  = useState("77.2280");
  const [algo,    setAlgo]    = useState("ASTAR");

  const algoInfo = ALGOS.find(a=>a.id===algo);

  return (
    <>
      <SectionHead>PATHFINDING ENGINE</SectionHead>
      <form onSubmit={e=>{e.preventDefault();onRun(assetId,+endLat,+endLon,algo);}} style={{ display:"flex",flexDirection:"column",gap:8 }}>
        <label style={{ fontSize:9,color:T.muted }}>
          SELECT ASSET
          <select value={assetId} onChange={e=>setAssetId(e.target.value)} required style={inp}>
            <option value="">— SELECT UNIT —</option>
            {(assets||[]).filter(a=>a.current_lat).map(a=>(
              <option key={a.id} value={a.id}>{a.callsign} · {a.asset_type}</option>
            ))}
          </select>
        </label>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
          <label style={{ fontSize:9,color:T.muted }}>TARGET LAT<input type="number" step="any" value={endLat} onChange={e=>setEndLat(e.target.value)} style={inp}/></label>
          <label style={{ fontSize:9,color:T.muted }}>TARGET LON<input type="number" step="any" value={endLon} onChange={e=>setEndLon(e.target.value)} style={inp}/></label>
        </div>

        <div>
          <div style={{ fontSize:9,color:T.muted,marginBottom:4 }}>ALGORITHM</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:3 }}>
            {ALGOS.map(a=>(
              <button key={a.id} type="button" onClick={()=>setAlgo(a.id)} style={{
                background:algo===a.id?`${T.yellow}22`:T.bg0,
                border:`1px solid ${algo===a.id?T.yellow:T.dim}`,
                color:algo===a.id?T.yellow:T.muted,
                borderRadius:2,padding:"4px 6px",fontSize:9,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",letterSpacing:0.5,
                textAlign:"left",transition:"all .15s",
              }}>{a.label}</button>
            ))}
          </div>
          {algoInfo && (
            <div style={{ marginTop:6,fontSize:9,color:T.muted,background:T.bg0,padding:"5px 8px",borderRadius:2,borderLeft:`2px solid ${T.yellow}66` }}>
              {algoInfo.desc}
            </div>
          )}
        </div>

        <Btn color={T.yellow} full disabled={pathLoading||!assetId}>
          {pathLoading ? "⟳ COMPUTING..." : "◈ COMPUTE ROUTE"}
        </Btn>
      </form>

      {pathResult && (
        <div style={{ marginTop:12,background:T.bg0,border:`1px solid ${T.yellow}33`,borderRadius:3,padding:10 }}>
          <div style={{ fontSize:9,fontWeight:700,color:T.yellow,letterSpacing:2,marginBottom:8 }}>RESULT — {pathResult.algo}</div>
          <Row label="Distance"      value={`${pathResult.distance_km?.toFixed(2)} km`} color={T.yellow}/>
          <Row label="Waypoints"     value={pathResult.waypoints?.length} color={T.yellow}/>
          <Row label="Nodes Visited" value={pathResult.nodes_visited} color={T.yellow}/>
          <Row label="Compute Time"  value={`${pathResult.compute_ms?.toFixed(1)}ms`} color={T.yellow}/>
          <Row label="Grid Size"     value={`${pathResult.grid_size}×${pathResult.grid_size}`} color={T.yellow}/>
          <Btn onClick={onClear} color="#475569" full small style={{marginTop:8}}>✕ CLEAR PATH</Btn>
        </div>
      )}
    </>
  );
}

// ── SIMULATE TAB ──────────────────────────────────────────────
function SimulateTab({ assets, simResult, simLoading, onRun }) {
  const [form, setF] = useState({ opType:"STRIKE",objLat:"28.626",objLon:"77.228",terrain:"PLAINS",weather:"CLEAR",time:"DAY",hostile:"50" });
  const [sel, setSel] = useState([]);
  const set = k => e => setF(f=>({...f,[k]:e.target.value}));
  const toggle = id => setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const selectAll = () => setSel(assets.map(a=>a.id));
  const clearSel  = () => setSel([]);

  const REC_COLOR = {
    "PROCEED":              T.g2,
    "PROCEED WITH CAUTION": T.yellow,
    "ABORT - HIGH RISK":    T.red,
  };

  return (
    <>
      <SectionHead>OPERATION SIMULATOR</SectionHead>
      <form onSubmit={e=>{e.preventDefault();onRun("00000000-0000-0000-0000-000000000001",sel,form.opType,+form.objLat,+form.objLon,form.terrain,form.weather,form.time,+form.hostile);}}>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8 }}>
          <label style={{ fontSize:9,color:T.muted }}>OP TYPE
            <select value={form.opType} onChange={set("opType")} style={inp}>
              {["STRIKE","RECON","RESCUE","PATROL","AMBUSH","SIEGE","AIRSTRIKE","NAVAL","SUPPLY"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize:9,color:T.muted }}>HOSTILE STRENGTH
            <input type="number" min="1" max="1000" value={form.hostile} onChange={set("hostile")} style={inp}/>
          </label>
          <label style={{ fontSize:9,color:T.muted }}>OBJ LAT
            <input type="number" step="any" value={form.objLat} onChange={set("objLat")} style={inp}/>
          </label>
          <label style={{ fontSize:9,color:T.muted }}>OBJ LON
            <input type="number" step="any" value={form.objLon} onChange={set("objLon")} style={inp}/>
          </label>
          <label style={{ fontSize:9,color:T.muted }}>TERRAIN
            <select value={form.terrain} onChange={set("terrain")} style={inp}>
              {["PLAINS","URBAN","MOUNTAIN","JUNGLE","DESERT"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize:9,color:T.muted }}>WEATHER
            <select value={form.weather} onChange={set("weather")} style={inp}>
              {["CLEAR","RAIN","STORM","FOG"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ fontSize:9,color:T.muted,gridColumn:"1/-1" }}>TIME OF DAY
            <select value={form.time} onChange={set("time")} style={inp}>
              {["DAY","NIGHT","DAWN"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
        </div>

        {/* Asset selector */}
        <div style={{ fontSize:9,color:T.muted,marginBottom:4,display:"flex",justifyContent:"space-between" }}>
          <span>ASSIGN ASSETS ({sel.length}/{(assets||[]).length})</span>
          <span>
            <button type="button" onClick={selectAll} style={{ background:"transparent",border:"none",color:T.g2,cursor:"pointer",fontSize:8,fontFamily:"inherit" }}>ALL</button>
            {" · "}
            <button type="button" onClick={clearSel} style={{ background:"transparent",border:"none",color:T.red,cursor:"pointer",fontSize:8,fontFamily:"inherit" }}>CLR</button>
          </span>
        </div>
        <div style={{ maxHeight:120,overflowY:"auto",border:`1px solid ${T.dim}`,borderRadius:3,padding:4,marginBottom:8 }}>
          {(assets||[]).map(a=>(
            <div key={a.id} onClick={()=>toggle(a.id)} style={{
              display:"flex",alignItems:"center",gap:7,padding:"3px 5px",
              cursor:"pointer",borderRadius:2,marginBottom:1,
              background:sel.includes(a.id)?T.bg3:"transparent",
            }}>
              <div style={{ width:10,height:10,borderRadius:2,flexShrink:0,
                background:sel.includes(a.id)?T.g2:T.dim,
                border:`1px solid ${sel.includes(a.id)?T.g2:T.muted}`,
              }}/>
              <span style={{ fontSize:14,flexShrink:0 }}>{a.icon}</span>
              <span style={{ fontSize:10,color:sel.includes(a.id)?T.green:T.muted }}>{a.callsign}</span>
              <span style={{ fontSize:8,color:T.muted,marginLeft:"auto" }}>{a.asset_type}</span>
            </div>
          ))}
        </div>

        <Btn color={T.red} full disabled={simLoading||sel.length===0}>
          {simLoading ? "⟳ SIMULATING..." : "⚡ LAUNCH SIMULATION"}
        </Btn>
      </form>

      {simResult && (
        <div style={{ marginTop:12 }}>
          {/* Recommendation banner */}
          <div style={{
            background:`${REC_COLOR[simResult.intel?.recommended_action]||T.g2}15`,
            border:`1px solid ${REC_COLOR[simResult.intel?.recommended_action]||T.g2}`,
            borderRadius:3, padding:"8px 12px", marginBottom:10,
            fontSize:11, fontWeight:700, textAlign:"center", letterSpacing:1,
            color: REC_COLOR[simResult.intel?.recommended_action]||T.g2,
          }}>
            {simResult.intel?.recommended_action}
          </div>

          {/* Metric grid */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:10 }}>
            {[
              ["SUCCESS",  `${(simResult.success_probability*100).toFixed(0)}%`, simResult.success_probability>0.7?T.g2:simResult.success_probability>0.5?T.yellow:T.red],
              ["RISK",     `${(simResult.risk_score*100).toFixed(0)}%`,          simResult.risk_score<0.3?T.g2:simResult.risk_score<0.6?T.yellow:T.red],
              ["COST",     `₹${simResult.total_cost_crore?.toFixed(0)}Cr`,       T.yellow],
              ["MIL KIA",  simResult.military_casualties,  simResult.military_casualties===0?T.g2:T.orange],
              ["CIV",      simResult.civilian_casualties,  simResult.civilian_casualties===0?T.g2:T.red],
              ["EQUIP ✝", simResult.equipment_lost,        simResult.equipment_lost===0?T.g2:T.orange],
            ].map(([k,v,c])=>(
              <div key={k} style={{ background:T.bg0,border:`1px solid ${T.dim}`,borderRadius:3,padding:"6px 4px",textAlign:"center" }}>
                <div style={{ fontSize:16,fontWeight:800,color:c,lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:7,color:T.muted,letterSpacing:0.5,marginTop:2 }}>{k}</div>
              </div>
            ))}
          </div>

          {/* Phase timeline */}
          <div style={{ fontSize:9,color:T.muted,letterSpacing:1,marginBottom:6 }}>OPERATION PHASES</div>
          {(simResult.phases||[]).map(p=>{
            const c=p.status==="SUCCESS"?T.g2:p.status==="PARTIAL"?T.yellow:T.red;
            return (
              <div key={p.phase} style={{
                display:"flex",alignItems:"center",gap:6,padding:"4px 0",
                borderBottom:`1px solid ${T.faint}`,
              }}>
                <div style={{ width:18,height:18,borderRadius:"50%",background:`${c}22`,border:`1px solid ${c}`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:c,flexShrink:0 }}>
                  {p.phase}
                </div>
                <span style={{ fontSize:10,color:T.green,flex:1 }}>{p.name}</span>
                <Badge text={p.status} color={c}/>
                <span style={{ fontSize:8,color:T.muted }}>{p.duration_min}m</span>
              </div>
            );
          })}

          {/* Intel summary */}
          <div style={{ marginTop:8,background:T.bg0,borderRadius:3,padding:8,border:`1px solid ${T.dim}` }}>
            <div style={{ fontSize:8,color:T.muted,letterSpacing:1,marginBottom:4 }}>INTELLIGENCE ASSESSMENT</div>
            <Row small label="Force Ratio"     value={`${simResult.intel?.force_ratio}× friendly`} color={T.green}/>
            <Row small label="Terrain Factor"  value={`×${simResult.intel?.terrain_factor}`}        color={T.yellow}/>
            <Row small label="Weather Factor"  value={`×${simResult.intel?.weather_factor}`}        color={T.blue}/>
            <Row small label="Civilian Risk"   value={simResult.civilian_risk}                      color={simResult.civilian_risk==="LOW"?T.g2:simResult.civilian_risk==="MEDIUM"?T.yellow:T.red}/>
          </div>
        </div>
      )}
    </>
  );
}

// ── ARMORY TAB ────────────────────────────────────────────────
function ArmoryTab({ armory }) {
  const [cat, setCat] = useState("ALL");
  const cats = ["ALL",...new Set((armory||[]).map(i=>i.item_type))];
  const shown = cat==="ALL" ? armory : armory.filter(i=>i.item_type===cat);

  return (
    <>
      <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:10 }}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            background:cat===c?`${T.purple}22`:"transparent",
            border:`1px solid ${cat===c?T.purple:T.dim}`,
            color:cat===c?T.purple:T.muted,
            borderRadius:2,padding:"2px 6px",fontSize:8,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
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
            background:T.bg2,border:`1px solid ${low?"#ef444433":T.dim}`,
            borderLeft:`3px solid ${c}`,borderRadius:3,padding:"8px 10px",marginBottom:4,
          }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11,color:T.green,fontWeight:700 }}>{i.name}</div>
                <div style={{ display:"flex",gap:4,marginTop:2 }}>
                  <Badge text={i.item_type}  color={T.purple}/>
                  <Badge text={i.category}   color={T.blue}/>
                </div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0,marginLeft:8 }}>
                <div style={{ fontSize:16,fontWeight:800,color:c }}>{i.quantity.toLocaleString()}</div>
                <div style={{ fontSize:8,color:T.muted }}>{i.unit}</div>
              </div>
            </div>
            {/* Stock bar */}
            <div style={{ marginTop:6,height:4,background:T.dim,borderRadius:2 }}>
              <div style={{ height:"100%",width:`${Math.min(pct,100)}%`,background:c,borderRadius:2,transition:"width .4s" }}/>
            </div>
            {low && <div style={{ fontSize:8,color:T.red,marginTop:3,letterSpacing:0.5 }}>⚠ BELOW MIN THRESHOLD ({i.min_threshold} {i.unit})</div>}
          </div>
        );
      })}
    </>
  );
}

// ── MAIN SIDEBAR ──────────────────────────────────────────────
const TABS = [
  { id:"ASSETS",   label:"ASSETS",   icon:"📡" },
  { id:"ALERTS",   label:"ALERTS",   icon:"🚨" },
  { id:"ZONES",    label:"ZONES",    icon:"🎯" },
  { id:"PATHFIND", label:"ROUTES",   icon:"🗺" },
  { id:"SIMULATE", label:"SIMULATE", icon:"⚡" },
  { id:"ARMORY",   label:"ARMORY",   icon:"🔫" },
];

export default function Sidebar(props) {
  const { assets=[], zones=[], alerts=[], armory=[],
          pathResult, simResult, simLoading, pathLoading,
          connected, clearAlerts, addZone, removeZone,
          runPathfind, runSimulation, setPathResult, setSimResult,
          selectedAssetId, onSelectAsset } = props;

  const [tab,    setTab]    = useState("ASSETS");
  const [filter, setFilter] = useState("ALL");

  const critCount = alerts.filter(a=>a.severity==="CRITICAL"||a.severity==="EMERGENCY").length;
  const tabBadge  = { ALERTS: alerts.length||null, ASSETS: null };

  return (
    <div style={{
      width:320, flexShrink:0,
      display:"flex", flexDirection:"column",
      background:T.bg1, borderRight:`1px solid ${T.dim}`,
      fontFamily:"'Courier New',monospace",
    }}>
      {/* ── Tab bar */}
      <div style={{
        display:"flex", borderBottom:`1px solid ${T.dim}`,
        background:T.bg0, flexShrink:0,
      }}>
        {TABS.map(t => {
          const badge = t.id==="ALERTS"&&critCount>0 ? critCount : null;
          const active = tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"8px 2px", background:"transparent",
              border:"none", borderBottom:`2px solid ${active?T.g2:"transparent"}`,
              cursor:"pointer", fontFamily:"inherit",
              transition:"all .15s",
            }}>
              <div style={{ fontSize:13, marginBottom:1 }}>{t.icon}</div>
              <div style={{ fontSize:7, fontWeight:700, color:active?T.g2:T.muted, letterSpacing:0.5 }}>{t.label}</div>
              {badge && (
                <div style={{
                  display:"inline-block",background:T.red,color:"white",
                  borderRadius:8,padding:"0 4px",fontSize:7,fontWeight:700,marginTop:1,
                }}>{badge}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content */}
      <div style={{ flex:1, overflowY:"auto", padding:12 }}>
        {tab==="ASSETS"   && <AssetsTab assets={assets} selectedAssetId={selectedAssetId} onSelect={onSelectAsset} filter={filter} setFilter={setFilter}/>}
        {tab==="ALERTS"   && <AlertsTab alerts={alerts} onClear={clearAlerts}/>}
        {tab==="ZONES"    && <ZonesTab zones={zones} onAdd={addZone} onRemove={removeZone}/>}
        {tab==="PATHFIND" && <PathfindTab assets={assets} pathResult={pathResult} pathLoading={pathLoading} onRun={runPathfind} onClear={()=>setPathResult(null)}/>}
        {tab==="SIMULATE" && <SimulateTab assets={assets} simResult={simResult} simLoading={simLoading} onRun={runSimulation}/>}
        {tab==="ARMORY"   && <ArmoryTab armory={armory}/>}
      </div>

      {/* ── Status footer */}
      <div style={{
        padding:"5px 12px", borderTop:`1px solid ${T.dim}`,
        display:"flex", justifyContent:"space-between", alignItems:"center",
        background:T.bg0, flexShrink:0,
      }}>
        <span style={{ fontSize:8,color:"#1a4a1a",letterSpacing:1 }}>AKSHANSH MEHRA · BRCS v3.0</span>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          <div style={{ width:5,height:5,borderRadius:"50%",
            background:connected?T.g2:T.red,
            boxShadow:connected?`0 0 5px ${T.g2}`:"none" }}/>
          <span style={{ fontSize:8,color:connected?T.g2:T.red }}>
            {connected?"LIVE":"OFFLINE"}
          </span>
        </div>
      </div>

      <style>{`select option{background:#020c04;color:#4ade80;}`}</style>
    </div>
  );
}
