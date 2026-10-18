"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
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
    } catch (e) {
      setUser(null);
      // 401 just means "not signed in"; anything else is a real problem worth showing.
      if (e?.response?.status && e.response.status !== 401) toast.error(e.response.data?.detail || "No pudimos cargar tu cuenta");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      toast.error(`No pudimos iniciar sesión: ${authError}`, { duration: 12000 });
      params.delete("auth_error");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    }
    checkAuth();
  }, [checkAuth]);

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
