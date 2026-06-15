import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Fantasy palette ───────────────────────────────────────────────────────────
const FC = {
  bravo:   "#d4a843",   // Kingdom gold
  alpha:   "#c41e3a",   // Blood crimson
  neutral: "#6b7fa0",   // Steel grey
  fire:    "#ff6b1a",
  purple:  "#9b59d0",
  glow:    "rgba(212,168,67,0.6)",
};

// ── Zone fantasy config ───────────────────────────────────────────────────────
const ZONE_CFG = {
  FOB:        { color:"#c9a84c", fill:0.09, dash:null,   label:"⚔ KEEP"        },
  HOSTILE:    { color:"#8b1a2a", fill:0.14, dash:"8,5",  label:"☠ HOSTILE"     },
  RESTRICTED: { color:"#b8732a", fill:0.09, dash:"10,5", label:"⚠ CURSED LAND" },
  CIVILIAN:   { color:"#5b8bc5", fill:0.06, dash:"4,4",  label:"🏘 HAMLET"     },
  MINEFIELD:  { color:"#7a1a1a", fill:0.16, dash:"3,3",  label:"💀 DEATHFIELD" },
  NO_FLY:     { color:"#7b4f9e", fill:0.08, dash:"12,6", label:"🌀 FORBIDDEN"  },
  SUPPLY:     { color:"#3a8a5a", fill:0.08, dash:"6,3",  label:"🏛 SUPPLY"     },
  OBJECTIVE:  { color:"#d4a843", fill:0.11, dash:"8,4",  label:"★ OBJECTIVE"   },
  BASE:       { color:"#2a6a9a", fill:0.09, dash:null,   label:"🏰 STRONGHOLD" },
  OPERATIONAL:{ color:"#b8732a", fill:0.07, dash:"6,4",  label:"⚔ WARGROUND"  },
  SAFE:       { color:"#3a7a5a", fill:0.10, dash:"4,2",  label:"🌿 REFUGE"     },
  PATROL:     { color:"#4a8aaa", fill:0.06, dash:"5,3",  label:"👁 PATROL"     },
  GEOFENCE:   { color:"#7b4f9e", fill:0.06, dash:"6,3",  label:"🔮 WARDING"   },
};

const THREAT_GLOW = { GREEN:FC.bravo, YELLOW:"#d4aa17", ORANGE:"#d47820", RED:FC.alpha };

function havFow(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2-lat1), dLon = toR(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function classifyAsset(asset) {
  const t = ((asset.asset_type||"")+(asset.name||"")).toUpperCase();
  const svc = (asset.service||"").toUpperCase();
  if (t.match(/JET|FIGHTER|BOMBER|RAFALE|SUKHOI|TEJAS|JAGUAR|MIG/)) return "jet";
  if (t.match(/HELI|APACHE|DHRUV|MI-|ALH/)) return "heli";
  if (t.match(/DRONE|UAV|RUSTOM|TAPAS|MALE/)) return "drone";
  if (t.match(/SHIP|FRIGATE|DESTROYER|INS |NAVAL/)||svc==="NAVY") return "ship";
  if (t.match(/SUB|SUBMARINE/)) return "sub";
  if (t.match(/TRANSPORT|C-17|IL-76|AN-32/)) return "transport";
  if (t.match(/MISSILE|BDL|PRITHVI|AGNI/)) return "missile";
  return "ground";
}

function makeAssetIcon(asset, selected=false) {
  const isAlpha     = (asset.faction??"BRAVO")==="ALPHA";
  const isDestroyed = asset.is_destroyed===true;
  const status      = (asset.status||"ACTIVE").toUpperCase();
  const isHalted    = isDestroyed||["HALTED","MAINTENANCE","DISABLED","DESTROYED"].includes(status);
  const isEngaged   = !isDestroyed && status==="ENGAGED";
  const cls         = classifyAsset(asset);
  const heading     = (asset.current_heading||0).toFixed(0);
  const hpPct       = asset.max_hp ? Math.max(0,Math.round((asset.hp??asset.max_hp)/asset.max_hp*100)) : 100;

  const mainColor = isDestroyed ? "#444"
                  : isAlpha     ? FC.alpha
                  : (THREAT_GLOW[asset.threat_level]||FC.bravo);

  const size = selected ? 30 : 22;

  // Animation
  let iconAnim = "none";
  if (!isHalted) {
    if (cls==="jet"||cls==="transport") iconAnim = "assetFly 3.5s linear infinite";
    else if (cls==="heli"||cls==="drone") iconAnim = "assetHover 1.1s ease-in-out infinite alternate";
    else if (cls==="ship"||cls==="sub") iconAnim = "assetSway 2.5s ease-in-out infinite alternate";
  }

  const showArrow = !isHalted && ["ground","jet","transport","heli","drone"].includes(cls);
  const arrowColor = isEngaged ? FC.fire : mainColor;

  const arrowHtml = showArrow
    ? `<div style="position:absolute;top:-3px;left:50%;transform:translateX(-50%) rotate(${heading}deg);
        width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;
        border-bottom:10px solid ${arrowColor};opacity:0.9;pointer-events:none;
        filter:drop-shadow(0 0 3px ${arrowColor});"></div>`
    : "";

  // Battle explosion ring (for ENGAGED)
  const battleRing = isEngaged
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:${size*2.5}px;height:${size*2.5}px;border-radius:50%;
        border:2px solid ${FC.fire};animation:battlePulse 0.6s ease-out infinite;
        pointer-events:none;z-index:-1;"></div>
       <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:${size*1.5}px;height:${size*1.5}px;border-radius:50%;
        border:1px solid ${FC.alpha};animation:battlePulse 0.6s ease-out infinite .2s;
        pointer-events:none;z-index:-1;"></div>`
    : "";

  // Destruction fire effect
  const deathHtml = isDestroyed
    ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);
        font-size:14px;animation:deathFlicker 0.4s infinite alternate;
        filter:drop-shadow(0 0 6px #ff4400);pointer-events:none;">💀</div>
       <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
        width:${size*1.8}px;height:${size*1.8}px;border-radius:50%;
        background:radial-gradient(circle,rgba(180,0,0,0.3) 0%,transparent 70%);
        pointer-events:none;animation:deathGlow 1s ease-in-out infinite alternate;"></div>`
    : "";

  // Status badge
  const badge = isDestroyed ? "" : isHalted
    ? `<div style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);
        background:rgba(139,26,42,0.92);color:#ffaa00;font-size:6px;font-weight:900;
        padding:1px 5px;border-radius:2px;letter-spacing:1px;border:1px solid #c41e3a;
        animation:haltBlink 0.9s infinite;white-space:nowrap;pointer-events:none;">HALTED</div>`
    : isEngaged
    ? `<div style="position:absolute;top:-11px;left:50%;transform:translateX(-50%);
        background:rgba(180,60,0,0.9);color:#fff;font-size:6px;font-weight:900;
        padding:1px 5px;border-radius:2px;letter-spacing:1px;border:1px solid #ff6b1a;
        animation:engagedBlink 0.35s infinite alternate;white-space:nowrap;pointer-events:none;">⚔ BATTLE</div>`
    : "";

  const factionBadge = !isDestroyed
    ? `<div style="position:absolute;bottom:-1px;right:-5px;font-size:7px;font-weight:900;
        color:${mainColor};text-shadow:0 0 6px ${mainColor};pointer-events:none;">
        ${isAlpha?"▲":"◆"}</div>`
    : "";

  // HP bar
  const hpColor = isDestroyed ? "#333" : hpPct>60 ? FC.bravo : hpPct>30 ? "#d47820" : FC.alpha;

  const glowIntensity = selected ? 18 : isEngaged ? 14 : 7;
  const glowColor = isDestroyed ? "#33333388" : mainColor;

  return L.divIcon({
    className: "",
    iconSize:   [size+20, size+26],
    iconAnchor: [(size+20)/2, (size+26)/2],
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      ${deathHtml}${battleRing}${badge}${arrowHtml}${factionBadge}
      <!-- Main icon -->
      <div style="
        font-size:${size}px;line-height:1;
        filter:drop-shadow(0 0 ${glowIntensity}px ${glowColor})${isDestroyed?" grayscale(90%) brightness(0.3)":""}${isHalted&&!isDestroyed?" grayscale(60%) brightness(0.6)":""};
        animation:${iconAnim};transform-origin:center;
        ${selected?"transform:scale(1.2);":""}
        transition:transform .25s;
      ">${asset.icon}</div>
      <!-- HP bar -->
      <div style="width:${size-2}px;height:3px;background:rgba(0,0,0,0.5);border-radius:2px;margin-top:2px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
        <div style="height:100%;width:${isDestroyed?0:hpPct}%;background:${hpColor};border-radius:2px;transition:width .4s;
          box-shadow:0 0 4px ${hpColor};"></div>
      </div>
      <!-- Blip dot -->
      <div style="
        width:${selected?7:isEngaged?6:4}px;height:${selected?7:isEngaged?6:4}px;border-radius:50%;
        background:${mainColor};margin-top:1px;
        box-shadow:0 0 ${selected?12:6}px ${mainColor};
        animation:${isHalted?"haltBlink 0.9s infinite":`blip ${asset.threat_level==="RED"?"0.4":"1.8"}s infinite alternate`};
      "></div>
    </div>`,
  });
}

function buildSimOverlay(simResult, simObjective, map) {
  if (!simResult||!simObjective) return [];
  const layers = [];
  const { lat, lon } = simObjective;
  const prob = simResult.success_probability||0.5;
  const risk = simResult.risk_score||0.5;
  const outerColor = prob>0.7 ? FC.bravo : prob>0.4 ? "#d47820" : FC.alpha;

  layers.push(L.circle([lat,lon],{radius:8000,color:outerColor,weight:1.5,dashArray:"6,4",fillColor:outerColor,fillOpacity:0.04}).addTo(map));
  layers.push(L.circle([lat,lon],{radius:2000,color:outerColor,weight:2,dashArray:"3,3",fillColor:outerColor,fillOpacity:0.09}).addTo(map));

  const ic = L.divIcon({
    className:"",
    html:`<div style="background:rgba(8,4,12,0.97);border:2px solid ${outerColor};border-radius:4px;
      padding:7px 12px;font-family:'Cinzel',Georgia,serif;min-width:130px;
      box-shadow:0 0 24px ${outerColor}55,inset 0 0 20px rgba(0,0,0,0.8);">
      <div style="font-size:10px;font-weight:700;color:${outerColor};letter-spacing:2px;margin-bottom:5px;">★ OBJECTIVE</div>
      <div style="font-size:9px;color:#c9a84c;">SUCCESS: <b style="color:${outerColor}">${Math.round(prob*100)}%</b></div>
      <div style="font-size:9px;color:#c9a84c;">RISK: <b style="color:${risk>0.6?FC.alpha:"#d47820"}">${Math.round(risk*100)}%</b></div>
      <div style="font-size:9px;color:#c9a84c;">COST: <b style="color:#d4a843">₹${simResult.total_cost_crore?.toFixed(0)}Cr</b></div>
    </div>`,
    iconAnchor:[65,0],
  });
  layers.push(L.marker([lat,lon],{icon:ic}).addTo(map));

  (simResult.phases||[]).forEach((phase,i)=>{
    const angle=(i/4)*Math.PI*2;
    const pColor=phase.status==="SUCCESS"?FC.bravo:phase.status==="PARTIAL"?"#d47820":FC.alpha;
    const phIc=L.divIcon({className:"",html:`<div style="background:rgba(8,4,12,.9);border:1px solid ${pColor};border-radius:2px;
      padding:2px 6px;font-family:'Courier New',monospace;font-size:7px;color:${pColor};font-weight:700;
      letter-spacing:.5px;white-space:nowrap;">P${phase.phase}: ${phase.name}</div>`,iconAnchor:[30,8]});
    layers.push(L.marker([lat+Math.cos(angle)*0.055, lon+Math.sin(angle)*0.066],{icon:phIc,interactive:false}).addTo(map));
  });
  return layers;
}

const SECTORS = [
  { id:"ALL",      lat:28.62,lon:77.21,zoom:6, label:"All India"          },
  { id:"WESTERN",  lat:30.70,lon:75.50,zoom:7, label:"Western Command"    },
  { id:"NORTHERN", lat:34.10,lon:74.90,zoom:7, label:"Northern Command"   },
  { id:"EASTERN",  lat:26.00,lon:91.50,zoom:7, label:"Eastern Command"    },
  { id:"SOUTHERN", lat:17.00,lon:78.50,zoom:7, label:"Southern Command"   },
  { id:"CENTRAL",  lat:26.85,lon:80.95,zoom:7, label:"Central Command"    },
  { id:"WAC",      lat:28.62,lon:77.21,zoom:8, label:"Western Air Command"},
  { id:"WNC",      lat:18.92,lon:72.82,zoom:8, label:"Western Naval Command"},
  { id:"LOC",      lat:34.10,lon:74.90,zoom:9, label:"Line of Control"    },
  { id:"SIACHEN",  lat:35.40,lon:76.90,zoom:9, label:"Siachen Glacier"    },
];

export default function MapView({
  assets, zones, pathResult, simResult, simObjective,
  convoys, selectedConvoyId, selectedAssetId,
  onAssetClick, activeSector, fogOfWar=true, orderMode=null, onMapClick=null,
}) {
  const divRef       = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});
  const trailsRef    = useRef({});
  const zoneLayRef   = useRef({});
  const pathLayRef   = useRef(null);
  const pathMksRef   = useRef([]);
  const simLayersRef = useRef([]);
  const convoyLayRef = useRef({});
  const orderLayRef  = useRef([]);

  // Init map
  useEffect(() => {
    if (mapRef.current) return;
    const m = L.map(divRef.current, {
      center:[28.62,77.21], zoom:7,
      zoomControl:false, attributionControl:false,
    });

    // Fantasy dark base — CartoDB DarkMatter
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom:19,
      subdomains:"abcd",
    }).addTo(m);

    L.control.zoom({ position:"bottomright" }).addTo(m);

    // Golden grid overlay (fantasy map coordinates)
    const gridLayer = L.layerGroup();
    for (let lat=8; lat<=37; lat+=2) {
      L.polyline([[lat,68],[lat,98]],{color:"rgba(212,168,67,0.06)",weight:0.6,interactive:false}).addTo(gridLayer);
    }
    for (let lon=68; lon<=98; lon+=2) {
      L.polyline([[8,lon],[37,lon]],{color:"rgba(212,168,67,0.06)",weight:0.6,interactive:false}).addTo(gridLayer);
    }
    gridLayer.addTo(m);
    mapRef.current = m;
  }, []);

  // Map click for order mode
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    const handler = e => { if (onMapClick) onMapClick(e.latlng); };
    m.on("click", handler);
    m.getContainer().style.cursor = onMapClick ? "crosshair" : "";
    return () => m.off("click", handler);
  }, [onMapClick]);

  // Order route overlay
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    orderLayRef.current.forEach(l => { try { m.removeLayer(l); } catch(_){} });
    orderLayRef.current = [];
    if (!orderMode) return;

    const asset = (assets||[]).find(a => a.id===orderMode.assetId);
    const origin = asset ? [asset.current_lat,asset.current_lon] : null;
    const wps = orderMode.waypoints.map(w => [w.lat,w.lon]);
    const points = origin ? [origin,...wps] : wps;

    if (points.length >= 2) {
      // Double line effect for fantasy route
      orderLayRef.current.push(L.polyline(points,{color:"#d4a84388",weight:5,dashArray:"12,6",opacity:0.5}).addTo(m));
      orderLayRef.current.push(L.polyline(points,{color:"#d4a843",weight:2,dashArray:"8,5",opacity:0.95}).addTo(m));
    }

    wps.forEach((ll,i) => {
      const ic = L.divIcon({
        className:"",
        html:`<div style="width:16px;height:16px;border-radius:50%;
          background:radial-gradient(circle,#d4a843,#8b6010);
          border:2px solid #fff;box-shadow:0 0 12px #d4a843,0 0 4px #fff;
          display:flex;align-items:center;justify-content:center;
          font-size:8px;color:#000;font-weight:900;">${i+1}</div>`,
        iconSize:[16,16], iconAnchor:[8,8],
      });
      orderLayRef.current.push(L.marker(ll,{icon:ic,interactive:false}).addTo(m));
    });
  }, [orderMode, assets]);

  // Pan to sector
  useEffect(() => {
    const m = mapRef.current; if (!m||!activeSector) return;
    const s = SECTORS.find(x => x.id===activeSector);
    if (s) m.setView([s.lat,s.lon],s.zoom,{animate:true,duration:0.9});
  }, [activeSector]);

  // Render zones
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    Object.values(zoneLayRef.current).forEach(l => { try { m.removeLayer(l); } catch(_){} });
    zoneLayRef.current = {};
    (zones||[]).forEach(z => {
      const cfg = ZONE_CFG[z.zone_type]||ZONE_CFG.FOB;
      const captureColor = z.controlled_by==="BRAVO" ? FC.bravo
                         : z.controlled_by==="ALPHA" ? FC.alpha : null;
      const borderColor = captureColor??cfg.color;
      const captureLabel = captureColor
        ? `${z.controlled_by==="BRAVO"?"▣":"▤"} ${z.name} [${z.controlled_by}]`
        : `${cfg.label}: ${z.name}`;

      const circle = L.circle([z.center_lat,z.center_lon],{
        radius:z.radius_meters, color:borderColor,
        weight:captureColor ? 2.5 : 1.5,
        dashArray:captureColor ? null : cfg.dash,
        fillColor:borderColor,
        fillOpacity:captureColor ? 0.14 : cfg.fill,
      }).addTo(m);

      const lbl = L.divIcon({
        className:"",
        html:`<div style="
          background:rgba(8,4,12,.92);border:1px solid ${borderColor};
          color:${borderColor};padding:2px 7px;border-radius:2px;
          font-family:'Courier New',monospace;font-size:9px;font-weight:700;
          letter-spacing:1px;white-space:nowrap;pointer-events:none;
          box-shadow:0 0 10px ${borderColor}44;opacity:.95;">
          ${captureLabel}</div>`,
        iconAnchor:[60,10],
      });
      L.marker([z.center_lat,z.center_lon],{icon:lbl,interactive:false}).addTo(m);
      zoneLayRef.current[z.id] = circle;
    });
  }, [zones]);

  // Render assets + trails
  useEffect(() => {
    const m = mapRef.current; if (!m) return;

    const bravoLive = (assets||[]).filter(a => a.faction!=="ALPHA"&&!a.is_destroyed&&a.current_lat!=null);
    const visibleAlphaIds = new Set();
    if (fogOfWar) {
      (assets||[]).filter(a => a.faction==="ALPHA"&&a.current_lat!=null).forEach(alpha => {
        for (const bravo of bravoLive) {
          if (havFow(bravo.current_lat,bravo.current_lon,alpha.current_lat,alpha.current_lon)
              <= (bravo.detection_radius_km??10)*1000) { visibleAlphaIds.add(alpha.id); break; }
        }
      });
    }

    (assets||[]).forEach(a => {
      if (!a.current_lat) return;
      if (fogOfWar && a.faction==="ALPHA" && !visibleAlphaIds.has(a.id)) {
        if (markersRef.current[a.id]) { try { m.removeLayer(markersRef.current[a.id]); } catch(_){} delete markersRef.current[a.id]; }
        if (trailsRef.current[a.id])  { try { m.removeLayer(trailsRef.current[a.id]);  } catch(_){} delete trailsRef.current[a.id]; }
        return;
      }

      const pos = [a.current_lat,a.current_lon];
      const sel = a.id===selectedAssetId;
      const isAlpha = a.faction==="ALPHA";
      const mainColor = a.is_destroyed ? "#444" : isAlpha ? FC.alpha : (THREAT_GLOW[a.threat_level]||FC.bravo);
      const hpPct = a.max_hp ? Math.max(0,Math.round((a.hp??a.max_hp)/a.max_hp*100)) : 100;
      const hpColor = hpPct>60 ? FC.bravo : hpPct>30 ? "#d47820" : FC.alpha;

      if (markersRef.current[a.id]) {
        markersRef.current[a.id].setLatLng(pos).setIcon(makeAssetIcon(a,sel));
      } else {
        const mk = L.marker(pos,{icon:makeAssetIcon(a,sel)})
          .addTo(m)
          .on("click", () => onAssetClick?.(a.id));

        mk.bindPopup(`
          <div style="background:rgba(8,4,12,0.98);border:1px solid ${mainColor}55;
            padding:12px 16px;min-width:220px;font-family:'Courier New',monospace;
            box-shadow:0 0 30px ${mainColor}22,inset 0 0 40px rgba(0,0,0,.7);">
            <div style="text-align:center;font-size:28px;margin-bottom:6px;
              ${a.is_destroyed?"filter:grayscale(1) brightness(.3)":""};
              filter:drop-shadow(0 0 10px ${mainColor});">${a.icon}</div>
            <div style="font-size:14px;font-weight:700;color:${mainColor};text-align:center;
              letter-spacing:3px;text-shadow:0 0 12px ${mainColor};">${a.callsign}</div>
            <div style="color:rgba(212,168,67,0.5);font-size:9px;text-align:center;margin-bottom:6px;">${a.name}</div>
            <div style="margin:5px 0 8px;background:rgba(0,0,0,0.4);border-radius:3px;height:5px;overflow:hidden;
              border:1px solid rgba(255,255,255,0.08);">
              <div style="height:100%;width:${a.is_destroyed?0:hpPct}%;background:${hpColor};
                box-shadow:0 0 6px ${hpColor};transition:width .3s;"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;">
              <span style="color:rgba(212,168,67,0.5)">FACTION</span><span style="color:${mainColor};font-weight:700">${a.faction??"BRAVO"}</span>
              <span style="color:rgba(212,168,67,0.5)">HP</span><span style="color:${hpColor}">${a.is_destroyed?"SLAIN":`${a.hp??0}/${a.max_hp??0}`}</span>
              <span style="color:rgba(212,168,67,0.5)">TYPE</span><span style="color:#d4a843">${a.asset_type||"—"}</span>
              <span style="color:rgba(212,168,67,0.5)">STATUS</span><span style="color:${a.status==="HALTED"?FC.alpha:a.status==="ENGAGED"?"#ff6b1a":FC.bravo}">${a.status}</span>
              <span style="color:rgba(212,168,67,0.5)">SPEED</span><span style="color:#d4a843">${a.current_speed?.toFixed(0)||0} km/h</span>
              <span style="color:rgba(212,168,67,0.5)">HEADING</span><span style="color:#d4a843">${a.current_heading?.toFixed(0)||0}°</span>
              <span style="color:rgba(212,168,67,0.5)">FUEL</span><span style="color:${(a.fuel_pct||100)<20?FC.alpha:"#d4a843"}">${a.fuel_pct?.toFixed(0)||100}%</span>
              <span style="color:rgba(212,168,67,0.5)">ATTACK</span><span style="color:#d47820">${a.attack_power??0} / ${a.range_km??0}km</span>
            </div>
          </div>
        `, { className:"fantasy-popup" });
        markersRef.current[a.id] = mk;
      }

      // Trail
      const trailColor = isAlpha ? `${FC.alpha}88` : `${mainColor}88`;
      if (!trailsRef.current[a.id]) {
        trailsRef.current[a.id] = L.polyline([],{color:trailColor,weight:1.8,opacity:0.5,dashArray:"4,6"}).addTo(m);
      }
      const trail = (a.trail||[]).map(p => [p.lat,p.lng]);
      trailsRef.current[a.id].setLatLngs(trail).setStyle({color:trailColor});
    });
  }, [assets, selectedAssetId, fogOfWar]);

  // Path overlay
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    if (pathLayRef.current) { try { m.removeLayer(pathLayRef.current); } catch(_){} }
    pathMksRef.current.forEach(mk => { try { m.removeLayer(mk); } catch(_){} });
    pathMksRef.current = [];
    if (!pathResult?.waypoints?.length) return;

    const lls = pathResult.waypoints.map(p => [p.lat,p.lon]);
    pathLayRef.current = L.polyline(lls,{color:"#d4a843",weight:2.5,dashArray:"10,6",opacity:0.95}).addTo(m);

    const ep = (ll,color,label) => {
      const ic = L.divIcon({className:"",
        html:`<div style="width:16px;height:16px;border-radius:50%;background:${color};
          border:2px solid #fff;box-shadow:0 0 12px ${color};
          display:flex;align-items:center;justify-content:center;
          font-size:9px;color:#000;font-weight:900;">${label}</div>`,
        iconSize:[16,16],iconAnchor:[8,8]});
      return L.marker(ll,{icon:ic}).addTo(m);
    };
    pathMksRef.current.push(ep(lls[0],FC.bravo,"S"));
    pathMksRef.current.push(ep(lls[lls.length-1],FC.alpha,"E"));
    m.fitBounds(L.polyline(lls).getBounds(),{padding:[40,40]});
  }, [pathResult]);

  // Convoy overlays
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    Object.values(convoyLayRef.current).forEach(ls => ls.forEach(l => { try { m.removeLayer(l); } catch(_){} }));
    convoyLayRef.current = {};
    (convoys||[]).forEach(cv => {
      const wps = Array.isArray(cv.route_waypoints) ? cv.route_waypoints : [];
      if (wps.length<2) return;
      const isSelected = cv.id===selectedConvoyId;
      const statusColor = {PLANNED:"#5b8bc5",EN_ROUTE:FC.bravo,COMPLETED:"#4ade80",
        COMPROMISED:FC.alpha,CANCELLED:"#6b7280",HALTED:"#d47820"}[cv.status]||"#5b8bc5";
      const lls = wps.map(w => [parseFloat(w.lat),parseFloat(w.lon)]).filter(ll => !isNaN(ll[0]));
      if (lls.length<2) return;
      const layers = [];
      layers.push(L.polyline(lls,{color:statusColor,weight:isSelected?3:1.5,
        dashArray:cv.status==="EN_ROUTE"?"8,4":"4,6",opacity:isSelected?1:0.55}).addTo(m));
      lls.forEach(ll => {
        const ic = L.divIcon({className:"",
          html:`<div style="width:8px;height:8px;border-radius:50%;background:${statusColor};
            border:1px solid ${isSelected?"#fff":statusColor};box-shadow:0 0 ${isSelected?8:3}px ${statusColor};"></div>`,
          iconSize:[8,8],iconAnchor:[4,4]});
        layers.push(L.marker(ll,{icon:ic,interactive:false}).addTo(m));
      });
      const mid = lls[Math.floor(lls.length/2)];
      const labelIc = L.divIcon({className:"",
        html:`<div style="background:rgba(8,4,12,.95);border:1px solid ${statusColor};border-radius:2px;
          padding:2px 8px;font-family:'Courier New',monospace;font-size:8px;font-weight:700;
          color:${statusColor};letter-spacing:.5px;white-space:nowrap;
          box-shadow:0 0 8px ${statusColor}44;">🚛 ${cv.name}</div>`,
        iconAnchor:[40,8]});
      layers.push(L.marker(mid,{icon:labelIc,interactive:false}).addTo(m));
      convoyLayRef.current[cv.id] = layers;
    });
  }, [convoys, selectedConvoyId]);

  // Simulation overlay
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    simLayersRef.current.forEach(l => { try { m.removeLayer(l); } catch(_){} });
    simLayersRef.current = [];
    if (simResult && simObjective) simLayersRef.current = buildSimOverlay(simResult,simObjective,m);
  }, [simResult, simObjective]);

  return (
    <div style={{ position:"relative", flex:1, height:"100%" }}>
      <div ref={divRef} style={{ width:"100%", height:"100%" }} />

      {/* Dark vignette overlay */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", zIndex:400,
        background:"radial-gradient(ellipse at center, transparent 55%, rgba(4,2,8,0.7) 100%)",
      }}/>

      {/* Subtle scanline texture */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none", zIndex:401,
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 4px)",
      }}/>

      {/* Fantasy corner brackets — gold */}
      {[
        { top:8,   left:8,  borderTop:"2px solid rgba(212,168,67,0.5)", borderLeft:"2px solid rgba(212,168,67,0.5)" },
        { top:8,   right:8, borderTop:"2px solid rgba(212,168,67,0.5)", borderRight:"2px solid rgba(212,168,67,0.5)" },
        { bottom:8,left:8,  borderBottom:"2px solid rgba(212,168,67,0.5)", borderLeft:"2px solid rgba(212,168,67,0.5)" },
        { bottom:8,right:8, borderBottom:"2px solid rgba(212,168,67,0.5)", borderRight:"2px solid rgba(212,168,67,0.5)" },
      ].map((s,i) => (
        <div key={i} style={{ position:"absolute", width:24, height:24, zIndex:500, pointerEvents:"none", ...s }}/>
      ))}

      {/* Inner corner diamonds */}
      {[
        { top:10,   left:10  },
        { top:10,   right:10 },
        { bottom:10,left:10  },
        { bottom:10,right:10 },
      ].map((s,i) => (
        <div key={`d${i}`} style={{
          position:"absolute", width:5, height:5, zIndex:501, pointerEvents:"none",
          background:"rgba(212,168,67,0.5)", transform:"rotate(45deg)", ...s,
        }}/>
      ))}

      <style>{`
        /* Fantasy dark map */
        .leaflet-container { background:#08060c !important; }
        .leaflet-tile { filter:brightness(0.75) saturate(0.7) contrast(1.1) !important; }

        /* Fantasy popups */
        .leaflet-popup-content-wrapper,.leaflet-popup-tip {
          background:rgba(8,4,12,0.98) !important;
          border:1px solid rgba(212,168,67,0.3) !important;
          padding:0 !important;
          box-shadow:0 0 30px rgba(212,168,67,0.15),inset 0 0 40px rgba(0,0,0,0.8) !important;
        }
        .leaflet-popup-content { margin:0 !important; }
        .fantasy-popup .leaflet-popup-content-wrapper { border-radius:4px !important; }
        .leaflet-popup-close-button { color:rgba(212,168,67,0.6) !important; font-size:16px !important; }
        .leaflet-popup-close-button:hover { color:#d4a843 !important; }

        /* Zoom controls */
        .leaflet-control-zoom a {
          background:rgba(8,4,12,0.95) !important; color:#d4a843 !important;
          border:1px solid rgba(212,168,67,0.3) !important;
          font-size:15px !important; width:28px !important; height:28px !important; line-height:28px !important;
          text-shadow:0 0 8px #d4a843 !important;
        }
        .leaflet-control-zoom a:hover { background:rgba(20,10,30,0.98) !important; color:#fff !important; }
        .leaflet-control-zoom { border:1px solid rgba(212,168,67,0.25) !important; border-radius:3px !important; }

        /* Animations */
        @keyframes blip        { from{opacity:.3;transform:scale(.7)} to{opacity:1;transform:scale(1.4)} }
        @keyframes haltBlink   { 0%,100%{opacity:1} 50%{opacity:.2} }
        @keyframes engagedBlink{ from{opacity:.6;background:rgba(180,60,0,0.7)} to{opacity:1;background:rgba(220,80,0,0.95)} }
        @keyframes battlePulse { 0%{transform:translate(-50%,-50%) scale(0.5);opacity:0.9} 100%{transform:translate(-50%,-50%) scale(1.8);opacity:0} }
        @keyframes deathFlicker{ from{opacity:.5;transform:translateX(-50%) scale(0.8)} to{opacity:1;transform:translateX(-50%) scale(1.1)} }
        @keyframes deathGlow   { from{opacity:.3} to{opacity:.7} }
        @keyframes assetFly    { 0%{transform:scale(1) rotate(-5deg)} 50%{transform:scale(1.05) rotate(5deg)} 100%{transform:scale(1) rotate(-5deg)} }
        @keyframes assetHover  { from{transform:translateY(0) scale(1)} to{transform:translateY(-5px) scale(1.1)} }
        @keyframes assetSway   { from{transform:rotate(-6deg)} to{transform:rotate(6deg)} }
      `}</style>
    </div>
  );
}
