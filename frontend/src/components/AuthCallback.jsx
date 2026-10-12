import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { postSession } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Exchanges the session_id from the URL fragment for a session, then returns the user
// to the path they were on. REMINDER: DO NOT HARDCODE THE URL OR ADD FALLBACKS, THIS BREAKS AUTH.
export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || "";
    const sessionId = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
    const dest = location.pathname || "/";

    (async () => {
      if (!sessionId) { navigate(dest, { replace: true }); return; }
      try {
        const res = await postSession(sessionId);
        if (res.session_token) localStorage.setItem("petito_token", res.session_token);
        setUser(res.user);
      } catch {
        // fall through; AuthProvider will show login
      } finally {
        window.history.replaceState(null, "", dest);
        navigate(dest, { replace: true });
      }
    })();
  }, [location, navigate, setUser]);

  return (
    <div className="mobile-frame grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-primary">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm text-muted-foreground">Entrando a Petito...</p>
      </div>
    </div>
  );
}
