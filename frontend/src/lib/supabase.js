// ── Supabase client ──────────────────────────────────────────
// Values injected at build-time via Vite env vars.
// Create a .env.local file (not committed) with:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Base URL for Edge Functions
export const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
