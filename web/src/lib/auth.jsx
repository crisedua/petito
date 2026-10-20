"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { getMe, logoutApi } from "@/lib/api";
import { oncePerSession, track } from "@/lib/track";
import { supabaseBrowser } from "@/lib/supabase-browser";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
      if (u?.user_id && oncePerSession(`petito_login_${u.user_id}`)) track("login");
    } catch (e) {
      setUser(null);
      // 401 just means "not signed in"; anything else is a real problem worth showing.
      if (e?.response?.status && e.response.status !== 401) toast.error(e.response.data?.detail || "No pudimos cargar tu cuenta", { duration: 12000 });
      // Suspended accounts are signed out so they don't bounce back into a half-signed-in state.
      if (e?.response?.status === 403 && e.response.data?.suspended) {
        try { await logoutApi(); } catch { /* ignore */ }
        try { await supabaseBrowser().auth.signOut(); } catch { /* ignore */ }
      }
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
    // The return path rides in a cookie, not the redirect URL: Supabase only honors redirect URLs that match
    // its allow-list exactly, and a "?next=" query makes an exact "/auth/callback" entry miss.
    document.cookie = `petito_next=${encodeURIComponent(path)}; path=/; max-age=900; samesite=lax`;
    const redirectTo = `${window.location.origin}/auth/callback`;
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
