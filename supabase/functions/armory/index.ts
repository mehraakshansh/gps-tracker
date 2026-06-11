import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SERVICE_ROLE_KEY")!);
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,DELETE,PUT,OPTIONS"};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  const url=new URL(req.url), id=url.searchParams.get("id");
  if(req.method==="DELETE"&&id){
    await sb.from("armory").delete().eq("id",id);
    return new Response(JSON.stringify({ok:true}),{headers:{...cors,"Content-Type":"application/json"}});
  }
  if(req.method==="POST"){
    const body=await req.json();
    const {data,error}=await sb.from("armory").insert(body).select().single();
    if(error) return new Response(JSON.stringify({error}),{status:500,headers:cors});
    return new Response(JSON.stringify(data),{status:201,headers:{...cors,"Content-Type":"application/json"}});
  }
  if(req.method==="PUT"&&id){
    const body=await req.json();
    const {data}=await sb.from("armory").update(body).eq("id",id).select().single();
    return new Response(JSON.stringify(data),{headers:{...cors,"Content-Type":"application/json"}});
  }
  const {data}=await sb.from("armory").select("*").order("created_at",{ascending:false});
  return new Response(JSON.stringify(data||[]),{headers:{...cors,"Content-Type":"application/json"}});
});
