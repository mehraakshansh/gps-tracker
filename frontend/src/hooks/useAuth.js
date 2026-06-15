import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

async function recordSessionStart(userId, email) {
  try {
    const { data } = await supabase.from("user_sessions").insert({
      user_uid:   userId,
      user_email: email ?? null,
      login_at:   new Date().toISOString(),
      user_agent: navigator.userAgent.slice(0, 500),
      is_active:  true,
    }).select("id").single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

async function recordSessionEnd(sessionRowId) {
  if (!sessionRowId) return;
  try {
    await supabase.from("user_sessions")
      .update({ logout_at: new Date().toISOString(), is_active: false })
      .eq("id", sessionRowId);
  } catch { /* non-critical */ }
}

export function useAuth() {
  const [session,  setSession]  = useState(null);
  const [user,     setUser]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [authError, setAuthError] = useState(null);
  const sessionRowId = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess) setAuthError(null);

      if (event === "SIGNED_IN" && sess?.user && !sessionRowId.current) {
        recordSessionStart(sess.user.id, sess.user.email).then(id => { sessionRowId.current = id; });
      }
      if (event === "SIGNED_OUT") {
        recordSessionEnd(sessionRowId.current);
        sessionRowId.current = null;
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithOAuth = useCallback(async (provider) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  }, []);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setAuthError(error.message); return false; }
    setSession(data.session);
    setUser(data.user);
    return true;
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) { setAuthError(error.message); return false; }
    if (data.session) { setSession(data.session); setUser(data.user); }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  return { session, user, loading, authError, signIn, signUp, signOut, signInWithOAuth };
}
