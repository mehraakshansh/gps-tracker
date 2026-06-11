import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
export const FN  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
export const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const H   = { "Content-Type":"application/json", "Authorization":`Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` };
