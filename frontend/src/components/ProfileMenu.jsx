import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Images, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function ProfileMenu() {
  const { user, logout, login } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const nav = useNavigate();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!user) {
    return (
      <button onClick={() => login("/")} data-testid="header-login-button"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-border text-xs font-display font-semibold text-neutral-700 active:scale-95 transition-transform shrink-0">
        <LogIn className="w-4 h-4 text-primary" /> Entrar
      </button>
    );
  }

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} data-testid="profile-menu-button"
        className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary/30 bg-primary/10 grid place-items-center active:scale-95 transition-transform">
        {user.picture
          ? <img src={user.picture} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          : <span className="font-display font-bold text-primary text-sm">{initial}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-border shadow-xl z-50 overflow-hidden" data-testid="profile-menu">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-display font-semibold text-neutral-900 truncate">{user.name || "Tu cuenta"}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
          <button onClick={() => { setOpen(false); nav("/mis-creaciones"); }} data-testid="menu-my-creations"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            <Images className="w-4 h-4 text-primary" /> Mis creaciones
          </button>
          <button onClick={() => { setOpen(false); logout(); nav("/"); }} data-testid="menu-logout"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-border">
            <LogOut className="w-4 h-4 text-primary" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
