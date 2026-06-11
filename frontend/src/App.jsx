import React, { useState } from "react";
import MapView  from "./components/MapView";
import Sidebar  from "./components/Sidebar";
import { useTracker } from "./hooks/useTracker";

export default function App() {
  const tracker = useTracker();
  const [time, setTime] = useState(new Date());

  React.useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); },[]);

  const dd = t => String(t).padStart(2,"0");
  const ts = `${dd(time.getHours())}:${dd(time.getMinutes())}:${dd(time.getSeconds())} IST`;

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"#020c04", fontFamily:"'Courier New',monospace" }}>
      <Sidebar {...tracker} />
      <div style={{ flex:1, position:"relative", display:"flex", flexDirection:"column" }}>
        {/* Top bar */}
        <div style={{
          height:32, background:"#071207", borderBottom:"1px solid #0f2410",
          display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", flexShrink:0,
        }}>
          <div style={{display:"flex",gap:20,alignItems:"center"}}>
            <span style={{fontSize:10,color:"#22c55e",fontWeight:700,letterSpacing:3}}>WESTERN SECTOR</span>
            <span style={{fontSize:9,color:"#1a4a1a",letterSpacing:1}}>GRID: 28°37'N 77°12'E</span>
          </div>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <span style={{fontSize:9,color:"#1a4a1a",letterSpacing:1}}>{ts}</span>
            <span style={{fontSize:9,color:tracker.connected?"#22c55e":"#ef4444",fontWeight:700,letterSpacing:2,display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:tracker.connected?"#22c55e":"#ef4444",display:"inline-block",boxShadow:tracker.connected?"0 0 5px #22c55e":"none"}}/>
              {tracker.connected?"UPLINK ACTIVE":"UPLINK LOST"}
            </span>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex:1, position:"relative" }}>
          <MapView assets={tracker.assets} zones={tracker.zones} pathResult={tracker.pathResult} />

          {/* Asset count HUD */}
          <div style={{
            position:"absolute", top:12, right:14, zIndex:500,
            display:"flex", flexDirection:"column", gap:4,
          }}>
            {[
              {svc:"ARMY",icon:"⚔️",col:"#22c55e"},
              {svc:"AIR_FORCE",icon:"✈️",col:"#38bdf8"},
              {svc:"NAVY",icon:"⚓",col:"#0ea5e9"},
              {svc:"SPECIAL_FORCES",icon:"🪖",col:"#f59e0b"},
            ].map(s=>{
              const cnt=(tracker.assets||[]).filter(a=>a.service===s.svc).length;
              return(
                <div key={s.svc} style={{background:"rgba(2,12,4,.85)",border:`1px solid ${s.col}44`,borderRadius:2,padding:"3px 8px",display:"flex",gap:6,alignItems:"center",backdropFilter:"blur(4px)"}}>
                  <span style={{fontSize:12}}>{s.icon}</span>
                  <span style={{fontSize:10,color:s.col,fontWeight:700}}>{cnt}</span>
                </div>
              );
            })}
          </div>

          {/* Critical alerts ticker */}
          {(tracker.alerts||[]).filter(a=>a.severity==="CRITICAL").slice(0,3).map((a,i)=>(
            <div key={a.id} style={{
              position:"absolute", bottom:12+i*36, left:"50%", transform:"translateX(-50%)",
              zIndex:500, background:"rgba(239,68,68,.15)", border:"1px solid #ef4444",
              borderRadius:2, padding:"4px 14px", fontSize:10, color:"#ef4444",
              fontWeight:700, letterSpacing:1, whiteSpace:"nowrap",
              animation:"alertBlink 1s ease-in-out infinite alternate",
            }}>
              ⚠ {a.asset_name} · {a.message||a.event_type}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes alertBlink{from{opacity:.6}to{opacity:1}}
        .leaflet-container{background:#020c04!important;}
      `}</style>
    </div>
  );
}
