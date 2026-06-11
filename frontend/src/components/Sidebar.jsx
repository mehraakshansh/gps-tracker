import React, { useState } from "react";

const C = {
  bg0:"#020c04", bg1:"#071207", bg2:"#0a1a0a", bg3:"#0f2410",
  green:"#4ade80", green2:"#22c55e", green3:"#16a34a",
  red:"#ef4444", orange:"#f97316", yellow:"#facc15", blue:"#38bdf8",
  muted:"#2d4a2d", dim:"#1a3a1a",
};

const pill=(txt,col)=>(
  <span style={{fontSize:9,padding:"1px 6px",borderRadius:2,background:`${col}22`,border:`1px solid ${col}`,color:col,fontWeight:700,letterSpacing:1}}>{txt}</span>
);

const SEV_COL = { CRITICAL:"#ef4444", WARNING:"#f97316", INFO:"#22c55e", EMERGENCY:"#a855f7" };
const SERVICE_COL = { ARMY:"#22c55e", AIR_FORCE:"#38bdf8", NAVY:"#0ea5e9", SPECIAL_FORCES:"#f59e0b", MARINES:"#ec4899" };
const ALGOS = ["ASTAR","DIJKSTRA","BFS","DFS","FLOYD_WARSHALL","PRIMS","KRUSKALS","AO_STAR"];

// ── Shared styles ─────────────────────────────────────────────
const inp = {
  display:"block",width:"100%",background:C.bg0,color:C.green,
  border:`1px solid ${C.muted}`,borderRadius:2,padding:"4px 8px",
  fontSize:11,fontFamily:"'Courier New',monospace",marginTop:2,outline:"none",
};
const btn = (col="#22c55e") => ({
  background:"transparent",border:`1px solid ${col}`,color:col,
  borderRadius:2,padding:"4px 12px",fontSize:11,fontWeight:700,
  cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:1,
});

// ── Asset Card ────────────────────────────────────────────────
function AssetCard({a,selected,onClick}){
  const tCol = {GREEN:C.green2,YELLOW:C.yellow,ORANGE:C.orange,RED:C.red}[a.threat_level]||C.green2;
  const svcCol = SERVICE_COL[a.service]||C.green;
  return(
    <div onClick={onClick} style={{background:selected?C.bg3:C.bg2,border:`1px solid ${selected?tCol:C.dim}`,borderRadius:3,padding:"8px 10px",cursor:"pointer",marginBottom:4,transition:"border-color .15s"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:20,filter:`drop-shadow(0 0 4px ${tCol})`}}>{a.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,color:C.green,letterSpacing:1}}>{a.callsign}</span>
            {pill(a.service,svcCol)}
            {pill(a.threat_level,tCol)}
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:1}}>{a.name}</div>
          {a.current_lat&&<div style={{fontSize:10,color:"#2d6a3d",marginTop:2}}>
            {a.current_speed?.toFixed(1)} km/h · {a.current_heading?.toFixed(0)}° · {a.asset_type}
          </div>}
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:18,fontWeight:800,color:a.alert_count>0?C.orange:C.green2}}>{a.alert_count||0}</div>
          <div style={{fontSize:8,color:C.muted}}>ALERTS</div>
        </div>
      </div>
      {(a.zoneStatus||[]).filter(z=>z.state==="IN").map(z=>(
        <div key={z.zoneId} style={{fontSize:9,color:z.zoneType==="HOSTILE"||z.zoneType==="MINEFIELD"?C.red:C.orange,marginTop:3,letterSpacing:1}}>
          ▶ IN: {z.zoneName} ({z.zoneType})
        </div>
      ))}
    </div>
  );
}

// ── Alerts Panel ──────────────────────────────────────────────
function AlertsPanel({alerts,onClear}){
  if(!alerts.length) return(
    <div style={{textAlign:"center",padding:24,color:C.muted,fontSize:12}}>
      [ NO ACTIVE ALERTS ]<br/>All systems nominal
    </div>
  );
  return(
    <>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <button onClick={onClear} style={btn("#475569")}>CLR ALL</button>
      </div>
      {alerts.map(a=>{
        const c=SEV_COL[a.severity]||C.green2;
        return(
          <div key={a.id} style={{background:`${c}09`,border:`1px solid ${c}44`,borderLeft:`3px solid ${c}`,borderRadius:3,padding:"6px 10px",marginBottom:5}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:c,display:"block",flexShrink:0,boxShadow:`0 0 4px ${c}`}}/>
              <span style={{fontSize:9,color:c,fontWeight:700,letterSpacing:1}}>{a.severity}</span>
              <span style={{fontSize:9,color:C.muted,marginLeft:"auto"}}>{new Date(a.created_at).toLocaleTimeString()}</span>
            </div>
            <div style={{fontSize:11,color:C.green,marginTop:3}}>{a.asset_icon} <b>{a.asset_name}</b></div>
            <div style={{fontSize:10,color:C.muted}}>{a.message||`${a.event_type} · ${a.zone_name}`}</div>
          </div>
        );
      })}
    </>
  );
}

// ── Zones Panel ───────────────────────────────────────────────
function ZonesPanel({zones,onAdd,onRemove}){
  const [form,setF]=useState({name:"",zone_type:"FOB",center_lat:"28.618",center_lon:"77.210",radius_meters:"500",color:"#22c55e"});
  const [adding,setAdding]=useState(false);
  const set=k=>e=>setF(f=>({...f,[k]:e.target.value}));
  const TYPES=["FOB","HOSTILE","RESTRICTED","CIVILIAN","MINEFIELD","NO_FLY","SUPPLY"];
  const submit=e=>{e.preventDefault();onAdd({...form,center_lat:+form.center_lat,center_lon:+form.center_lon,radius_meters:+form.radius_meters});setAdding(false);};
  const ZC={FOB:C.green2,HOSTILE:C.red,RESTRICTED:C.orange,CIVILIAN:C.blue,MINEFIELD:"#dc2626",NO_FLY:"#ec4899",SUPPLY:"#0ea5e9"};
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{color:C.green,fontSize:12,fontWeight:700,letterSpacing:1}}>ZONES ({zones.length})</span>
        <button onClick={()=>setAdding(!adding)} style={btn()}>{adding?"CANCEL":"+ DEPLOY ZONE"}</button>
      </div>
      {adding&&(
        <form onSubmit={submit} style={{background:C.bg0,border:`1px solid ${C.dim}`,borderRadius:3,padding:10,marginBottom:10}}>
          {[["NAME","name","text"],["LAT","center_lat","number"],["LON","center_lon","number"],["RADIUS (m)","radius_meters","number"]].map(([l,k,t])=>(
            <label key={k} style={{fontSize:10,color:C.muted,display:"block",marginBottom:6}}>
              {l}<input type={t} value={form[k]} onChange={set(k)} required step="any" style={inp}/>
            </label>
          ))}
          <label style={{fontSize:10,color:C.muted,display:"block",marginBottom:6}}>
            TYPE
            <select value={form.zone_type} onChange={set("zone_type")} style={{...inp}}>
              {TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <button type="submit" style={{...btn(C.green2),width:"100%",marginTop:4}}>DEPLOY</button>
        </form>
      )}
      {(zones||[]).map(z=>{
        const c=ZC[z.zone_type]||C.green;
        return(
          <div key={z.id} style={{background:C.bg2,border:`1px solid ${C.dim}`,borderRadius:3,padding:"7px 10px",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:c,display:"block",flexShrink:0,boxShadow:`0 0 4px ${c}`}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:C.green}}>{z.name}</div>
              <div style={{fontSize:9,color:C.muted}}>{z.zone_type} · r={z.radius_meters}m</div>
            </div>
            <button onClick={()=>onRemove(z.id)} style={{...btn(C.red),padding:"2px 6px",fontSize:10}}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Pathfinder Panel ──────────────────────────────────────────
function PathfinderPanel({assets,pathResult,onRun,onClear}){
  const [assetId,setAssetId]=useState("");
  const [endLat,setEndLat]=useState("28.626");
  const [endLon,setEndLon]=useState("28.228");
  const [algo,setAlgo]=useState("ASTAR");
  const [loading,setLoading]=useState(false);
  const run=async(e)=>{e.preventDefault();if(!assetId)return;setLoading(true);try{await onRun(assetId,+endLat,+endLon,algo);}finally{setLoading(false);}};
  const ALGO_DESC={ASTAR:"Optimal + heuristic (fastest)",DIJKSTRA:"Shortest path, all nodes",BFS:"Breadth-first, unweighted",DFS:"Depth-first, exploration",FLOYD_WARSHALL:"All-pairs shortest path",PRIMS:"Min spanning tree",KRUSKALS:"Kruskal's MST",AO_STAR:"AND-OR graph optimal"};
  return(
    <div>
      <div style={{fontSize:12,fontWeight:700,color:C.green,letterSpacing:1,marginBottom:10}}>PATHFINDING ENGINE</div>
      <form onSubmit={run} style={{display:"flex",flexDirection:"column",gap:8}}>
        <label style={{fontSize:10,color:C.muted}}>
          SELECT ASSET
          <select value={assetId} onChange={e=>setAssetId(e.target.value)} required style={inp}>
            <option value="">-- SELECT UNIT --</option>
            {(assets||[]).filter(a=>a.current_lat).map(a=>(
              <option key={a.id} value={a.id}>{a.callsign} — {a.name}</option>
            ))}
          </select>
        </label>
        <div style={{display:"flex",gap:6}}>
          <label style={{fontSize:10,color:C.muted,flex:1}}>TARGET LAT<input type="number" step="any" value={endLat} onChange={e=>setEndLat(e.target.value)} style={inp}/></label>
          <label style={{fontSize:10,color:C.muted,flex:1}}>TARGET LON<input type="number" step="any" value={endLon} onChange={e=>setEndLon(e.target.value)} style={inp}/></label>
        </div>
        <label style={{fontSize:10,color:C.muted}}>
          ALGORITHM
          <select value={algo} onChange={e=>setAlgo(e.target.value)} style={inp}>
            {ALGOS.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div style={{fontSize:9,color:C.muted,padding:"4px 6px",background:C.bg0,borderRadius:2}}>{ALGO_DESC[algo]}</div>
        <button type="submit" disabled={loading} style={{...btn(C.yellow),width:"100%"}}>
          {loading?"COMPUTING...":"◈ COMPUTE PATH"}
        </button>
      </form>
      {pathResult&&(
        <div style={{marginTop:12,background:C.bg0,border:`1px solid ${C.yellow}44`,borderRadius:3,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:C.yellow,letterSpacing:1,marginBottom:6}}>PATH COMPUTED — {pathResult.algo}</div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {[["DISTANCE",`${pathResult.distance_km?.toFixed(2)} km`],["WAYPOINTS",pathResult.waypoints?.length],["NODES VISITED",pathResult.nodes_visited],["COMPUTE TIME",`${pathResult.compute_ms?.toFixed(1)} ms`]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                <span style={{color:C.muted}}>{k}</span>
                <span style={{color:C.green}}>{v}</span>
              </div>
            ))}
          </div>
          <button onClick={onClear} style={{...btn("#475569"),marginTop:6,width:"100%",fontSize:10}}>CLEAR PATH</button>
        </div>
      )}
    </div>
  );
}

// ── Simulation Panel ──────────────────────────────────────────
function SimulationPanel({assets,simResult,simLoading,onRun}){
  const [form,setF]=useState({opId:"",opType:"STRIKE",objLat:"28.626",objLon:"77.228",terrain:"PLAINS",weather:"CLEAR",time:"DAY",hostile:50});
  const [selAssets,setSelAssets]=useState([]);
  const set=k=>e=>setF(f=>({...f,[k]:e.target.value}));
  const toggle=id=>setSelAssets(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const run=async(e)=>{
    e.preventDefault();
    const opId=form.opId||"00000000-0000-0000-0000-000000000001";
    await onRun(opId,selAssets,form.opType,+form.objLat,+form.objLon,form.terrain,form.weather,form.time,+form.hostile);
  };
  const RISK_COL={LOW:C.green2,MEDIUM:C.orange,HIGH:C.red};
  const REC_COL={"PROCEED":C.green2,"PROCEED WITH CAUTION":C.yellow,"ABORT - HIGH RISK":C.red};
  return(
    <div>
      <div style={{fontSize:12,fontWeight:700,color:C.green,letterSpacing:1,marginBottom:10}}>OPERATION SIMULATOR</div>
      <form onSubmit={run} style={{display:"flex",flexDirection:"column",gap:7}}>
        <div style={{display:"flex",gap:6}}>
          <label style={{fontSize:10,color:C.muted,flex:1}}>TYPE
            <select value={form.opType} onChange={set("opType")} style={inp}>
              {["STRIKE","RECON","RESCUE","PATROL","AMBUSH","SIEGE","AIRSTRIKE","NAVAL","SUPPLY"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{fontSize:10,color:C.muted,flex:1}}>HOSTILE STRENGTH
            <input type="number" value={form.hostile} onChange={set("hostile")} style={inp}/>
          </label>
        </div>
        <div style={{display:"flex",gap:6}}>
          <label style={{fontSize:10,color:C.muted,flex:1}}>OBJ LAT<input type="number" step="any" value={form.objLat} onChange={set("objLat")} style={inp}/></label>
          <label style={{fontSize:10,color:C.muted,flex:1}}>OBJ LON<input type="number" step="any" value={form.objLon} onChange={set("objLon")} style={inp}/></label>
        </div>
        <div style={{display:"flex",gap:6}}>
          <label style={{fontSize:10,color:C.muted,flex:1}}>TERRAIN
            <select value={form.terrain} onChange={set("terrain")} style={inp}>
              {["PLAINS","URBAN","MOUNTAIN","JUNGLE","DESERT"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{fontSize:10,color:C.muted,flex:1}}>WEATHER
            <select value={form.weather} onChange={set("weather")} style={inp}>
              {["CLEAR","RAIN","STORM","FOG"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
          <label style={{fontSize:10,color:C.muted,flex:1}}>TIME
            <select value={form.time} onChange={set("time")} style={inp}>
              {["DAY","NIGHT","DAWN"].map(t=><option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div style={{fontSize:10,color:C.muted,marginBottom:3}}>SELECT ASSETS FOR OP ({selAssets.length} selected):</div>
        <div style={{maxHeight:140,overflowY:"auto",border:`1px solid ${C.dim}`,borderRadius:2,padding:4}}>
          {(assets||[]).map(a=>(
            <div key={a.id} onClick={()=>toggle(a.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 4px",cursor:"pointer",background:selAssets.includes(a.id)?C.bg3:"transparent",borderRadius:2,marginBottom:2}}>
              <span style={{width:10,height:10,borderRadius:2,background:selAssets.includes(a.id)?C.green2:C.dim,display:"block",flexShrink:0}}/>
              <span style={{fontSize:14}}>{a.icon}</span>
              <span style={{fontSize:10,color:selAssets.includes(a.id)?C.green:C.muted}}>{a.callsign}</span>
            </div>
          ))}
        </div>
        <button type="submit" disabled={simLoading||selAssets.length===0} style={{...btn(C.red),width:"100%"}}>
          {simLoading?"SIMULATING...":"⚡ RUN SIMULATION"}
        </button>
      </form>

      {simResult&&(
        <div style={{marginTop:12,background:C.bg0,border:`1px solid #ef444433`,borderRadius:3,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:C.red,letterSpacing:1,marginBottom:8}}>SIMULATION RESULTS</div>
          {/* Intel recommendation */}
          <div style={{background:`${REC_COL[simResult.intel?.recommended_action]||C.green}22`,border:`1px solid ${REC_COL[simResult.intel?.recommended_action]||C.green}`,borderRadius:2,padding:"6px 10px",marginBottom:8,fontSize:11,fontWeight:700,color:REC_COL[simResult.intel?.recommended_action]||C.green,textAlign:"center",letterSpacing:1}}>
            {simResult.intel?.recommended_action}
          </div>
          {/* Key metrics */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8}}>
            {[
              ["SUCCESS PROB", `${(simResult.success_probability*100).toFixed(0)}%`, simResult.success_probability>0.7?C.green2:simResult.success_probability>0.5?C.orange:C.red],
              ["RISK SCORE",   `${(simResult.risk_score*100).toFixed(0)}%`,          simResult.risk_score<0.3?C.green2:simResult.risk_score<0.6?C.orange:C.red],
              ["MIL CASUALTIES",simResult.military_casualties, simResult.military_casualties===0?C.green2:C.orange],
              ["CIV CASUALTIES",simResult.civilian_casualties, simResult.civilian_casualties===0?C.green2:C.red],
              ["EQUIP LOST",   simResult.equipment_lost,       simResult.equipment_lost===0?C.green2:C.orange],
              ["COST (Cr ₹)",  `₹${simResult.total_cost_crore?.toFixed(1)}`,         C.yellow],
            ].map(([k,v,c])=>(
              <div key={k} style={{background:C.bg2,borderRadius:2,padding:"6px 8px",border:`1px solid ${C.dim}`}}>
                <div style={{fontSize:8,color:C.muted,letterSpacing:1}}>{k}</div>
                <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          {/* Phase breakdown */}
          <div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:4}}>PHASE BREAKDOWN</div>
          {(simResult.phases||[]).map(p=>(
            <div key={p.phase} style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
              <span style={{fontSize:9,color:C.muted,width:60}}>PHASE {p.phase}</span>
              <span style={{fontSize:10,color:C.green,flex:1}}>{p.name}</span>
              <span style={{fontSize:9,color:p.status==="SUCCESS"?C.green2:p.status==="PARTIAL"?C.orange:C.red,fontWeight:700}}>{p.status}</span>
              <span style={{fontSize:9,color:C.muted}}>{p.duration_min}m</span>
            </div>
          ))}
          {/* Intelligence */}
          <div style={{marginTop:8,fontSize:9,color:C.muted,letterSpacing:1}}>FORCE INTELLIGENCE</div>
          <div style={{fontSize:10,color:"#2d5a3d",marginTop:2}}>
            Force Ratio: {simResult.intel?.force_ratio}x · Terrain: ×{simResult.intel?.terrain_factor} · Weather: ×{simResult.intel?.weather_factor}
          </div>
          <div style={{fontSize:10,color:RISK_COL[simResult.civilian_risk]||C.green2,marginTop:2}}>
            Civilian Risk: {simResult.civilian_risk}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Armory Panel ──────────────────────────────────────────────
function ArmoryPanel({armory}){
  if(!armory.length) return <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:20}}>[ LOADING ARMORY... ]</div>;
  return(
    <div>
      <div style={{fontSize:12,fontWeight:700,color:C.green,letterSpacing:1,marginBottom:10}}>ARMORY INVENTORY</div>
      {armory.map(i=>{
        const pct=Math.min(100,(i.quantity/Math.max(i.min_threshold*10,1))*100);
        const col=pct>50?C.green2:pct>20?C.orange:C.red;
        return(
          <div key={i.id} style={{background:C.bg2,border:`1px solid ${C.dim}`,borderRadius:3,padding:"7px 10px",marginBottom:4}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:11,color:C.green}}>{i.name}</div>
                <div style={{fontSize:9,color:C.muted}}>{i.item_type} · {i.category}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:800,color:col}}>{i.quantity.toLocaleString()}</div>
                <div style={{fontSize:8,color:C.muted}}>{i.unit}</div>
              </div>
            </div>
            <div style={{marginTop:5,height:3,background:C.dim,borderRadius:2}}>
              <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:col,borderRadius:2,transition:"width .3s"}}/>
            </div>
            {i.quantity<=i.min_threshold&&<div style={{fontSize:9,color:C.red,marginTop:2,letterSpacing:1}}>⚠ BELOW MINIMUM THRESHOLD</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────
export default function Sidebar(props){
  const {assets,zones,alerts,armory,pathResult,simResult,simLoading,connected,
         clearAlerts,addZone,removeZone,runPathfind,runSimulation,setPathResult,setSimResult} = props;
  const [tab,setTab]=useState("ASSETS");
  const [filter,setFilter]=useState("ALL");

  const SERVICES=["ALL","ARMY","AIR_FORCE","NAVY","SPECIAL_FORCES"];
  const filteredAssets=(assets||[]).filter(a=>filter==="ALL"||a.service===filter);

  const inHostile=(assets||[]).filter(a=>(a.zoneStatus||[]).some(z=>z.zoneType==="HOSTILE"&&z.state==="IN")).length;
  const critAlerts=(alerts||[]).filter(a=>a.severity==="CRITICAL"||a.severity==="EMERGENCY").length;

  const TABS=["ASSETS","ALERTS","ZONES","PATHFIND","SIMULATE","ARMORY"];

  return(
    <div style={{width:340,flexShrink:0,display:"flex",flexDirection:"column",background:C.bg1,borderRight:`1px solid ${C.dim}`,fontFamily:"'Courier New',monospace"}}>
      {/* Header */}
      <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${C.dim}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.green,letterSpacing:2}}>🛡 BRCS</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:1}}>BHARAT RAKSHA COMMAND SYSTEM</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:connected?C.green2:C.red,boxShadow:connected?`0 0 6px ${C.green2}`:"none",display:"block",animation:connected?"pulse 1.5s infinite":"none"}}/>
            <span style={{fontSize:9,color:connected?C.green2:C.red,letterSpacing:1}}>{connected?"LIVE":"OFFLINE"}</span>
          </div>
        </div>
        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginTop:10}}>
          {[
            {l:"ASSETS",  v:(assets||[]).length,    c:C.green2},
            {l:"HOSTILE", v:inHostile,              c:inHostile>0?C.red:C.green2},
            {l:"ALERTS",  v:(alerts||[]).length,    c:critAlerts>0?C.red:C.orange},
            {l:"ZONES",   v:(zones||[]).length,     c:C.blue},
          ].map(s=>(
            <div key={s.l} style={{background:C.bg2,border:`1px solid ${C.dim}`,borderRadius:2,padding:"5px 4px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
              <div style={{fontSize:7,color:C.muted,letterSpacing:1}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Service filter */}
      <div style={{padding:"6px 8px",borderBottom:`1px solid ${C.dim}`,display:"flex",gap:3,flexWrap:"wrap"}}>
        {SERVICES.map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{...btn(filter===s?C.green2:C.muted),padding:"2px 6px",fontSize:8,letterSpacing:0.5}}>
            {s==="ALL"?"ALL":s==="AIR_FORCE"?"IAF":s==="SPECIAL_FORCES"?"SF":s.slice(0,3)}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.dim}`,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            flex:"0 0 auto",padding:"7px 8px",background:"transparent",border:"none",cursor:"pointer",
            fontSize:8,fontWeight:700,letterSpacing:0.8,fontFamily:"'Courier New',monospace",
            color:tab===t?C.green2:C.muted,
            borderBottom:tab===t?`2px solid ${C.green2}`:"2px solid transparent",
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:10}}>
        {tab==="ASSETS"   && (
          <>
            {critAlerts>0&&<div style={{background:"#ef444411",border:"1px solid #ef4444",borderRadius:2,padding:"4px 8px",marginBottom:8,fontSize:10,color:C.red,letterSpacing:1}}>⚠ {critAlerts} CRITICAL ALERT{critAlerts>1?"S":""} ACTIVE</div>}
            {filteredAssets.map(a=><AssetCard key={a.id} a={a} selected={false} onClick={()=>{}}/>)}
          </>
        )}
        {tab==="ALERTS"   && <AlertsPanel alerts={alerts||[]} onClear={clearAlerts}/>}
        {tab==="ZONES"    && <ZonesPanel zones={zones||[]} onAdd={addZone} onRemove={removeZone}/>}
        {tab==="PATHFIND" && <PathfinderPanel assets={filteredAssets} pathResult={pathResult} onRun={runPathfind} onClear={()=>setPathResult(null)}/>}
        {tab==="SIMULATE" && <SimulationPanel assets={assets||[]} simResult={simResult} simLoading={simLoading} onRun={runSimulation}/>}
        {tab==="ARMORY"   && <ArmoryPanel armory={armory||[]}/>}
      </div>

      <div style={{padding:"5px 10px",borderTop:`1px solid ${C.dim}`,fontSize:8,color:"#1a3a1a",textAlign:"center",letterSpacing:1}}>
        AKSHANSH MEHRA · BRCS v2.0 · CLASSIFIED
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.5)}}
        select option{background:#020c04;color:#4ade80;}
      `}</style>
    </div>
  );
}
