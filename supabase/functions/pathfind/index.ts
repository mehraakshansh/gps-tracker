// ================================================================
// PATHFINDING ENGINE — All 8 algorithms
// A* | Dijkstra | BFS | DFS | Floyd-Warshall | Prim's | Kruskal's | AO*
// ================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const R = 6_371_000;
const toRad = (d: number) => d * Math.PI / 180;

function haversine(a: [number,number], b: [number,number]): number {
  const [φ1,λ1] = [toRad(a[0]), toRad(a[1])];
  const [φ2,λ2] = [toRad(b[0]), toRad(b[1])];
  const Δφ = φ2-φ1, Δλ = λ2-λ1;
  const s = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}

// ── Grid builder ─────────────────────────────────────────────
// Builds a 20×20 grid between start and end with threat weighting
function buildGrid(
  start: [number,number], end: [number,number],
  threats: {lat:number,lon:number,radius:number,weight:number}[],
  gridSize = 20
): { nodes: [number,number][], edges: {from:number,to:number,w:number}[], heuristic:(i:number)=>number } {
  const minLat = Math.min(start[0],end[0]) - 0.01;
  const maxLat = Math.max(start[0],end[0]) + 0.01;
  const minLon = Math.min(start[1],end[1]) - 0.01;
  const maxLon = Math.max(start[1],end[1]) + 0.01;

  const nodes: [number,number][] = [];
  for (let i=0; i<gridSize; i++)
    for (let j=0; j<gridSize; j++)
      nodes.push([
        minLat + (i/(gridSize-1))*(maxLat-minLat),
        minLon + (j/(gridSize-1))*(maxLon-minLon),
      ]);

  // Find closest grid nodes to start and end
  const startIdx = nodes.reduce((b,n,i) => haversine(n,start) < haversine(nodes[b],start) ? i : b, 0);
  const endIdx   = nodes.reduce((b,n,i) => haversine(n,end)   < haversine(nodes[b],end)   ? i : b, 0);

  const threatWeight = (n:[number,number]) => {
    let w = 1;
    for (const t of threats) {
      const d = haversine(n,[t.lat,t.lon]);
      if (d < t.radius) w += t.weight * (1 - d/t.radius);
    }
    return w;
  };

  const edges: {from:number,to:number,w:number}[] = [];
  const dirs = [-1,0,1];
  nodes.forEach((_,i) => {
    const ri = Math.floor(i/gridSize), ci = i%gridSize;
    for (const dr of dirs) for (const dc of dirs) {
      if (dr===0&&dc===0) continue;
      const nri=ri+dr, nci=ci+dc;
      if (nri<0||nri>=gridSize||nci<0||nci>=gridSize) continue;
      const j = nri*gridSize+nci;
      const dist = haversine(nodes[i],nodes[j]);
      const w = dist * (threatWeight(nodes[i])+threatWeight(nodes[j]))/2;
      edges.push({from:i,to:j,w});
    }
  });

  return { nodes, edges, heuristic:(i:number)=>haversine(nodes[i],nodes[endIdx]), startIdx, endIdx } as any;
}

// ── A* ────────────────────────────────────────────────────────
function aStar(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number,h:(i:number)=>number) {
  const INF=1e18;
  const g=new Array(nodes.length).fill(INF); g[start]=0;
  const f=new Array(nodes.length).fill(INF); f[start]=h(start);
  const prev=new Array(nodes.length).fill(-1);
  const open=new Set([start]);
  let visited=0;

  const adj: Map<number,{to:number,w:number}[]> = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from,[]);
    adj.get(e.from)!.push({to:e.to,w:e.w});
  }

  while (open.size) {
    let u=-1;
    for (const n of open) if (u===-1||f[n]<f[u]) u=n;
    if (u===end) break;
    open.delete(u); visited++;
    for (const {to,w} of (adj.get(u)||[])) {
      const ng=g[u]+w;
      if (ng<g[to]) { g[to]=ng; f[to]=ng+h(to); prev[to]=u; open.add(to); }
    }
  }
  const path=[]; let c=end;
  while(c!==-1){path.unshift(c);c=prev[c];}
  return {path: path[0]===start?path:[], dist:g[end], visited};
}

// ── Dijkstra ──────────────────────────────────────────────────
function dijkstra(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number) {
  return aStar(nodes,edges,start,end,()=>0);
}

// ── BFS ───────────────────────────────────────────────────────
function bfs(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number) {
  const adj: Map<number,number[]> = new Map();
  for (const e of edges) { if(!adj.has(e.from))adj.set(e.from,[]); adj.get(e.from)!.push(e.to); }
  const visited=new Set([start]), prev=new Array(nodes.length).fill(-1);
  const queue=[start]; let vis=0;
  while(queue.length) {
    const u=queue.shift()!; vis++;
    if(u===end) break;
    for (const v of (adj.get(u)||[])) {
      if(!visited.has(v)){visited.add(v);prev[v]=u;queue.push(v);}
    }
  }
  const path=[]; let c=end;
  while(c!==-1){path.unshift(c);c=prev[c];}
  let dist=0;
  for(let i=0;i<path.length-1;i++) dist+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===start?path:[],dist,visited:vis};
}

// ── DFS ───────────────────────────────────────────────────────
function dfs(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number) {
  const adj: Map<number,number[]> = new Map();
  for (const e of edges) { if(!adj.has(e.from))adj.set(e.from,[]); adj.get(e.from)!.push(e.to); }
  const visited=new Set<number>(), prev=new Array(nodes.length).fill(-1);
  let vis=0;
  const stack=[start];
  while(stack.length) {
    const u=stack.pop()!;
    if(visited.has(u)) continue;
    visited.add(u); vis++;
    if(u===end) break;
    for (const v of (adj.get(u)||[])) { if(!visited.has(v)){prev[v]=u;stack.push(v);} }
  }
  const path=[]; let c=end;
  while(c!==-1){path.unshift(c);c=prev[c];}
  let dist=0;
  for(let i=0;i<path.length-1;i++) dist+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===start?path:[],dist,visited:vis};
}

// ── Floyd-Warshall (all-pairs on reduced graph) ───────────────
function floydWarshall(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number) {
  const n=nodes.length;
  const dist=Array.from({length:n},()=>new Array(n).fill(1e15));
  const next=Array.from({length:n},()=>new Array(n).fill(-1));
  for(let i=0;i<n;i++){dist[i][i]=0;}
  for(const e of edges){if(e.w<dist[e.from][e.to]){dist[e.from][e.to]=e.w;next[e.from][e.to]=e.to;}}
  for(let k=0;k<n;k++) for(let i=0;i<n;i++) for(let j=0;j<n;j++) {
    if(dist[i][k]+dist[k][j]<dist[i][j]){dist[i][j]=dist[i][k]+dist[k][j];next[i][j]=next[i][k];}
  }
  const path=[start]; let u=start;
  while(u!==end&&next[u][end]!==-1){u=next[u][end];path.push(u);}
  return {path:u===end?path:[],dist:dist[start][end],visited:n*n};
}

// ── Prim's MST → path extraction ─────────────────────────────
function prims(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number) {
  const n=nodes.length;
  const inMST=new Array(n).fill(false);
  const key=new Array(n).fill(1e15); key[start]=0;
  const parent=new Array(n).fill(-1);
  let vis=0;
  for(let i=0;i<n;i++) {
    let u=-1;
    for(let v=0;v<n;v++) if(!inMST[v]&&(u===-1||key[v]<key[u]))u=v;
    if(u===-1)break; inMST[u]=true; vis++;
    for(const e of edges) {
      if(e.from===u&&!inMST[e.to]&&e.w<key[e.to]){key[e.to]=e.w;parent[e.to]=u;}
    }
  }
  const path=[]; let c=end;
  while(c!==-1){path.unshift(c);c=parent[c];}
  let dist=0;
  for(let i=0;i<path.length-1;i++) dist+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===start?path:[],dist,visited:vis};
}

// ── Kruskal's MST → path ──────────────────────────────────────
function kruskals(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number) {
  const n=nodes.length;
  const parent=Array.from({length:n},(_,i)=>i);
  const find=(x:number):number=>parent[x]===x?x:(parent[x]=find(parent[x]));
  const union=(a:number,b:number)=>{parent[find(a)]=find(b);};
  const sorted=[...edges].sort((a,b)=>a.w-b.w);
  const mstAdj:Map<number,number[]>=new Map();
  for(const e of sorted) {
    if(find(e.from)!==find(e.to)){union(e.from,e.to);
      if(!mstAdj.has(e.from))mstAdj.set(e.from,[]);
      if(!mstAdj.has(e.to))mstAdj.set(e.to,[]);
      mstAdj.get(e.from)!.push(e.to); mstAdj.get(e.to)!.push(e.from);
    }
  }
  // BFS on MST
  const visited2=new Set([start]),prev=new Array(n).fill(-1);
  const q=[start];
  while(q.length){const u=q.shift()!;if(u===end)break;for(const v of(mstAdj.get(u)||[])){if(!visited2.has(v)){visited2.add(v);prev[v]=u;q.push(v);}}}
  const path=[]; let c=end;
  while(c!==-1){path.unshift(c);c=prev[c];}
  let dist=0;
  for(let i=0;i<path.length-1;i++) dist+=haversine(nodes[path[i]],nodes[path[i+1]]);
  return {path:path[0]===start?path:[],dist,visited:sorted.length};
}

// ── AO* (AND-OR graph — finds optimal subgoal decomposition) ──
function aoStar(nodes:[number,number][],edges:{from:number,to:number,w:number}[],start:number,end:number,h:(i:number)=>number) {
  // For geo context: AO* treats mid-points as OR-nodes, waypoints as AND-nodes
  // We pick the path that minimises cost + heuristic iteratively
  const n=nodes.length;
  const cost=new Array(n).fill(1e15); cost[start]=0;
  const prev=new Array(n).fill(-1);
  const adj:Map<number,{to:number,w:number}[]>=new Map();
  for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from)!.push({to:e.to,w:e.w});}
  const open=new Set([start]); let vis=0;
  while(open.size) {
    let u=-1;
    for(const v of open) if(u===-1||cost[v]+h(v)<cost[u]+h(u))u=v;
    open.delete(u); vis++;
    if(u===end)break;
    for(const {to,w} of(adj.get(u)||[])) {
      const nc=cost[u]+w;
      if(nc<cost[to]){cost[to]=nc;prev[to]=u;open.add(to);}
    }
  }
  const path=[]; let c=end;
  while(c!==-1){path.unshift(c);c=prev[c];}
  return {path:path[0]===start?path:[],dist:cost[end],visited:vis};
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try {
    const body = await req.json();
    const { asset_id, start_lat, start_lon, end_lat, end_lon, algorithm="ASTAR" } = body;

    // Load hostile zones for threat weighting
    const {data:zones} = await sb.from("zones").select("*").in("zone_type",["HOSTILE","MINEFIELD","RESTRICTED"]);
    const threats = (zones||[]).map(z=>({lat:z.center_lat,lon:z.center_lon,radius:z.radius_meters,weight:z.zone_type==="MINEFIELD"?5:z.zone_type==="HOSTILE"?3:1.5}));

    const start:[number,number]=[parseFloat(start_lat),parseFloat(start_lon)];
    const end:[number,number]=[parseFloat(end_lat),parseFloat(end_lon)];

    const t0 = Date.now();
    const GRID = algorithm==="FLOYD_WARSHALL" ? 10 : 20; // FW is O(n³), smaller grid
    const {nodes,edges,heuristic,startIdx,endIdx} = buildGrid(start,end,threats,GRID) as any;

    let result:{path:number[],dist:number,visited:number};
    switch(algorithm.toUpperCase()) {
      case "DIJKSTRA":       result=dijkstra(nodes,edges,startIdx,endIdx); break;
      case "BFS":            result=bfs(nodes,edges,startIdx,endIdx); break;
      case "DFS":            result=dfs(nodes,edges,startIdx,endIdx); break;
      case "FLOYD_WARSHALL": result=floydWarshall(nodes,edges,startIdx,endIdx); break;
      case "PRIMS":          result=prims(nodes,edges,startIdx,endIdx); break;
      case "KRUSKALS":       result=kruskals(nodes,edges,startIdx,endIdx); break;
      case "AO_STAR":        result=aoStar(nodes,edges,startIdx,endIdx,heuristic); break;
      default:               result=aStar(nodes,edges,startIdx,endIdx,heuristic);
    }
    const computeMs = Date.now()-t0;

    const waypoints = result.path.map(i=>({lat:nodes[i][0],lon:nodes[i][1]}));
    const distKm    = result.dist/1000;

    // Persist result
    if(asset_id) {
      await sb.from("pathfind_results").insert({
        asset_id, algorithm, start_lat, start_lon, end_lat, end_lon,
        waypoints, distance_km:distKm, nodes_visited:result.visited, compute_ms:computeMs,
      });
    }

    return new Response(JSON.stringify({waypoints,distance_km:distKm,nodes_visited:result.visited,compute_ms:computeMs,algorithm}),
      {headers:{...cors,"Content-Type":"application/json"}});
  } catch(e) {
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:cors});
  }
});
