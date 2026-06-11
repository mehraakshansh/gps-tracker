import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

const emojiIcon = (icon) =>
  L.divIcon({
    html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 8px rgba(0,0,0,.8))">${icon}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

export default function MapView({ assets, fences }) {
  const divRef      = useRef(null);
  const mapRef      = useRef(null);
  const markersRef  = useRef({});
  const trailsRef   = useRef({});
  const fenceLayRef = useRef({});

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;
    mapRef.current = L.map(divRef.current, { center: [28.618, 77.21], zoom: 13, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, []);

  // Fences
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    Object.values(fenceLayRef.current).forEach(l => map.removeLayer(l));
    fenceLayRef.current = {};
    (fences || []).forEach(f => {
      fenceLayRef.current[f.id] = L.circle(
        [f.center_lat, f.center_lon],
        { radius: f.radius_meters, color: f.color, fillColor: f.color, fillOpacity: 0.08, weight: 2, dashArray: "6,5" }
      ).addTo(map).bindTooltip(`<b>${f.name}</b><br/>r = ${f.radius_meters} m`, { direction: "top" });
    });
  }, [fences]);

  // Assets
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    (assets || []).forEach(a => {
      if (!a.current_lat) return;
      const pos   = [a.current_lat, a.current_lon];
      const inside = a.fenceStatus?.some(s => s.state === "IN");
      const tColor = inside ? "#22c55e" : "#f59e0b";

      // Marker
      if (markersRef.current[a.id]) {
        markersRef.current[a.id].setLatLng(pos).setIcon(emojiIcon(a.icon));
      } else {
        markersRef.current[a.id] = L.marker(pos, { icon: emojiIcon(a.icon) })
          .addTo(map)
          .bindPopup(`<b>${a.icon} ${a.name}</b><br/>${a.asset_type}`);
      }

      // Trail
      if (!trailsRef.current[a.id]) {
        trailsRef.current[a.id] = L.polyline([], { color: tColor, weight: 2, opacity: 0.6 }).addTo(map);
      }
      const trail = trailsRef.current[a.id];
      const lls   = (a.trail || []).map(p => L.latLng(p.lat, p.lng));
      trail.setLatLngs(lls).setStyle({ color: tColor });
    });
  }, [assets]);

  return (
    <div ref={divRef} style={{ width: "100%", height: "100%", borderRadius: 12, overflow: "hidden" }} />
  );
}
