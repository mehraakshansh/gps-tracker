import React, { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ZONE_CFG = {
  FOB:        { color:"#22c55e", fill:0.08, dash:null,    label:"FOB"        },
  HOSTILE:    { color:"#ef4444", fill:0.12, dash:"8,5",   label:"HOSTILE"    },
  RESTRICTED: { color:"#f97316", fill:0.08, dash:"10,5",  label:"RESTRICTED" },
  CIVILIAN:   { color:"#60a5fa", fill:0.06, dash:"4,4",   label:"CIVILIAN"   },
  MINEFIELD:  { color:"#dc2626", fill:0.15, dash:"3,3",   label:"MINEFIELD"  },
  NO_FLY:     { color:"#e879f9", fill:0.07, dash:"12,6",  label:"NO-FLY"     },
  SUPPLY:     { color:"#34d399", fill:0.06, dash:"6,3",   label:"SUPPLY"     },
  OBJECTIVE:  { color:"#facc15", fill:0.10, dash:"8,4",   label:"OBJECTIVE"  },
};

const THREAT_GLOW = { GREEN:"#22c55e", YELLOW:"#eab308", ORANGE:"#f97316", RED:"#ef4444" };

function makeIcon(emoji, threatLevel, selected=false) {
  const glow = THREAT_GLOW[threatLevel] || "#22c55e";
  const size = selected ? 32 : 26;
  return L.divIcon({
    className: "",
    iconSize: [size+8, size+12],
    iconAnchor: [(size+8)/2, size+10],
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <div style="
        font-size:${size}px;
        filter:drop-shadow(0 0 ${selected?10:5}px ${glow});
        transition:all .2s;
        transform:scale(${selected?1.15:1});
      ">${emoji}</div>
      <div style="width:6px;height:6px;border-radius:50%;background:${glow};
        box-shadow:0 0 ${selected?8:4}px ${glow};
        animation:${threatLevel==="RED"?"blip 0.6s infinite alternate":"blip 2s infinite alternate"};
      "></div>
    </div>`,
  });
}

export default function MapView({ assets, zones, pathResult, selectedAssetId, onAssetClick }) {
  const divRef     = useRef(null);
  const mapRef     = useRef(null);
  const markersRef = useRef({});
  const trailsRef  = useRef({});
  const zoneLayRef = useRef({});
  const pathLayRef = useRef(null);
  const pathMarkersRef = useRef([]);

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;
    const m = L.map(divRef.current, {
      center: [28.618, 77.21],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    mapRef.current = m;
  }, []);

  // Render zones
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    Object.values(zoneLayRef.current).forEach(l => m.removeLayer(l));
    zoneLayRef.current = {};
    (zones || []).forEach(z => {
      const cfg = ZONE_CFG[z.zone_type] || ZONE_CFG.FOB;
      const circle = L.circle([z.center_lat, z.center_lon], {
        radius: z.radius_meters,
        color: cfg.color, weight: 2,
        dashArray: cfg.dash,
        fillColor: cfg.color, fillOpacity: cfg.fill,
      }).addTo(m);
      // Zone label
      const label = L.divIcon({
        className: "",
        html: `<div style="
          background:rgba(2,12,4,.85);border:1px solid ${cfg.color};
          color:${cfg.color};padding:2px 7px;border-radius:2px;
          font-family:'Courier New',monospace;font-size:10px;font-weight:700;
          letter-spacing:1px;white-space:nowrap;pointer-events:none;
        ">${cfg.label}: ${z.name}</div>`,
        iconAnchor: [60, 10],
      });
      L.marker([z.center_lat, z.center_lon], { icon: label, interactive: false }).addTo(m);
      zoneLayRef.current[z.id] = circle;
    });
  }, [zones]);

  // Render assets + trails
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    (assets || []).forEach(a => {
      if (!a.current_lat) return;
      const pos = [a.current_lat, a.current_lon];
      const selected = a.id === selectedAssetId;

      if (markersRef.current[a.id]) {
        markersRef.current[a.id].setLatLng(pos).setIcon(makeIcon(a.icon, a.threat_level, selected));
      } else {
        const mk = L.marker(pos, { icon: makeIcon(a.icon, a.threat_level, selected) })
          .addTo(m)
          .on("click", () => onAssetClick?.(a.id));
        // Rich popup
        mk.bindPopup(`
          <div style="background:#071207;border:1px solid #1a4a1a;padding:10px 14px;min-width:200px;font-family:'Courier New',monospace;">
            <div style="font-size:22px;text-align:center">${a.icon}</div>
            <div style="font-size:13px;font-weight:700;color:#22c55e;text-align:center;letter-spacing:2px;">${a.callsign}</div>
            <div style="color:#64748b;font-size:10px;text-align:center;margin-bottom:8px">${a.name}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;">
              <span style="color:#4a7a4a">TYPE</span><span style="color:#4ade80">${a.asset_type}</span>
              <span style="color:#4a7a4a">STATUS</span><span style="color:#4ade80">${a.status}</span>
              <span style="color:#4a7a4a">SERVICE</span><span style="color:#4ade80">${a.service}</span>
              <span style="color:#4a7a4a">SPEED</span><span style="color:#4ade80">${a.current_speed?.toFixed(0)} km/h</span>
              <span style="color:#4a7a4a">HDG</span><span style="color:#4ade80">${a.current_heading?.toFixed(0)}°</span>
              <span style="color:#4a7a4a">FUEL</span><span style="color:${(a.fuel_pct||100)<20?'#ef4444':'#4ade80'}">${a.fuel_pct?.toFixed(0)}%</span>
            </div>
          </div>
        `, { className: "mil-popup" });
        markersRef.current[a.id] = mk;
      }

      // Trail
      const tcolor = THREAT_GLOW[a.threat_level] || "#22c55e";
      if (!trailsRef.current[a.id]) {
        trailsRef.current[a.id] = L.polyline([], { color: tcolor, weight: 1.5, opacity: 0.5, dashArray: "3,4" }).addTo(m);
      }
      const trail = (a.trail || []).map((p) => [p.lat, p.lng]);
      trailsRef.current[a.id].setLatLngs(trail).setStyle({ color: tcolor });
    });
  }, [assets, selectedAssetId]);

  // Path overlay
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    if (pathLayRef.current) m.removeLayer(pathLayRef.current);
    pathMarkersRef.current.forEach(mk => m.removeLayer(mk));
    pathMarkersRef.current = [];
    if (!pathResult?.waypoints?.length) return;

    const lls = pathResult.waypoints.map((p) => [p.lat, p.lon]);
    pathLayRef.current = L.polyline(lls, { color:"#facc15", weight:3, dashArray:"10,5", opacity:0.9 }).addTo(m);

    const mkCircle = (ll, color, label) => {
      const ic = L.divIcon({ className:"", html:`<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px ${color};display:flex;align-items:center;justify-content:center;font-size:7px;color:white;font-weight:700;">${label}</div>`, iconSize:[12,12], iconAnchor:[6,6] });
      return L.marker(ll, { icon:ic }).addTo(m);
    };
    pathMarkersRef.current.push(mkCircle(lls[0], "#22c55e", "S"));
    pathMarkersRef.current.push(mkCircle(lls[lls.length-1], "#ef4444", "E"));
    m.fitBounds(L.polyline(lls).getBounds(), { padding:[40,40] });
  }, [pathResult]);

  return (
    <div style={{ position:"relative", flex:1, height:"100%" }}>
      <div ref={divRef} style={{ width:"100%", height:"100%" }} />
      {/* CRT scanlines */}
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,20,0,.04) 3px,rgba(0,20,0,.04) 4px)",
        zIndex:400 }} />
      {/* Corner brackets */}
      {[{t:8,l:8,bt:"top",bl:"left"},{t:8,r:8,bt:"top",br:"right"},{b:8,l:8,bb:"bottom",bl:"left"},{b:8,r:8,bb:"bottom",br:"right"}].map((c,i)=>(
        <div key={i} style={{
          position:"absolute",width:24,height:24,zIndex:500,pointerEvents:"none",
          ...c.t!==undefined?{top:c.t}:{bottom:c.b},
          ...c.l!==undefined?{left:c.l}:{right:c.r},
          borderTop:c.bt?`2px solid #22c55e44`:undefined,
          borderBottom:c.bb?`2px solid #22c55e44`:undefined,
          borderLeft:c.bl?`2px solid #22c55e44`:undefined,
          borderRight:c.br?`2px solid #22c55e44`:undefined,
        }}/>
      ))}
      <style>{`
        .leaflet-container { background:#020c04 !important; }
        .leaflet-tile { filter:brightness(.45) saturate(.5) hue-rotate(110deg) !important; }
        .leaflet-popup-content-wrapper,.leaflet-popup-tip { background:#071207 !important; border:1px solid #1a4a1a !important; padding:0 !important; }
        .leaflet-popup-content { margin:0 !important; }
        .mil-popup .leaflet-popup-content-wrapper { border-radius:3px !important; }
        .leaflet-control-zoom a { background:#071207 !important; color:#22c55e !important; border:1px solid #1a4a1a !important; font-size:16px !important; }
        .leaflet-control-zoom a:hover { background:#0f2410 !important; }
        @keyframes blip { from{opacity:.3;transform:scale(.8)} to{opacity:1;transform:scale(1.2)} }
      `}</style>
    </div>
  );
}
