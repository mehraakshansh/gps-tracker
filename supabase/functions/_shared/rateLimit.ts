import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LIMIT_PER_MINUTE = 60;

/**
 * Extracts user from JWT, atomically increments their per-minute call counter,
 * and returns whether the request is over the limit.
 * Uses the service-role client to bypass RLS on rate_limits.
 */
export async function checkRateLimit(
  req: Request,
  sb: ReturnType<typeof createClient>,
): Promise<{ userId: string | null; limited: boolean }> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return { userId: null, limited: false };

  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return { userId: null, limited: false };

  const { data: count, error } = await sb.rpc("increment_rate_limit", { p_user_uid: user.id });
  if (error) {
    // If RPC fails (e.g. function not deployed yet), don't block the request
    console.warn("rate limit rpc error:", error.message);
    return { userId: user.id, limited: false };
  }

  return { userId: user.id, limited: (count ?? 0) > LIMIT_PER_MINUTE };
}

export function rateLimitedResponse(cors: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Max 60 requests/minute." }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60" } },
  );
}
