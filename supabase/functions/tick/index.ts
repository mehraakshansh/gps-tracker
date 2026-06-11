// ── GPS Tick Engine (military version) ───────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const R=6371000, toR=(d:number)=>d*Math.PI/180;

function hav(lat1:number,lon1:number,lat2:number,lon2:number){
  const φ1=toR(lat1),φ2=toR(lat2),Δφ=toR(lat2-lat1),Δλ=toR(lon2-lon1);
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function bearing(lat1:number,lon1:number,lat2:number,lon2:number){
  const φ1=toR(lat1),φ2=toR(lat2),Δλ=toR(lon2-lon1);
  return ((Math.atan2(Math.sin(Δλ)*Math.cos(φ2),Math.cos(φ1)*Math.sin(φ2)-Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ))*180/Math.PI)+360)%360;
}
function noise(lat:number,lon:number,m:number){
  const d=(Math.random()-.5)*2*m,a=Math.random()*2*Math.PI;
  return [lat+(d*Math.cos(a))/111320,lon+(d*Math.sin(a))/(111320*Math.cos(toR(lat)))];
}
function simStep(wps:{seq:number,lat:number,lon:number}[],si:number,t:number,spd:number,δ:number){
  const n=wps.length, s=[...wps].sort((a,b)=>a.seq-b.seq);
  const w1=s[si%n],w2=s[(si+1)%n];
  const seg=hav(w1.lat,w1.lon,w2.lat,w2.lon);
  if(seg<1) return simStep(s,(si+1)%n,0,spd,δ);
  let nt=t+(spd/3.6*δ)/seg, ns=si;
  while(nt>=1){nt-=1;ns=(ns+1)%n;}
  const a=s[ns],b=s[(ns+1)%n];
  let lat=a.lat+nt*(b.lat-a.lat),lon=a.lon+nt*(b.lon-a.lon);
  [lat,lon]=noise(lat,lon,6);
  return {lat,lon,hdg:bearing(a.lat,a.lon,b.lat,b.lon),spd:spd+(Math.random()-.5)*4,ns,nt};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try {
    const [[{data:assets},{data:zones},{data:wps},{data:sims},{data:zstates}]] = await Promise.all([[
      sb.from("assets").select("*"),
      sb.from("zones").select("*"),
      sb.from("route_waypoints").select("*"),
      sb.from("simulator_state").select("*"),
      sb.from("asset_zone_states").select("*"),
    ]]);
    const writes:Promise<unknown>[]=[], newAlerts:object[]=[];
    for(const a of (assets||[])) {
      const aws=(wps||[]).filter(w=>w.asset_id===a.id);
      const sim=(sims||[]).find(s=>s.asset_id===a.id);
      if(!aws.length||!sim) continue;
      const r=simStep(aws,sim.step_idx,sim.t_progress,a.speed_kmh,1);
      writes.push(sb.from("assets").update({current_lat:+r.lat.toFixed(7),current_lon:+r.lon.toFixed(7),current_speed:+r.spd.toFixed(1),current_heading:+r.hdg.toFixed(1),updated_at:new Date().toISOString()}).eq("id",a.id));
      writes.push(sb.from("simulator_state").update({step_idx:r.ns,t_progress:r.nt,updated_at:new Date().toISOString()}).eq("asset_id",a.id));
      for(const z of (zones||[])) {
        const d=hav(r.lat,r.lon,z.center_lat,z.center_lon);
        const inZ=d<=z.radius_meters, ns=inZ?"IN":"OUT";
        const prev=(zstates||[]).find(s=>s.asset_id===a.id&&s.zone_id===z.id);
        const ps=prev?.state??"UNKNOWN";
        if(ps!=="UNKNOWN"&&ps!==ns) {
          const sev=z.zone_type==="HOSTILE"||z.zone_type==="MINEFIELD"?"CRITICAL":z.zone_type==="RESTRICTED"?"WARNING":"INFO";
          newAlerts.push({asset_id:a.id,asset_name:a.name,asset_icon:a.icon,zone_id:z.id,zone_name:z.name,event_type:inZ?"ENTERED":"EXITED",severity:sev,message:`${a.callsign} ${inZ?"entered":"exited"} ${z.name}`,lat:r.lat,lon:r.lon});
          writes.push(sb.from("assets").update({alert_count:(a.alert_count||0)+1,threat_level:inZ&&sev==="CRITICAL"?"RED":inZ&&sev==="WARNING"?"ORANGE":"GREEN"}).eq("id",a.id));
        }
        writes.push(sb.from("asset_zone_states").upsert({asset_id:a.id,zone_id:z.id,state:ns,updated_at:new Date().toISOString()},{onConflict:"asset_id,zone_id"}));
      }
    }
    await Promise.all([...writes,...(newAlerts.length?[sb.from("alerts").insert(newAlerts)]:[])]); 
    const [[{data:fa},{data:fz},{data:fia},{data:fzs}]]=await Promise.all([[
      sb.from("assets").select("*"),
      sb.from("zones").select("*"),
      sb.from("alerts").select("*").order("created_at",{ascending:false}).limit(80),
      sb.from("asset_zone_states").select("*"),
    ]]);
    const enriched=(fa||[]).map(a=>({...a,zoneStatus:(fzs||[]).filter(z=>z.asset_id===a.id).map(z=>{const zn=(fz||[]).find(f=>f.id===z.zone_id);return {zoneId:z.zone_id,zoneName:zn?.name??"",zoneType:zn?.zone_type??"",state:z.state};})}));
    return new Response(JSON.stringify({assets:enriched,zones:fz||[],alerts:fia||[]}),{headers:{...cors,"Content-Type":"application/json"}});
  } catch(e) { return new Response(JSON.stringify({error:String(e)}),{status:500,headers:cors}); }
});
