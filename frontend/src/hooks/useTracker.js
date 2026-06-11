import { useState, useEffect, useRef, useCallback } from "react";
import { FN, H } from "../lib/supabase";

export function useTracker() {
  const [assets,    setAssets]    = useState([]);
  const [zones,     setZones]     = useState([]);
  const [alerts,    setAlerts]    = useState([]);
  const [operations,setOperations]= useState([]);
  const [armory,    setArmory]    = useState([]);
  const [pathResult,setPathResult]= useState(null);
  const [simResult, setSimResult] = useState(null);
  const [connected, setConnected] = useState(false);
  const [simLoading,setSimLoading]= useState(false);
  const trails = useRef({});
  const tickRef = useRef(null);

  const tick = useCallback(async () => {
    try {
      const r = await fetch(`${FN}/tick`,{method:"POST",headers:H});
      if(!r.ok) throw new Error(`${r.status}`);
      const d = await r.json();
      d.assets.forEach(a => {
        if(!a.current_lat) return;
        if(!trails.current[a.id]) trails.current[a.id]=[];
        const t=trails.current[a.id];
        t.push({lat:a.current_lat,lng:a.current_lon});
        if(t.length>80) t.shift();
        a.trail=[...t];
      });
      setAssets(d.assets);
      setZones(d.zones);
      setAlerts(prev=>{
        const ids=new Set(prev.map(x=>x.id));
        const inc=(d.alerts||[]).filter(x=>!ids.has(x.id));
        return [...inc,...prev].slice(0,120);
      });
      setConnected(true);
    } catch{ setConnected(false); }
  }, []);

  useEffect(()=>{ tick(); tickRef.current=setInterval(tick,1000); return()=>clearInterval(tickRef.current); },[tick]);

  // Load operations and armory once
  useEffect(()=>{
    fetch(`${FN}/fences`,{headers:H}).then(r=>r.json()).catch(()=>[]);
    fetch(`${FN}/armory`,{headers:H}).then(r=>r.json()).then(d=>setArmory(Array.isArray(d)?d:[])).catch(()=>{});
    // load operations via assets endpoint workaround — direct supabase for operations
    fetch(`${FN}/assets`,{headers:H}).then(r=>r.json()).catch(()=>[]);
  },[]);

  const runPathfind = useCallback(async(assetId,endLat,endLon,algo)=>{
    const asset=assets.find(a=>a.id===assetId);
    if(!asset?.current_lat) return;
    const r=await fetch(`${FN}/pathfind`,{method:"POST",headers:H,body:JSON.stringify({asset_id:assetId,start_lat:asset.current_lat,start_lon:asset.current_lon,end_lat:endLat,end_lon:endLon,algorithm:algo})});
    const d=await r.json();
    setPathResult({...d,assetId,algo});
    return d;
  },[assets]);

  const runSimulation = useCallback(async(opId,assetIds,opType,objLat,objLon,terrain,weather,timeOfDay,hostileCount)=>{
    setSimLoading(true);
    try {
      const r=await fetch(`${FN}/simulate`,{method:"POST",headers:H,body:JSON.stringify({operation_id:opId,asset_ids:assetIds,op_type:opType,objective_lat:objLat,objective_lon:objLon,terrain,weather,time_of_day:timeOfDay,hostile_count:hostileCount})});
      const d=await r.json();
      setSimResult(d);
      return d;
    } finally { setSimLoading(false); }
  },[]);

  const clearAlerts = useCallback(async()=>{
    await fetch(`${FN}/alerts`,{method:"DELETE",headers:H});
    setAlerts([]);
  },[]);

  const addZone = useCallback(async(form)=>{
    const r=await fetch(`${FN}/fences`,{method:"POST",headers:H,body:JSON.stringify(form)});
    const z=await r.json();
    setZones(prev=>[...prev,z]);
  },[]);

  const removeZone = useCallback(async(id)=>{
    await fetch(`${FN}/fences?id=${id}`,{method:"DELETE",headers:H});
    setZones(prev=>prev.filter(z=>z.id!==id));
  },[]);

  return { assets, zones, alerts, operations, armory, pathResult, simResult, simLoading, connected,
           tick, runPathfind, runSimulation, clearAlerts, addZone, removeZone, setPathResult, setSimResult };
}
