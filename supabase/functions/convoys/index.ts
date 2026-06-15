import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function verifyAndLog(req: Request, supabase: ReturnType<typeof createClient>, action: string, resourceId?: string) {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return null;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Audit log
    await supabase.from("audit_logs").insert({
      user_uid: user.id,
      user_email: user.email,
      action,
      resource: "convoys",
      resource_id: resourceId ?? null,
      details: {},
    }).catch(() => {});

    return user;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const url  = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const convoyId = parts[parts.length - 1] !== "convoys" ? parts[parts.length - 1] : null;

    // ── GET — list all convoys ────────────────────────────────────────────────
    if (req.method === "GET") {
      await verifyAndLog(req, supabase, "LIST_CONVOYS");
      const { data, error } = await supabase
        .from("convoys")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json(data ?? []);
    }

    // ── POST — create convoy ──────────────────────────────────────────────────
    if (req.method === "POST") {
      const user = await verifyAndLog(req, supabase, "CREATE_CONVOY");
      const body = await req.json().catch(() => ({}));

      const { name, description, route_waypoints, asset_ids, scheduled_at,
              repeat_type, priority, commander, notes } = body;

      if (!name || typeof name !== "string") return json({ error: "name required" }, 400);
      if (!Array.isArray(route_waypoints) || route_waypoints.length < 2)
        return json({ error: "At least 2 waypoints required" }, 400);

      const convoy = {
        name: String(name).slice(0, 100),
        description: description ? String(description).slice(0, 500) : null,
        status: "PLANNED",
        route_waypoints: route_waypoints,
        asset_ids: Array.isArray(asset_ids) ? asset_ids : [],
        scheduled_at: scheduled_at ?? null,
        repeat_type: ["NONE","DAILY","WEEKLY"].includes(repeat_type) ? repeat_type : "NONE",
        priority: ["LOW","NORMAL","HIGH","CRITICAL"].includes(priority) ? priority : "NORMAL",
        commander: commander ? String(commander).slice(0, 100) : null,
        notes: notes ? String(notes).slice(0, 1000) : null,
        created_by_uid: user?.id ?? null,
        created_by_email: user?.email ?? null,
      };

      const { data, error } = await supabase.from("convoys").insert(convoy).select().single();
      if (error) throw error;
      return json(data, 201);
    }

    // ── PUT — update convoy (status, notes) ───────────────────────────────────
    if (req.method === "PUT" && convoyId) {
      await verifyAndLog(req, supabase, "UPDATE_CONVOY", convoyId);
      const body = await req.json().catch(() => ({}));

      // Sanitize update fields
      const allowed = ["status","notes","commander","scheduled_at","route_waypoints","asset_ids","priority"];
      const update: Record<string, unknown> = {};
      for (const k of allowed) {
        if (k in body) update[k] = body[k];
      }
      if (!Object.keys(update).length) return json({ error: "No valid fields to update" }, 400);

      // Auto-set timestamps based on status
      if (update.status === "EN_ROUTE")   update.started_at   = new Date().toISOString();
      if (update.status === "COMPLETED" ||
          update.status === "COMPROMISED") update.completed_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("convoys").update(update).eq("id", convoyId).select().single();
      if (error) throw error;
      return json(data);
    }

    // ── DELETE — remove convoy ────────────────────────────────────────────────
    if (req.method === "DELETE" && convoyId) {
      await verifyAndLog(req, supabase, "DELETE_CONVOY", convoyId);
      const { error } = await supabase.from("convoys").delete().eq("id", convoyId);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: "not found" }, 404);
  } catch (err) {
    console.error("convoys fn error:", err);
    return json({ error: String(err) }, 500);
  }
});
