"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMe, logoutApi } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* ignore */ }
    try { await supabaseBrowser().auth.signOut(); } catch { /* ignore */ }
    try { localStorage.removeItem("petito_token"); } catch { /* ignore */ }
    setUser(null);
  }, []);

  // Google sign-in through Supabase Auth; the callback route links the account and returns here.
  const login = useCallback(async (returnPath) => {
    const path = returnPath || window.location.pathname;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;
    await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, checkAuth, logout, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
