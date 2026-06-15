import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session,  setSession]  = useState(null);
  const [user,     setUser]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess) setAuthError(null);
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
