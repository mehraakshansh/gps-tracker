import React from "react";
import MapView  from "./components/MapView";
import Sidebar  from "./components/Sidebar";
import { useTracker } from "./hooks/useTracker";

export default function App() {
  const tracker = useTracker();

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"#0f172a" }}>
      <Sidebar {...tracker} />

      <div style={{ flex:1, position:"relative" }}>
        <MapView assets={tracker.assets} fences={tracker.fences} />

        {/* Live / Offline badge */}
        <div style={{
          position:"absolute", top:14, right:14, zIndex:1000,
          background: tracker.connected ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
          border: `1px solid ${tracker.connected ? "#22c55e" : "#ef4444"}`,
          borderRadius:20, padding:"4px 14px", fontSize:11, fontWeight:800,
          color: tracker.connected ? "#22c55e" : "#ef4444",
          letterSpacing:1, backdropFilter:"blur(6px)",
          display:"flex", alignItems:"center", gap:6,
        }}>
          <span style={{
            width:6, height:6, borderRadius:"50%",
            background: tracker.connected ? "#22c55e" : "#ef4444",
            display:"inline-block",
            animation: tracker.connected ? "pulse 1.5s ease-in-out infinite" : "none",
          }} />
          {tracker.connected ? "LIVE" : "OFFLINE"}
        </div>

        <style>{`
          @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.4)} }
          .leaflet-container { background:#1e293b !important; }
          .leaflet-tile      { filter: brightness(.85) saturate(.9); }
        `}</style>
      </div>
    </div>
  );
}
