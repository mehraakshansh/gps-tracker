// ============================================================
// Supabase Edge Function: /assets
// GET → list all assets with fence status
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const [{ data: assets }, { data: fences }, { data: zones }] = await Promise.all([
    supabase.from("assets").select("*").order("name"),
    supabase.from("fences").select("*"),
    supabase.from("asset_zone_states").select("*"),
  ]);

  const result = (assets || []).map(a => ({
    ...a,
    fenceStatus: (zones || [])
      .filter(z => z.asset_id === a.id)
      .map(z => {
        const f = (fences || []).find(fn => fn.id === z.fence_id);
        return { fenceId: z.fence_id, fenceName: f?.name ?? "", state: z.state };
      }),
  }));

  return new Response(JSON.stringify(result), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
