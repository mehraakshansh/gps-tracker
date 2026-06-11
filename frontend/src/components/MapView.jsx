import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ZONE_STYLES = {
  FOB:        {color:"#22c55e",dash:"none"},
  HOSTILE:    {color:"#ef4444",dash:"6,4"},
  RESTRICTED: {color:"#f97316",dash:"8,4"},
  CIVILIAN:   {color:"#3b82f6",dash:"4,4"},
  MINEFIELD:  {color:"#dc2626",dash:"2,3"},
  NO_FLY:     {color:"#ec4899",dash:"10,5"},
  SUPPLY:     {color:"#0ea5e9",dash:"6,3"},
};
const THREAT_COLOR = { GREEN:"#22c55e", YELLOW:"#eab308", ORANGE:"#f97316", RED:"#ef4444" };

const mkIcon = (icon, threatLevel) => L.divIcon({
  html:`<div style="position:relative;text-align:center">
    <div style="font-size:22px;filter:drop-shadow(0 0 6px ${THREAT_COLOR[threatLevel]||'#22c55e'}88)">${icon}</div>
    <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;background:${THREAT_COLOR[threatLevel]||'#22c55e'};box-shadow:0 0 4px ${THREAT_COLOR[threatLevel]||'#22c55e'}"></div>
  </div>`,
  className:"", iconSize:[28,32], iconAnchor:[14,28],
});

export default function MapView({ assets, zones, pathResult }) {
  const div = useRef(null), map = useRef(null);
  const markers = useRef({}), trails = useRef({}), zoneLayers = useRef({});
  const pathLayer = useRef(null);

  useEffect(()=>{
    if(map.current) return;
    map.current = L.map(div.current,{center:[28.618,77.21],zoom:13,zoomControl:true,attributionControl:false});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,opacity:0.6}).addTo(map.current);
    // Grid overlay
    L.control.attribution({prefix:'<span style="color:#1a3a1a;font-size:9px">BRCS v2.0 | RESTRICTED</span>'}).addTo(map.current);
  },[]);

  // Zones
  useEffect(()=>{
    const m=map.current; if(!m) return;
    Object.values(zoneLayers.current).forEach(l=>m.removeLayer(l));
    zoneLayers.current={};
    (zones||[]).forEach(z=>{
      const s=ZONE_STYLES[z.zone_type]||{color:"#ffffff",dash:"4,4"};
      zoneLayers.current[z.id]=L.circle([z.center_lat,z.center_lon],{
        radius:z.radius_meters, color:s.color, weight:2, dashArray:s.dash,
        fillColor:s.color, fillOpacity:0.06,
      }).addTo(m).bindTooltip(
        `<div style="background:#0a1a0a;border:1px solid ${s.color};color:${s.color};padding:4px 8px;font-family:monospace;font-size:11px">
          <b>${z.zone_type}</b><br/>${z.name}<br/>r=${z.radius_meters}m
        </div>`,
        {direction:"top",className:"military-tooltip"}
      );
    });
  },[zones]);

  // Assets
  useEffect(()=>{
    const m=map.current; if(!m) return;
    (assets||[]).forEach(a=>{
      if(!a.current_lat) return;
      const pos=[a.current_lat,a.current_lon];
      const tColor=THREAT_COLOR[a.threat_level]||"#22c55e";
      if(markers.current[a.id]) {
        markers.current[a.id].setLatLng(pos).setIcon(mkIcon(a.icon,a.threat_level));
      } else {
        markers.current[a.id]=L.marker(pos,{icon:mkIcon(a.icon,a.threat_level)})
          .addTo(m).bindPopup(`<div style="background:#0a1a0a;color:#4ade80;font-family:monospace;min-width:180px">
            <div style="font-size:13px;font-weight:bold;color:#22c55e">${a.icon} ${a.callsign}</div>
            <div style="color:#64748b;font-size:10px">${a.name}</div>
            <hr style="border-color:#1a3a1a;margin:4px 0"/>
            <div style="font-size:11px">Type: ${a.asset_type}<br/>Status: ${a.status}<br/>Fuel: ${a.fuel_pct?.toFixed(0)}%  Ammo: ${a.ammo_pct?.toFixed(0)}%</div>
          </div>`,{className:"mil-popup"});
      }
      if(!trails.current[a.id]) {
        trails.current[a.id]=L.polyline([],{color:tColor,weight:1.5,opacity:0.5,dashArray:"3,3"}).addTo(m);
      }
      trails.current[a.id].setLatLngs((a.trail||[]).map(p=>L.latLng(p.lat,p.lng))).setStyle({color:tColor});
    });
  },[assets]);

  // Path result overlay
  useEffect(()=>{
    const m=map.current; if(!m) return;
    if(pathLayer.current) m.removeLayer(pathLayer.current);
    if(!pathResult?.waypoints?.length) return;
    const lls=pathResult.waypoints.map(p=>[p.lat,p.lon]);
    pathLayer.current=L.polyline(lls,{color:"#facc15",weight:3,dashArray:"8,4",opacity:0.9}).addTo(m);
    // Start/end markers
    L.circleMarker(lls[0],{radius:6,color:"#22c55e",fillColor:"#22c55e",fillOpacity:1}).addTo(m);
    L.circleMarker(lls[lls.length-1],{radius:6,color:"#ef4444",fillColor:"#ef4444",fillOpacity:1}).addTo(m);
  },[pathResult]);

  return (
    <div style={{position:"relative",flex:1,height:"100%"}}>
      <div ref={div} style={{width:"100%",height:"100%"}}/>
      {/* Scanline overlay */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,0,0.01) 2px,rgba(0,255,0,0.01) 4px)",zIndex:400}}/>
      {/* Corner decorations */}
      {["topLeft","topRight","bottomLeft","bottomRight"].map(c=>{
        const s={position:"absolute",width:20,height:20,zIndex:500,pointerEvents:"none"};
        if(c==="topLeft")    Object.assign(s,{top:8,left:8,borderTop:"2px solid #22c55e",borderLeft:"2px solid #22c55e"});
        if(c==="topRight")   Object.assign(s,{top:8,right:8,borderTop:"2px solid #22c55e",borderRight:"2px solid #22c55e"});
        if(c==="bottomLeft") Object.assign(s,{bottom:8,left:8,borderBottom:"2px solid #22c55e",borderLeft:"2px solid #22c55e"});
        if(c==="bottomRight")Object.assign(s,{bottom:8,right:8,borderBottom:"2px solid #22c55e",borderRight:"2px solid #22c55e"});
        return <div key={c} style={s}/>;
      })}
      <style>{`
        .leaflet-container{background:#020c04!important;}
        .leaflet-tile{filter:brightness(.4) saturate(.6) hue-rotate(100deg)!important;}
        .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#0a1a0a!important;border:1px solid #1a4a1a!important;color:#4ade80!important;}
        .mil-popup .leaflet-popup-content-wrapper{padding:0!important;}
        .military-tooltip{background:transparent!important;border:none!important;box-shadow:none!important;}
      `}</style>
    </div>
  );
}
