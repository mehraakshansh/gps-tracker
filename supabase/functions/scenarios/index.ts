import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const method = req.method;

    // DELETE /scenarios/:id
    if (method === "DELETE") {
      const url   = new URL(req.url);
      const parts = url.pathname.split("/").filter(Boolean);
      const id    = parts[parts.length - 1];
      if (!id || id === "scenarios") return json({ error: "Missing id" }, 400);
      const { error } = await supabase.from("scenarios").delete().eq("id", id);
      if (error) throw error;
      return json({ deleted: true });
    }

    // GET /scenarios — list (no snapshot payloads to keep response small)
    if (method === "GET") {
      const { data, error } = await supabase
        .from("scenarios")
        .select("id, name, description, scenario_type, difficulty, duration_min, created_by, created_at, asset_count, zone_count")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data ?? []);
    }

    // POST /scenarios — save | load
    if (method === "POST") {
      const body = await req.json().catch(() => ({}));

      // ── SAVE ────────────────────────────────────────────────────────────────
      if (body.action === "save") {
        const {
          name, description = "", scenario_type = "PATROL",
          difficulty = "MEDIUM", duration_min = 30, created_by = "",
          assets_snapshot = [], zones_snapshot = [],
        } = body;

        if (!name?.trim()) return json({ error: "name is required" }, 400);

        // Strip runtime-only fields before storing
        const cleanAssets = assets_snapshot.map((a: Record<string, unknown>) => {
          const { trail, zoneStatus, ...rest } = a;
          return rest;
        });

        const { data, error } = await supabase
          .from("scenarios")
          .insert({
            name: name.trim(),
            description,
            scenario_type,
            difficulty,
            duration_min: Number(duration_min) || 30,
            created_by,
            assets_snapshot: cleanAssets,
            zones_snapshot,
            asset_count:  cleanAssets.length,
            zone_count:   zones_snapshot.length,
          })
          .select()
          .single();

        if (error) throw error;
        return json(data);
      }

      // ── LOAD ────────────────────────────────────────────────────────────────
      if (body.action === "load") {
        const { scenario_id } = body;
        if (!scenario_id) return json({ error: "scenario_id is required" }, 400);

        const { data: scenario, error: fetchErr } = await supabase
          .from("scenarios")
          .select("*")
          .eq("id", scenario_id)
          .single();

        if (fetchErr || !scenario) throw new Error("Scenario not found");

        // 1. Clear existing assets + zones + simulator state + alerts
        await supabase.from("assets").delete().not("id", "is", null);
        await supabase.from("zones").delete().not("id", "is", null);
        await supabase.from("simulator_state").delete().not("asset_id", "is", null);
        await supabase.from("alerts").delete().not("id", "is", null);

        // 2. Insert assets from snapshot — reset live state, keep positions/identity
        const assetsToInsert = ((scenario.assets_snapshot ?? []) as Record<string, unknown>[]).map((a) => {
          const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = a;
          return {
            ...rest,
            status:       "ACTIVE",
            is_destroyed: false,
            hp:           rest.max_hp ?? rest.hp ?? 100,
            fuel_pct:     100,
            ammo_pct:     100,
          };
        });

        if (assetsToInsert.length > 0) {
          const { error: aErr } = await supabase.from("assets").insert(assetsToInsert);
          if (aErr) throw aErr;
        }

        // 3. Insert zones from snapshot
        const zonesToInsert = ((scenario.zones_snapshot ?? []) as Record<string, unknown>[]).map((z) => {
          const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = z;
          return rest;
        });

        if (zonesToInsert.length > 0) {
          const { error: zErr } = await supabase.from("zones").insert(zonesToInsert);
          if (zErr) throw zErr;
        }

        // 4. Reset match state
        await supabase.from("match_state").update({
          status:                  "ACTIVE",
          bravo_score:             0,
          alpha_score:             0,
          bravo_assets_destroyed:  0,
          alpha_assets_destroyed:  0,
          zones_controlled_bravo:  0,
          zones_controlled_alpha:  0,
        }).eq("id", 1);

        return json({ loaded: true, scenario_name: scenario.name, assets: assetsToInsert.length, zones: zonesToInsert.length });
      }

      return json({ error: "Unknown action" }, 400);
    }

    return json({ error: "Method not allowed" }, 405);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
