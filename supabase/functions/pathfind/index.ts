// ================================================================
// PATHFINDING ENGINE v3 — 8 Algorithms on threat-weighted grid
// A* | Dijkstra | BFS | DFS | Floyd-Warshall | Prim's | Kruskal | AO*
// Grid: 25×25 nodes, Haversine edge weights, zone threat penalties
// ================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb   = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R   = 6_371_000;
const toR = (d:number) => d*Math.PI/180;

function haversine(a:[number,number], b:[number,number]): number {
  const [φ1,λ1]=[toR(a[0]),toR(a[1])], [φ2,λ2]=[toR(b[0]),toR(b[1])];
  const Δφ=φ2-φ1, Δλ=λ2-λ1;
  const s=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}

// ── Grid with threat-weighted edges ──────────────────────────
function buildGrid(
  start:[number,number], end:[number,number],
  threats:{lat:number,lon:number,radius:number,weight:number}[],
  G=25
) {
  const pad=0.015;
  const minLat=Math.min(start[0],end[0])-pad, maxLat=Math.max(start[0],end[0])+pad;
  const minLon=Math.min(start[1],end[1])-pad, maxLon=Math.max(start[1],end[1])+pad;

  const nodes:[number,number][] = [];
  for (let i=0;i<G;i++) for (let j=0;j<G;j++)
    nodes.push([minLat+(i/(G-1))*(maxLat-minLat), minLon+(j/(G-1))*(maxLon-minLon)]);

  const closest=(p:[number,number])=>nodes.reduce((b,n,i)=>haversine(n,p)<haversine(nodes[b],p)?i:b,0);
  const startIdx=closest(start), endIdx=closest(end);

  const threatAt=(n:[number,number])=>{
    let w=1;
    for (const t of threats) {
      const d=haversine(n,[t.lat,t.lon]);
      if (d<t.radius) w+=t.weight*(1-d/t.radius);
    }
    return w;
  };

  const adj:Map<number,{to:number,w:number}[]>=new Map();
  const edges:{from:number,to:number,w:number}[]=[];
  nodes.forEach((_,i)=>{
    const ri=Math.floor(i/G), ci=i%G;
    for (const dr of [-1,0,1]) for (const dc of [-1,0,1]) {
      if (!dr&&!dc) continue;
      const nri=ri+dr, nci=ci+dc;
      if (nri<0||nri>=G||nci<0||nci>=G) continue;
      const j=nri*G+nci;
      const dist=haversine(nodes[i],nodes[j]);
      const w=dist*(threatAt(nodes[i])+threatAt(nodes[j]))/2;
      edges.push({from:i,to:j,w});
      if (!adj.has(i)) adj.set(i,[]);
      adj.get(i)!.push({to:j,w});
    }
  });
  return {nodes,edges,adj,startIdx,endIdx,heuristic:(i:number)=>haversine(nodes[i],nodes[endIdx])};
}

type PathResult = {path:number[],dist:number,visited:number};

// ── A* ────────────────────────────────────────────────────────
function aStar(nodes:[number,number][],adj:Map<number,{to:number,w:number}[]>,s:number,e:number,h:(i:number)=>number):PathResult{
  const g=new Float64Array(nodes.length).fill(1e18); g[s]=0;
  const f=new Float64Array(nodes.length).fill(1e18); f[s]=h(s);
  const prev=new Int32Array(nodes.length).fill(-1);
  const open=new Set([s]); let vis=0;
  while(open.size){
    let u=-1; for(const n of open) if(u===-1||f[n]<f[u])u=n;
    if(u===e) break; open.delete(u); vis++;
    for(const {to,w} of (adj.get(u)||[])){
      const ng=g[u]+w;
      if(ng<g[to]){g[to]=ng;f[to]=ng+h(to);prev[to]=u;open.add(to);}
    }
  }
  const path:number[]=[]; let c=e;
  while(c!==-1){path.unshift(c);c=prev[c];}
  return {path:path[0]===s?path:[],dist:g[e],visited:vis};
}

// ── Dijkstra (A* with zero heuristic) ────────────────────────
function dijkstra(nodes:[number,number][],adj:Map<number,{to:number,w:number}[]>,s:number,e:number):PathResult{
  return aStar(nodes,adj,s,e,()=>0);
}

// ── BFS (unweighted) ─────────────────────────────────────────
function bfs(nodes:[number,number][],adj:Map<number,{to:number,w:number}[]>,s:number,e:number):PathResult{
  const vis=new Set([s]),prev=new Int32Array(nodes.length).fill(-1);
  const q=[s]; let vc=0;
  outer: while(q.length){
    const u=q.shift()!; vc++;
    if(u===e) break;
    for(const {to} of (adj.get(u)||[])) if(!vis.has(to)){vis.add(to);prev[to]=u;q.push(to);if(to===e) break outer;}
  }
  const path:number[]=[]; let c=e;
  while(c!==-1){path.unshift(c);c=prev[c];}
  let d=0; for(let i=0;i<path.length-1;i++) d+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===s?path:[],dist:d,visited:vc};
}

// ── DFS ───────────────────────────────────────────────────────
function dfs(nodes:[number,number][],adj:Map<number,{to:number,w:number}[]>,s:number,e:number):PathResult{
  const vis=new Set<number>(),prev=new Int32Array(nodes.length).fill(-1);
  const stk=[s]; let vc=0;
  while(stk.length){
    const u=stk.pop()!;
    if(vis.has(u)) continue; vis.add(u); vc++;
    if(u===e) break;
    for(const {to} of (adj.get(u)||[])) if(!vis.has(to)){prev[to]=u;stk.push(to);}
  }
  const path:number[]=[]; let c=e;
  while(c!==-1){path.unshift(c);c=prev[c];}
  let d=0; for(let i=0;i<path.length-1;i++) d+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===s?path:[],dist:d,visited:vc};
}

// ── Floyd-Warshall (reduced 12×12 grid due to O(n³)) ─────────
function floydWarshall(nodes:[number,number][],edges:{from:number,to:number,w:number}[],s:number,e:number):PathResult{
  const n=nodes.length;
  const dist=Array.from({length:n},(_,i)=>Float64Array.from({length:n},(_,j)=>i===j?0:1e15));
  const nxt=Array.from({length:n},()=>new Int32Array(n).fill(-1));
  for(const {from,to,w} of edges) if(w<dist[from][to]){dist[from][to]=w;nxt[from][to]=to;}
  for(let k=0;k<n;k++) for(let i=0;i<n;i++) for(let j=0;j<n;j++){
    const nd=dist[i][k]+dist[k][j];
    if(nd<dist[i][j]){dist[i][j]=nd;nxt[i][j]=nxt[i][k];}
  }
  const path:number[]=[s]; let u=s;
  while(u!==e&&nxt[u][e]!==-1){u=nxt[u][e];path.push(u);}
  return {path:u===e?path:[],dist:dist[s][e],visited:n*n};
}

// ── Prim's MST → path ─────────────────────────────────────────
function prims(nodes:[number,number][],adj:Map<number,{to:number,w:number}[]>,s:number,e:number):PathResult{
  const n=nodes.length,inMST=new Uint8Array(n),key=new Float64Array(n).fill(1e15),par=new Int32Array(n).fill(-1);
  key[s]=0; let vc=0;
  for(let i=0;i<n;i++){
    let u=-1; for(let v=0;v<n;v++) if(!inMST[v]&&(u===-1||key[v]<key[u]))u=v;
    if(u===-1) break; inMST[u]=1; vc++;
    for(const {to,w} of (adj.get(u)||[])) if(!inMST[to]&&w<key[to]){key[to]=w;par[to]=u;}
  }
  const path:number[]=[]; let c=e;
  while(c!==-1){path.unshift(c);c=par[c];}
  let d=0; for(let i=0;i<path.length-1;i++) d+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===s?path:[],dist:d,visited:vc};
}

// ── Kruskal's MST → BFS path ─────────────────────────────────
function kruskals(nodes:[number,number][],edges:{from:number,to:number,w:number}[],s:number,e:number):PathResult{
  const n=nodes.length,par=Array.from({length:n},(_,i)=>i);
  const find=(x:number):number=>par[x]===x?x:(par[x]=find(par[x]));
  const union=(a:number,b:number)=>{par[find(a)]=find(b);};
  const mAdj:Map<number,number[]>=new Map();
  for(const {from,to,w} of [...edges].sort((a,b)=>a.w-b.w)){
    if(find(from)!==find(to)){
      union(from,to);
      if(!mAdj.has(from)) mAdj.set(from,[]);
      if(!mAdj.has(to))   mAdj.set(to,[]);
      mAdj.get(from)!.push(to); mAdj.get(to)!.push(from);
    }
  }
  const vis=new Set([s]),prev=new Int32Array(n).fill(-1);
  const q=[s];
  while(q.length){const u=q.shift()!;if(u===e)break;for(const v of(mAdj.get(u)||[])) if(!vis.has(v)){vis.add(v);prev[v]=u;q.push(v);}}
  const path:number[]=[]; let c=e;
  while(c!==-1){path.unshift(c);c=prev[c];}
  let d=0; for(let i=0;i<path.length-1;i++) d+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===s?path:[],dist:d,visited:edges.length};
}

// ── AO* (AND-OR heuristic search) ────────────────────────────
function aoStar(nodes:[number,number][],adj:Map<number,{to:number,w:number}[]>,s:number,e:number,h:(i:number)=>number):PathResult{
  const cost=new Float64Array(nodes.length).fill(1e18); cost[s]=0;
  const prev=new Int32Array(nodes.length).fill(-1);
  const open=new Set([s]); let vis=0;
  while(open.size){
    let u=-1; for(const v of open) if(u===-1||cost[v]+h(v)<cost[u]+h(u))u=v;
    open.delete(u); vis++;
    if(u===e) break;
    for(const {to,w} of (adj.get(u)||[])){
      const nc=cost[u]+w;
      if(nc<cost[to]){cost[to]=nc;prev[to]=u;open.add(to);}
    }
  }
  const path:number[]=[]; let c=e;
  while(c!==-1){path.unshift(c);c=prev[c];}
  return {path:path[0]===s?path:[],dist:cost[e],visited:vis};
}

// ── Main handler ──────────────────────────────────────────────
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    const {asset_id,start_lat,start_lon,end_lat,end_lon,algorithm="ASTAR"}=await req.json();

    const {data:zones}=await sb.from("zones").select("*").in("zone_type",["HOSTILE","MINEFIELD","RESTRICTED","NO_FLY"]);
    const threats=(zones||[]).map(z=>({
      lat:z.center_lat,lon:z.center_lon,radius:z.radius_meters,
      weight:z.zone_type==="MINEFIELD"?6:z.zone_type==="HOSTILE"?4:2,
    }));

    const start:[number,number]=[+start_lat,+start_lon];
    const end:[number,number]  =[+end_lat,  +end_lon  ];
    const algo=algorithm.toUpperCase();

    // Floyd-Warshall uses smaller grid (O(n³) complexity)
    const G=algo==="FLOYD_WARSHALL"?12:25;
    const t0=Date.now();
    const {nodes,edges,adj,startIdx,endIdx,heuristic}=buildGrid(start,end,threats,G);

    let result:PathResult;
    switch(algo){
      case "DIJKSTRA":       result=dijkstra(nodes,adj,startIdx,endIdx);                   break;
      case "BFS":            result=bfs(nodes,adj,startIdx,endIdx);                        break;
      case "DFS":            result=dfs(nodes,adj,startIdx,endIdx);                        break;
      case "FLOYD_WARSHALL": result=floydWarshall(nodes,edges,startIdx,endIdx);            break;
      case "PRIMS":          result=prims(nodes,adj,startIdx,endIdx);                      break;
      case "KRUSKALS":       result=kruskals(nodes,edges,startIdx,endIdx);                 break;
      case "AO_STAR":        result=aoStar(nodes,adj,startIdx,endIdx,heuristic);           break;
      default:               result=aStar(nodes,adj,startIdx,endIdx,heuristic);
    }
    const computeMs=Date.now()-t0;

    const waypoints=result.path.map(i=>({lat:nodes[i][0],lon:nodes[i][1]}));
    const distKm=result.dist/1000;

    if(asset_id){
      await sb.from("pathfind_results").insert({
        asset_id,algorithm:algo,start_lat,start_lon,end_lat,end_lon,
        waypoints,distance_km:distKm,nodes_visited:result.visited,compute_ms:computeMs,
      });
    }
    return new Response(JSON.stringify({waypoints,distance_km:distKm,nodes_visited:result.visited,compute_ms:computeMs,algorithm:algo,grid_size:G}),
      {headers:{...cors,"Content-Type":"application/json"}});
  }catch(e){
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:cors});
  }
});
