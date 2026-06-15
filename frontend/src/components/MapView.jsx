import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ZONE_CFG = {
  FOB:        { color:"#22c55e", fill:0.07, dash:null,    label:"FOB"        },
  HOSTILE:    { color:"#ef4444", fill:0.10, dash:"8,5",   label:"HOSTILE"    },
  RESTRICTED: { color:"#f97316", fill:0.07, dash:"10,5",  label:"RESTRICTED" },
  CIVILIAN:   { color:"#60a5fa", fill:0.05, dash:"4,4",   label:"CIVILIAN"   },
  MINEFIELD:  { color:"#dc2626", fill:0.13, dash:"3,3",   label:"MINEFIELD"  },
  NO_FLY:     { color:"#e879f9", fill:0.06, dash:"12,6",  label:"NO-FLY"     },
  SUPPLY:     { color:"#34d399", fill:0.06, dash:"6,3",   label:"SUPPLY"     },
  OBJECTIVE:  { color:"#facc15", fill:0.09, dash:"8,4",   label:"OBJECTIVE"  },
  BASE:       { color:"#0ea5e9", fill:0.07, dash:null,    label:"BASE"       },
  OPERATIONAL:{ color:"#f97316", fill:0.06, dash:"6,4",   label:"OP-AREA"    },
  SAFE:       { color:"#22c55e", fill:0.08, dash:"4,2",   label:"SAFE"       },
  PATROL:     { color:"#38bdf8", fill:0.05, dash:"5,3",   label:"PATROL"     },
  GEOFENCE:   { color:"#a78bfa", fill:0.05, dash:"6,3",   label:"GEOFENCE"   },
};

const THREAT_GLOW = { GREEN:"#22c55e", YELLOW:"#eab308", ORANGE:"#f97316", RED:"#ef4444" };

// Haversine for fog-of-war (returns metres)
function havFow(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function classifyAsset(asset) {
  const t = ((asset.asset_type || "") + (asset.name || "")).toUpperCase();
  const svc = (asset.service || "").toUpperCase();
  if (t.match(/JET|FIGHTER|BOMBER|RAFALE|SUKHOI|TEJAS|JAGUAR|MIG/)) return "jet";
  if (t.match(/HELI|APACHE|DHRUV|MI-|ALH/)) return "heli";
  if (t.match(/DRONE|UAV|RUSTOM|TAPAS|MALE/)) return "drone";
  if (t.match(/SHIP|FRIGATE|DESTROYER|INS |NAVAL/) || svc === "NAVY") return "ship";
  if (t.match(/SUB|SUBMARINE/)) return "sub";
  if (t.match(/TRANSPORT|C-17|IL-76|AN-32/)) return "transport";
  if (t.match(/MISSILE|BDL|PRITHVI|AGNI/)) return "missile";
  return "ground";
}

function makeAssetIcon(asset, selected = false) {
  const faction = asset.faction ?? "BRAVO";
  const isAlpha = faction === "ALPHA";
  const isDestroyed = asset.is_destroyed === true;

  // Faction-aware colour: ALPHA=red, BRAVO=green (threat glow for BRAVO only)
  const glow = isDestroyed ? "#444444"
             : isAlpha     ? "#ef4444"
             : THREAT_GLOW[asset.threat_level] || "#22c55e";

  const size = selected ? 28 : 22;
  const status = (asset.status || "ACTIVE").toUpperCase();
  const isHalted = isDestroyed || ["HALTED","MAINTENANCE","DISABLED","DESTROYED"].includes(status);
  const isEngaged = !isDestroyed && status === "ENGAGED";
  const cls = classifyAsset(asset);
  const heading = (asset.current_heading || 0).toFixed(0);

  // Per-type animation
  let iconAnim = "none";
  let iconTransform = `scale(${selected ? 1.2 : 1})`;
  if (!isHalted) {
    if (cls === "jet" || cls === "transport") iconAnim = "assetFly 3.5s linear infinite";
    else if (cls === "heli" || cls === "drone") iconAnim = "assetHover 1.1s ease-in-out infinite alternate";
    else if (cls === "ship") iconAnim = "assetSway 2.5s ease-in-out infinite alternate";
    else if (cls === "sub") iconAnim = "assetSway 3s ease-in-out infinite alternate";
  }

  // Direction arrow for ground/flying assets
  const showArrow = !isHalted && (cls === "ground" || cls === "jet" || cls === "transport" || cls === "heli" || cls === "drone");
  const arrowColor = isEngaged ? "#f97316" : glow;

  const arrowHtml = showArrow
    ? `<div style="position:absolute;top:-2px;left:50%;transform:translateX(-50%) rotate(${heading}deg);
        width:0;height:0;
        border-left:3px solid transparent;border-right:3px solid transparent;
        border-bottom:9px solid ${arrowColor};opacity:0.85;pointer-events:none;"></div>`
    : "";

  const destroyedHtml = isDestroyed
    ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);
        background:#1a0000cc;color:#ef4444;font-size:7px;font-weight:900;
        padding:1px 4px;border-radius:2px;letter-spacing:1px;white-space:nowrap;pointer-events:none;">KIA</div>`
    : "";
  const factionBadge = !isDestroyed
    ? `<div style="position:absolute;bottom:-1px;right:-4px;font-size:6px;font-weight:900;
        color:${isAlpha?"#ef4444":"#22c55e"};text-shadow:0 0 4px ${isAlpha?"#ef4444":"#22c55e"};
        pointer-events:none;">${isAlpha?"▲":"●"}</div>`
    : "";
  const haltHtml = !isDestroyed && isHalted
    ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);
        background:#ef4444cc;color:#fff;font-size:6px;font-weight:900;
        padding:1px 4px;border-radius:2px;letter-spacing:1px;
        animation:haltBlink 0.9s infinite;white-space:nowrap;pointer-events:none;">HALT</div>`
    : "";

  const engagedHtml = isEngaged
    ? `<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);
        background:#f97316cc;color:#fff;font-size:6px;font-weight:900;
        padding:1px 4px;border-radius:2px;letter-spacing:1px;
        animation:blip 0.4s infinite alternate;white-space:nowrap;pointer-events:none;">ENGAGED</div>`
    : "";

  const blipSize = isEngaged ? 8 : selected ? 7 : 5;
  const blipColor = isHalted ? "#ef4444" : glow;
  const blipAnim = isHalted
    ? "haltBlink 0.9s infinite"
    : `blip ${asset.threat_level === "RED" ? "0.5" : "2"}s infinite alternate`;

  return L.divIcon({
    className: "",
    iconSize:   [size + 16, size + 20],
    iconAnchor: [(size + 16) / 2, (size + 20) / 2],
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:0px;">
      ${destroyedHtml}${haltHtml}${engagedHtml}${arrowHtml}${factionBadge}
      <div style="
        font-size:${size}px;
        filter:drop-shadow(0 0 ${selected ? 10 : 5}px ${glow})${(isHalted||isDestroyed) ? " grayscale(80%) brightness(0.5)" : ""};
        animation:${iconAnim};
        transform-origin:center;
        transform:${iconTransform};
        transition:transform .25s;
        line-height:1;
      ">${asset.icon}</div>
      <div style="
        width:${blipSize}px;height:${blipSize}px;border-radius:50%;
        background:${blipColor};box-shadow:0 0 ${selected ? 10 : 4}px ${blipColor};
        animation:${blipAnim};
        margin-top:1px;
      "></div>
    </div>`,
  });
}

// Simulation objective overlay
function buildSimOverlay(simResult, simObjective, map) {
  if (!simResult || !simObjective) return [];
  const layers = [];
  const { lat, lon } = simObjective;
  const prob = simResult.success_probability || 0.5;
  const risk = simResult.risk_score || 0.5;
  const outerColor = prob > 0.7 ? "#22c55e" : prob > 0.4 ? "#f97316" : "#ef4444";

  // Outer effect radius
  layers.push(L.circle([lat, lon], {
    radius: 8000, color: outerColor, weight: 1.5,
    dashArray: "6,4", fillColor: outerColor, fillOpacity: 0.04,
  }).addTo(map));

  // Inner objective ring
  layers.push(L.circle([lat, lon], {
    radius: 2000, color: outerColor, weight: 2,
    dashArray: "3,3", fillColor: outerColor, fillOpacity: 0.08,
  }).addTo(map));

  // Objective marker
  const succPct = Math.round(prob * 100);
  const riskPct = Math.round(risk * 100);
  const ic = L.divIcon({
    className: "",
    html: `<div style="
      background:rgba(2,12,4,0.95);border:2px solid ${outerColor};border-radius:4px;
      padding:6px 10px;font-family:'Courier New',monospace;min-width:120px;
      box-shadow:0 0 20px ${outerColor}44;
    ">
      <div style="font-size:10px;font-weight:700;color:${outerColor};letter-spacing:2px;margin-bottom:4px;">
        ◈ OBJECTIVE
      </div>
      <div style="font-size:9px;color:#4ade80;">SUCCESS: <b style="color:${outerColor}">${succPct}%</b></div>
      <div style="font-size:9px;color:#4ade80;">RISK: <b style="color:${risk > 0.6 ? "#ef4444" : "#f97316"}">${riskPct}%</b></div>
      <div style="font-size:9px;color:#4ade80;">COST: <b style="color:#facc15">₹${simResult.total_cost_crore?.toFixed(0)}Cr</b></div>
      <div style="font-size:8px;color:#2d5a2d;margin-top:3px;">${simResult.intel?.recommended_action || ""}</div>
    </div>`,
    iconAnchor: [60, 0],
  });
  layers.push(L.marker([lat, lon], { icon: ic }).addTo(map));

  // Phase indicators around objective
  (simResult.phases || []).forEach((phase, i) => {
    const angle = (i / 4) * Math.PI * 2;
    const r = 0.055;
    const pLat = lat + Math.cos(angle) * r;
    const pLon = lon + Math.sin(angle) * r * 1.2;
    const pColor = phase.status === "SUCCESS" ? "#22c55e" : phase.status === "PARTIAL" ? "#f97316" : "#ef4444";
    const phIc = L.divIcon({
      className: "",
      html: `<div style="
        background:rgba(2,12,4,0.9);border:1px solid ${pColor};border-radius:2px;
        padding:2px 5px;font-family:'Courier New',monospace;font-size:7px;
        color:${pColor};font-weight:700;letter-spacing:0.5px;white-space:nowrap;
      ">P${phase.phase}: ${phase.name}</div>`,
      iconAnchor: [30, 8],
    });
    layers.push(L.marker([pLat, pLon], { icon: phIc, interactive: false }).addTo(map));
  });

  return layers;
}

const SECTORS = [
  { id:"ALL",       lat:28.62, lon:77.21, zoom:6,  label:"All India" },
  { id:"WESTERN",   lat:30.70, lon:75.50, zoom:7,  label:"Western Command" },
  { id:"NORTHERN",  lat:34.10, lon:74.90, zoom:7,  label:"Northern Command" },
  { id:"EASTERN",   lat:26.00, lon:91.50, zoom:7,  label:"Eastern Command" },
  { id:"SOUTHERN",  lat:17.00, lon:78.50, zoom:7,  label:"Southern Command" },
  { id:"CENTRAL",   lat:26.85, lon:80.95, zoom:7,  label:"Central Command" },
  { id:"WAC",       lat:28.62, lon:77.21, zoom:8,  label:"Western Air Command" },
  { id:"WNC",       lat:18.92, lon:72.82, zoom:8,  label:"Western Naval Command" },
  { id:"LOC",       lat:34.10, lon:74.90, zoom:9,  label:"Line of Control" },
  { id:"SIACHEN",   lat:35.40, lon:76.90, zoom:9,  label:"Siachen Glacier" },
];

export default function MapView({ assets, zones, pathResult, simResult, simObjective, convoys, selectedConvoyId, selectedAssetId, onAssetClick, activeSector, fogOfWar = true }) {
  const divRef         = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef({});
  const trailsRef      = useRef({});
  const zoneLayRef     = useRef({});
  const pathLayRef     = useRef(null);
  const pathMksRef     = useRef([]);
  const simLayersRef   = useRef([]);
  const convoyLayRef   = useRef({});

  // Init map
  useEffect(() => {
    if (mapRef.current) return;
    const m = L.map(divRef.current, {
      center: [28.62, 77.21], zoom: 7,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
    L.control.zoom({ position: "bottomright" }).addTo(m);

    // Grid overlay (degree lines every 2°)
    const gridLayer = L.layerGroup();
    for (let lat = 8; lat <= 37; lat += 2) {
      L.polyline([[lat, 68],[lat, 98]], { color:"#22c55e11", weight:0.5, interactive:false }).addTo(gridLayer);
    }
    for (let lon = 68; lon <= 98; lon += 2) {
      L.polyline([[8, lon],[37, lon]], { color:"#22c55e11", weight:0.5, interactive:false }).addTo(gridLayer);
    }
    gridLayer.addTo(m);
    mapRef.current = m;
  }, []);

  // Pan to sector
  useEffect(() => {
    const m = mapRef.current; if (!m || !activeSector) return;
    const s = SECTORS.find(x => x.id === activeSector);
    if (s) m.setView([s.lat, s.lon], s.zoom, { animate: true, duration: 0.8 });
  }, [activeSector]);

  // Render zones
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    Object.values(zoneLayRef.current).forEach(l => { try { m.removeLayer(l); } catch(_){} });
    zoneLayRef.current = {};
    (zones || []).forEach(z => {
      const cfg = ZONE_CFG[z.zone_type] || ZONE_CFG.FOB;
      // Override colour if zone is captured
      const captureColor = z.controlled_by === "BRAVO" ? "#22c55e"
                         : z.controlled_by === "ALPHA" ? "#ef4444"
                         : null;
      const borderColor = captureColor ?? cfg.color;
      const captureWeight = captureColor ? 2.5 : 1.5;
      const captureLabel = captureColor
        ? `${z.controlled_by === "BRAVO" ? "▣" : "▤"} ${z.name} [${z.controlled_by}]`
        : `${cfg.label}: ${z.name}`;

      const circle = L.circle([z.center_lat, z.center_lon], {
        radius: z.radius_meters, color: borderColor, weight: captureWeight,
        dashArray: captureColor ? null : cfg.dash,
        fillColor: borderColor, fillOpacity: captureColor ? 0.12 : cfg.fill,
      }).addTo(m);
      const lbl = L.divIcon({
        className: "",
        html: `<div style="background:rgba(2,12,4,.85);border:1px solid ${borderColor};
          color:${borderColor};padding:2px 6px;border-radius:2px;
          font-family:'Courier New',monospace;font-size:9px;font-weight:700;
          letter-spacing:1px;white-space:nowrap;pointer-events:none;opacity:.9;">
          ${captureLabel}</div>`,
        iconAnchor: [60, 10],
      });
      L.marker([z.center_lat, z.center_lon], { icon: lbl, interactive: false }).addTo(m);
      zoneLayRef.current[z.id] = circle;
    });
  }, [zones]);

  // Render assets + trails
  useEffect(() => {
    const m = mapRef.current; if (!m) return;

    // Fog of war: compute which ALPHA units are within detection radius of any BRAVO unit
    const bravoLive = (assets || []).filter(a => a.faction !== "ALPHA" && !a.is_destroyed && a.current_lat != null);
    const visibleAlphaIds = new Set();
    if (fogOfWar) {
      (assets || []).filter(a => a.faction === "ALPHA" && a.current_lat != null).forEach(alpha => {
        for (const bravo of bravoLive) {
          const dist = havFow(bravo.current_lat, bravo.current_lon, alpha.current_lat, alpha.current_lon);
          if (dist <= (bravo.detection_radius_km ?? 10) * 1000) { visibleAlphaIds.add(alpha.id); break; }
        }
      });
    }

    (assets || []).forEach(a => {
      if (!a.current_lat) return;
      // Hide ALPHA units outside detection radius (fog of war)
      if (fogOfWar && a.faction === "ALPHA" && !visibleAlphaIds.has(a.id)) {
        if (markersRef.current[a.id]) {
          try { m.removeLayer(markersRef.current[a.id]); } catch(_){}
          delete markersRef.current[a.id];
        }
        if (trailsRef.current[a.id]) {
          try { m.removeLayer(trailsRef.current[a.id]); } catch(_){}
          delete trailsRef.current[a.id];
        }
        return;
      }
      const pos = [a.current_lat, a.current_lon];
      const sel = a.id === selectedAssetId;
      const glow = THREAT_GLOW[a.threat_level] || "#22c55e";

      if (markersRef.current[a.id]) {
        markersRef.current[a.id].setLatLng(pos).setIcon(makeAssetIcon(a, sel));
      } else {
        const mk = L.marker(pos, { icon: makeAssetIcon(a, sel) })
          .addTo(m)
          .on("click", () => onAssetClick?.(a.id));
        const factionColor = a.faction === "ALPHA" ? "#ef4444" : "#22c55e";
        const hpPct = a.max_hp ? Math.round((a.hp ?? a.max_hp) / a.max_hp * 100) : 100;
        const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f97316" : "#ef4444";
        mk.bindPopup(`
          <div style="background:#071207;border:1px solid ${factionColor}44;padding:10px 14px;min-width:210px;font-family:'Courier New',monospace;">
            <div style="text-align:center;font-size:26px;margin-bottom:4px;${a.is_destroyed?"filter:grayscale(1) brightness(.4)":""}">${a.icon}</div>
            <div style="font-size:13px;font-weight:700;color:${factionColor};text-align:center;letter-spacing:2px;">${a.callsign}</div>
            <div style="color:#2d5a2d;font-size:9px;text-align:center;margin-bottom:4px;">${a.name}</div>
            <div style="margin:4px 0 6px;background:#0a0a0a;border-radius:2px;height:5px;overflow:hidden;">
              <div style="height:100%;width:${a.is_destroyed?0:hpPct}%;background:${hpColor};transition:width .3s;"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:10px;">
              <span style="color:#2d6a3d">FACTION</span><span style="color:${factionColor};font-weight:700">${a.faction ?? "BRAVO"}</span>
              <span style="color:#2d6a3d">HP</span><span style="color:${hpColor}">${a.is_destroyed?"DESTROYED":`${a.hp ?? "?"}/${a.max_hp ?? "?"}`}</span>
              <span style="color:#2d6a3d">TYPE</span><span style="color:#4ade80">${a.asset_type || "—"}</span>
              <span style="color:#2d6a3d">STATUS</span><span style="color:${a.status==="HALTED"?"#ef4444":a.status==="ENGAGED"?"#f97316":"#4ade80"}">${a.status}</span>
              <span style="color:#2d6a3d">SPEED</span><span style="color:#4ade80">${a.current_speed?.toFixed(0) || 0} km/h</span>
              <span style="color:#2d6a3d">HEADING</span><span style="color:#4ade80">${a.current_heading?.toFixed(0) || 0}°</span>
              <span style="color:#2d6a3d">FUEL</span><span style="color:${(a.fuel_pct||100)<20?"#ef4444":"#4ade80"}">${a.fuel_pct?.toFixed(0) || 100}%</span>
              <span style="color:#2d6a3d">ATTACK</span><span style="color:#f97316">${a.attack_power ?? 0} / ${a.range_km ?? 0}km</span>
            </div>
          </div>
        `, { className: "mil-popup" });
        markersRef.current[a.id] = mk;
      }

      // Trail (faction-coloured)
      const trailColor = a.faction === "ALPHA" ? "#ef444488" : glow;
      if (!trailsRef.current[a.id]) {
        trailsRef.current[a.id] = L.polyline([], {
          color: trailColor, weight: 1.5, opacity: 0.45, dashArray: "3,5",
        }).addTo(m);
      }
      const trail = (a.trail || []).map(p => [p.lat, p.lng]);
      trailsRef.current[a.id].setLatLngs(trail).setStyle({ color: trailColor });
    });
  }, [assets, selectedAssetId]);

  // Path overlay
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    if (pathLayRef.current) { try { m.removeLayer(pathLayRef.current); } catch(_){} }
    pathMksRef.current.forEach(mk => { try { m.removeLayer(mk); } catch(_){} });
    pathMksRef.current = [];
    if (!pathResult?.waypoints?.length) return;

    const lls = pathResult.waypoints.map(p => [p.lat, p.lon]);
    pathLayRef.current = L.polyline(lls, { color:"#facc15", weight:2.5, dashArray:"8,5", opacity:0.9 }).addTo(m);

    const ep = (ll, color, label) => {
      const ic = L.divIcon({ className:"",
        html:`<div style="width:14px;height:14px;border-radius:50%;background:${color};
          border:2px solid #fff;box-shadow:0 0 10px ${color};
          display:flex;align-items:center;justify-content:center;
          font-size:8px;color:#000;font-weight:900;">${label}</div>`,
        iconSize:[14,14], iconAnchor:[7,7] });
      return L.marker(ll, { icon: ic }).addTo(m);
    };
    pathMksRef.current.push(ep(lls[0], "#22c55e", "S"));
    pathMksRef.current.push(ep(lls[lls.length - 1], "#ef4444", "E"));
    m.fitBounds(L.polyline(lls).getBounds(), { padding:[40,40] });
  }, [pathResult]);

  // Convoy overlays
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    // Clear old convoy layers
    Object.values(convoyLayRef.current).forEach(layers => layers.forEach(l => { try { m.removeLayer(l); } catch(_){} }));
    convoyLayRef.current = {};
    (convoys || []).forEach(cv => {
      const wps = Array.isArray(cv.route_waypoints) ? cv.route_waypoints : [];
      if (wps.length < 2) return;
      const isSelected = cv.id === selectedConvoyId;
      const statusColor = {
        PLANNED:"#38bdf8", EN_ROUTE:"#22c55e", COMPLETED:"#4ade80",
        COMPROMISED:"#ef4444", CANCELLED:"#6b7280", HALTED:"#f97316",
      }[cv.status] || "#38bdf8";
      const lls = wps.map(w => [parseFloat(w.lat), parseFloat(w.lon)]).filter(ll => !isNaN(ll[0]));
      if (lls.length < 2) return;
      const layers = [];
      // Route line
      layers.push(L.polyline(lls, {
        color: statusColor, weight: isSelected ? 3 : 1.5,
        dashArray: cv.status === "EN_ROUTE" ? "8,4" : "4,6",
        opacity: isSelected ? 1 : 0.55,
      }).addTo(m));
      // Waypoint markers
      lls.forEach((ll, i) => {
        const ic = L.divIcon({
          className: "",
          html: `<div style="width:8px;height:8px;border-radius:50%;background:${statusColor};
            border:1px solid ${isSelected?"#fff":statusColor};
            box-shadow:0 0 ${isSelected?8:3}px ${statusColor};"></div>`,
          iconSize:[8,8], iconAnchor:[4,4],
        });
        layers.push(L.marker(ll, { icon: ic, interactive: false }).addTo(m));
      });
      // Label at midpoint
      const mid = lls[Math.floor(lls.length / 2)];
      const labelIc = L.divIcon({
        className: "",
        html: `<div style="background:rgba(1,10,3,.9);border:1px solid ${statusColor};border-radius:2px;
          padding:2px 6px;font-family:'Courier New',monospace;font-size:8px;font-weight:700;
          color:${statusColor};letter-spacing:0.5px;white-space:nowrap;">🚛 ${cv.name}</div>`,
        iconAnchor:[40,8],
      });
      layers.push(L.marker(mid, { icon: labelIc, interactive: false }).addTo(m));
      convoyLayRef.current[cv.id] = layers;
    });
  }, [convoys, selectedConvoyId]);

  // Simulation overlay
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    simLayersRef.current.forEach(l => { try { m.removeLayer(l); } catch(_){} });
    simLayersRef.current = [];
    if (simResult && simObjective) {
      simLayersRef.current = buildSimOverlay(simResult, simObjective, m);
    }
  }, [simResult, simObjective]);

  return (
    <div style={{ position:"relative", flex:1, height:"100%" }}>
      <div ref={divRef} style={{ width:"100%", height:"100%" }} />

      {/* CRT scanlines */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", zIndex:400,
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,20,0,.03) 3px,rgba(0,20,0,.03) 4px)",
      }}/>

      {/* Corner tactical brackets */}
      {[
        { top:8,    left:8,  borderTop:"2px solid #22c55e44", borderLeft:"2px solid #22c55e44" },
        { top:8,    right:8, borderTop:"2px solid #22c55e44", borderRight:"2px solid #22c55e44" },
        { bottom:8, left:8,  borderBottom:"2px solid #22c55e44", borderLeft:"2px solid #22c55e44" },
        { bottom:8, right:8, borderBottom:"2px solid #22c55e44", borderRight:"2px solid #22c55e44" },
      ].map((s,i) => <div key={i} style={{ position:"absolute", width:22, height:22, zIndex:500, pointerEvents:"none", ...s }}/>)}

      <style>{`
        .leaflet-container { background:#010a03 !important; }
        .leaflet-tile { filter:brightness(.38) saturate(.4) hue-rotate(115deg) !important; }
        .leaflet-popup-content-wrapper,.leaflet-popup-tip { background:#071207 !important; border:1px solid #1a4a1a !important; padding:0 !important; box-shadow:0 0 20px #22c55e22 !important; }
        .leaflet-popup-content { margin:0 !important; }
        .mil-popup .leaflet-popup-content-wrapper { border-radius:3px !important; }
        .leaflet-control-zoom a { background:#071207 !important; color:#22c55e !important; border:1px solid #1a4a1a !important; font-size:15px !important; width:26px !important; height:26px !important; line-height:26px !important; }
        .leaflet-control-zoom a:hover { background:#0f2410 !important; color:#4ade80 !important; }
        .leaflet-control-zoom { border:1px solid #1a3a1a !important; border-radius:3px !important; }
        @keyframes blip { from{opacity:.3;transform:scale(.8)} to{opacity:1;transform:scale(1.3)} }
        @keyframes haltBlink { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes assetFly { 0%{transform:scale(1) rotate(-5deg)} 50%{transform:scale(1.05) rotate(5deg)} 100%{transform:scale(1) rotate(-5deg)} }
        @keyframes assetHover { from{transform:translateY(0) scale(1)} to{transform:translateY(-4px) scale(1.08)} }
        @keyframes assetSway { from{transform:rotate(-6deg)} to{transform:rotate(6deg)} }
      `}</style>
    </div>
  );
}
