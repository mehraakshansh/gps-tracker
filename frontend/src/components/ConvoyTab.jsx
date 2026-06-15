import React, { useState, useMemo } from "react";

const T = {
  bg0:"#010a03", bg1:"#060f06", bg2:"#091509", bg3:"#0d1e0d",
  green:"#4ade80", g2:"#22c55e", red:"#ef4444",
  orange:"#f97316", yellow:"#facc15", blue:"#38bdf8", purple:"#a855f7",
  muted:"#2d5a2d", dim:"#162916", faint:"#0c160c", textSub:"#3d7a3d",
};

const STATUS_COLOR = {
  PLANNED:"#38bdf8", EN_ROUTE:"#22c55e", COMPLETED:"#4ade80",
  COMPROMISED:"#ef4444", CANCELLED:"#6b7280", HALTED:"#f97316",
};
const PRIORITY_COLOR = { LOW:"#38bdf8", NORMAL:"#22c55e", HIGH:"#f97316", CRITICAL:"#ef4444" };

const inp = {
  width:"100%", background:T.bg0, color:T.green,
  border:`1px solid ${T.dim}`, borderRadius:3, padding:"6px 9px",
  fontSize:11, fontFamily:"'Courier New',monospace", outline:"none",
  display:"block", marginTop:3, boxSizing:"border-box",
};

const Btn = ({ children, onClick, color=T.g2, disabled, full, small, style:s={} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background:"transparent", border:`1px solid ${disabled?"#2d3a2d":color}`,
    color:disabled?"#2d3a2d":color, borderRadius:3,
    padding: small?"2px 8px":"6px 14px", fontSize:small?9:11,
    fontWeight:700, cursor:disabled?"not-allowed":"pointer",
    fontFamily:"'Courier New',monospace", letterSpacing:1,
    width:full?"100%":undefined, ...s,
  }}>{children}</button>
);

const Badge = ({ text, color }) => (
  <span style={{ fontSize:7, padding:"1px 4px", borderRadius:2,
    background:`${color}1a`, border:`1px solid ${color}44`, color, fontWeight:700, letterSpacing:0.5 }}>{text}</span>
);

function WaypointEditor({ waypoints, onChange }) {
  const add = () => onChange([...waypoints, { lat:"", lon:"", label:"WP" + (waypoints.length+1) }]);
  const remove = i => onChange(waypoints.filter((_,j) => j!==i));
  const update = (i, key, val) => {
    const copy = waypoints.map((w,j) => j===i ? {...w,[key]:val} : w);
    onChange(copy);
  };
  return (
    <div>
      <div style={{ fontSize:8, color:T.muted, letterSpacing:1, marginBottom:4, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span>ROUTE WAYPOINTS ({waypoints.length})</span>
        <Btn onClick={add} color={T.g2} small>+ ADD</Btn>
      </div>
      {waypoints.length === 0 && (
        <div style={{ fontSize:9, color:T.muted, textAlign:"center", padding:8, border:`1px dashed ${T.dim}`, borderRadius:3 }}>
          Click ADD to define route waypoints
        </div>
      )}
      {waypoints.map((wp, i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:3, marginBottom:4, alignItems:"end" }}>
          <label style={{ fontSize:7, color:T.textSub }}>
            LAT
            <input type="number" step="any" value={wp.lat} onChange={e=>update(i,"lat",e.target.value)}
              style={{...inp, padding:"4px 6px", fontSize:10, marginTop:2}}/>
          </label>
          <label style={{ fontSize:7, color:T.textSub }}>
            LON
            <input type="number" step="any" value={wp.lon} onChange={e=>update(i,"lon",e.target.value)}
              style={{...inp, padding:"4px 6px", fontSize:10, marginTop:2}}/>
          </label>
          <div style={{ fontSize:8, color:T.muted, alignSelf:"center", marginTop:14, padding:"0 4px" }}>WP{i+1}</div>
          <button type="button" onClick={()=>remove(i)} style={{
            marginTop:14, background:"transparent", border:`1px solid ${T.dim}`,
            color:T.red, cursor:"pointer", borderRadius:2, padding:"3px 6px", fontSize:9,
          }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function ConvoyCard({ convoy, onStatusChange, onDelete, onSelect, selected }) {
  const sc = STATUS_COLOR[convoy.status] || T.g2;
  const pc = PRIORITY_COLOR[convoy.priority] || T.g2;
  const nextStatuses = {
    PLANNED: ["EN_ROUTE", "CANCELLED"],
    EN_ROUTE: ["HALTED", "COMPLETED", "COMPROMISED"],
    HALTED: ["EN_ROUTE", "CANCELLED"],
    COMPLETED: [],
    COMPROMISED: [],
    CANCELLED: [],
  };
  const transitions = nextStatuses[convoy.status] ?? [];

  const formatTime = t => t ? new Date(t).toLocaleString("en-IN",{dateStyle:"short",timeStyle:"short"}) : "—";
  const wpCount = Array.isArray(convoy.route_waypoints) ? convoy.route_waypoints.length : 0;
  const assetCount = Array.isArray(convoy.asset_ids) ? convoy.asset_ids.length : 0;

  return (
    <div onClick={()=>onSelect(convoy.id)} style={{
      background: selected ? T.bg3 : T.bg2,
      border: `1px solid ${selected ? sc : T.dim}`,
      borderLeft: `3px solid ${sc}`,
      borderRadius: 3, padding: "8px 10px", marginBottom: 5,
      cursor: "pointer", transition: "all .15s",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
        <span style={{ fontSize:12 }}>🚛</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.green, letterSpacing:1 }}>{convoy.name}</div>
          {convoy.commander && <div style={{ fontSize:8, color:T.muted }}>CDR: {convoy.commander}</div>}
        </div>
        <div style={{ display:"flex", gap:3, flexWrap:"wrap", justifyContent:"flex-end" }}>
          <Badge text={convoy.status}   color={sc}/>
          <Badge text={convoy.priority} color={pc}/>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, marginBottom:6 }}>
        {[
          ["WAYPOINTS", wpCount],
          ["ASSETS",    assetCount],
          ["REPEAT",    convoy.repeat_type],
        ].map(([k,v]) => (
          <div key={k} style={{ textAlign:"center", background:T.bg0, borderRadius:2, padding:"3px 4px" }}>
            <div style={{ fontSize:12, fontWeight:800, color:T.green, lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:6, color:T.textSub, letterSpacing:0.5 }}>{k}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize:8, color:T.muted, marginBottom:6 }}>
        <span>SCHED: {formatTime(convoy.scheduled_at)}</span>
        {convoy.started_at && <span style={{ marginLeft:8 }}>START: {formatTime(convoy.started_at)}</span>}
      </div>

      {transitions.length > 0 && (
        <div style={{ display:"flex", gap:3, flexWrap:"wrap" }} onClick={e=>e.stopPropagation()}>
          {transitions.map(st => (
            <Btn key={st} onClick={()=>onStatusChange(convoy.id, st)}
              color={STATUS_COLOR[st]||T.g2} small>
              → {st}
            </Btn>
          ))}
          <Btn onClick={()=>onDelete(convoy.id)} color={T.red} small style={{ marginLeft:"auto" }}>✕ DEL</Btn>
        </div>
      )}
    </div>
  );
}

export default function ConvoyTab({ convoys=[], assets=[], onAdd, onStatusChange, onDelete, onSelectConvoy, selectedConvoyId }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [form, setF] = useState({
    name:"", description:"", priority:"NORMAL", repeat_type:"NONE",
    commander:"", scheduled_at:"", notes:"",
  });
  const [waypoints, setWaypoints] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);

  const set = k => e => setF(f=>({...f,[k]:e.target.value}));
  const toggleAsset = id => setSelectedAssets(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return convoys;
    return convoys.filter(c => c.status === filter);
  }, [convoys, filter]);

  const statusCounts = useMemo(() => {
    const c = { PLANNED:0, EN_ROUTE:0, COMPLETED:0, COMPROMISED:0, CANCELLED:0, HALTED:0 };
    convoys.forEach(cv => { if (c[cv.status] !== undefined) c[cv.status]++; });
    return c;
  }, [convoys]);

  const handleSubmit = e => {
    e.preventDefault();
    const wps = waypoints
      .filter(w => w.lat !== "" && w.lon !== "")
      .map(w => ({ lat:parseFloat(w.lat), lon:parseFloat(w.lon), label:w.label }));
    if (wps.length < 2) { alert("At least 2 waypoints required"); return; }
    onAdd({
      ...form,
      route_waypoints: wps,
      asset_ids: selectedAssets,
      scheduled_at: form.scheduled_at || null,
    });
    setOpen(false);
    setF({ name:"", description:"", priority:"NORMAL", repeat_type:"NONE", commander:"", scheduled_at:"", notes:"" });
    setWaypoints([]);
    setSelectedAssets([]);
  };

  const statuses = ["ALL","PLANNED","EN_ROUTE","HALTED","COMPLETED","COMPROMISED","CANCELLED"];

  return (
    <>
      {/* Status summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3, marginBottom:8 }}>
        {[["PLANNED",statusCounts.PLANNED,T.blue],["EN ROUTE",statusCounts.EN_ROUTE,T.g2],["COMPROMISED",statusCounts.COMPROMISED,T.red]].map(([k,v,c])=>(
          <div key={k} style={{ background:T.bg0, border:`1px solid ${T.dim}`, borderRadius:3, padding:"4px", textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:800, color:c, lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:6, color:T.textSub, letterSpacing:0.5, marginTop:1 }}>{k}</div>
          </div>
        ))}
      </div>

      {/* Filter + create */}
      <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:8, alignItems:"center" }}>
        {statuses.map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            background:filter===s?`${STATUS_COLOR[s]||T.g2}1a`:"transparent",
            border:`1px solid ${filter===s?STATUS_COLOR[s]||T.g2:T.dim}`,
            color:filter===s?STATUS_COLOR[s]||T.g2:T.muted,
            borderRadius:2, padding:"2px 5px", fontSize:7, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit",
          }}>{s==="ALL"?"ALL":s.replace("_"," ")}</button>
        ))}
        <Btn onClick={()=>setOpen(!open)} color={open?T.red:T.g2} small style={{ marginLeft:"auto" }}>
          {open?"✕ CANCEL":"+ CONVOY"}
        </Btn>
      </div>

      {/* Create form */}
      {open && (
        <form onSubmit={handleSubmit} style={{
          background:T.bg0, border:`1px solid ${T.g2}33`, borderRadius:4,
          padding:12, marginBottom:10,
        }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.g2, letterSpacing:2, marginBottom:10 }}>◈ SCHEDULE CONVOY</div>

          <label style={{ display:"block", fontSize:8, color:T.muted, marginBottom:6 }}>
            CONVOY NAME *
            <input value={form.name} onChange={set("name")} required placeholder="e.g. BRAHMA-1 SUPPLY RUN" style={inp}/>
          </label>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:6 }}>
            <label style={{ fontSize:8, color:T.muted }}>
              PRIORITY
              <select value={form.priority} onChange={set("priority")} style={inp}>
                {["LOW","NORMAL","HIGH","CRITICAL"].map(p=><option key={p}>{p}</option>)}
              </select>
            </label>
            <label style={{ fontSize:8, color:T.muted }}>
              REPEAT
              <select value={form.repeat_type} onChange={set("repeat_type")} style={inp}>
                {["NONE","DAILY","WEEKLY"].map(r=><option key={r}>{r}</option>)}
              </select>
            </label>
          </div>

          <label style={{ display:"block", fontSize:8, color:T.muted, marginBottom:6 }}>
            COMMANDER
            <input value={form.commander} onChange={set("commander")} placeholder="e.g. COL SHARMA" style={inp}/>
          </label>

          <label style={{ display:"block", fontSize:8, color:T.muted, marginBottom:8 }}>
            SCHEDULED DEPARTURE
            <input type="datetime-local" value={form.scheduled_at} onChange={set("scheduled_at")} style={inp}/>
          </label>

          <div style={{ marginBottom:8 }}>
            <WaypointEditor waypoints={waypoints} onChange={setWaypoints}/>
          </div>

          {/* Asset selection */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:8, color:T.muted, letterSpacing:1, marginBottom:4, display:"flex", justifyContent:"space-between" }}>
              <span>ASSIGN ASSETS ({selectedAssets.length})</span>
              <span style={{ cursor:"pointer", color:T.g2 }} onClick={()=>setSelectedAssets(assets.map(a=>a.id))}>ALL</span>
            </div>
            <div style={{ maxHeight:90, overflowY:"auto", border:`1px solid ${T.dim}`, borderRadius:3, padding:4 }}>
              {assets.filter(a=>a.current_lat).map(a=>(
                <div key={a.id} onClick={()=>toggleAsset(a.id)} style={{
                  display:"flex", alignItems:"center", gap:6, padding:"2px 4px",
                  cursor:"pointer", background:selectedAssets.includes(a.id)?T.bg3:"transparent",
                  borderRadius:2, marginBottom:1,
                }}>
                  <div style={{
                    width:8, height:8, borderRadius:2, flexShrink:0,
                    background:selectedAssets.includes(a.id)?T.g2:T.dim,
                    border:`1px solid ${selectedAssets.includes(a.id)?T.g2:T.muted}`,
                  }}/>
                  <span style={{ fontSize:12 }}>{a.icon}</span>
                  <span style={{ fontSize:9, color:selectedAssets.includes(a.id)?T.green:T.muted }}>{a.callsign}</span>
                  <span style={{ fontSize:7, color:T.muted, marginLeft:"auto" }}>{a.asset_type}</span>
                </div>
              ))}
            </div>
          </div>

          <label style={{ display:"block", fontSize:8, color:T.muted, marginBottom:10 }}>
            NOTES
            <textarea value={form.notes} onChange={set("notes")} rows={2}
              style={{...inp, resize:"vertical"}} placeholder="Mission notes..."/>
          </label>

          <Btn color={T.g2} full>⊕ SCHEDULE CONVOY</Btn>
        </form>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:24, color:T.muted }}>
          <div style={{ fontSize:24, marginBottom:8 }}>🚛</div>
          <div style={{ fontSize:10 }}>No convoys in this filter</div>
        </div>
      )}

      {filtered.map(cv => (
        <ConvoyCard
          key={cv.id}
          convoy={cv}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onSelect={id => onSelectConvoy(id === selectedConvoyId ? null : id)}
          selected={cv.id === selectedConvoyId}
        />
      ))}
    </>
  );
}
