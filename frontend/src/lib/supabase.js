import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  ?? "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Base URL for Edge Functions
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
