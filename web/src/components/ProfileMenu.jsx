"use client";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@/lib/router";
import { LogOut, Images, LogIn, Users, Smartphone, ShieldCheck, Camera, Crown } from "lucide-react";
import { openInstallSheet, useInstallOffer } from "@/components/app/InstallPrompt";
import { isMobile } from "@/lib/install";
import { useAuth } from "@/lib/auth";

export function ProfileMenu() {
  const { user, logout, login } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const nav = useNavigate();
  const installOffer = useInstallOffer();

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
          <button onClick={() => { setOpen(false); nav("/probar"); }} data-testid="menu-quick-studio"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            <Camera className="w-4 h-4 text-primary" /> Foto de estudio rápida
          </button>
          <button onClick={() => { setOpen(false); nav("/mis-creaciones"); }} data-testid="menu-my-creations"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-border">
            <Images className="w-4 h-4 text-primary" /> Mis creaciones
          </button>
          <button onClick={() => { setOpen(false); nav("/plus"); }} data-testid="menu-plans"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-border">
            <Crown className="w-4 h-4 text-primary" /> Planes y precios
          </button>
          <button onClick={() => { setOpen(false); nav("/amigos"); }} data-testid="menu-friends"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-border">
            <Users className="w-4 h-4 text-primary" /> Amigos de Petipo
          </button>
          {installOffer && (
            <button onClick={() => { setOpen(false); openInstallSheet(); }} data-testid="menu-install"
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-border">
              <Smartphone className="w-4 h-4 text-primary" /> {isMobile() ? "Agregar a mi teléfono" : "Instalar en este computador"}
            </button>
          )}
          {user.is_admin && (
            <button onClick={() => { setOpen(false); nav("/admin"); }} data-testid="menu-admin"
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-border">
              <ShieldCheck className="w-4 h-4 text-primary" /> Panel de administración
            </button>
          )}
          <button onClick={() => { setOpen(false); logout(); nav("/"); }} data-testid="menu-logout"
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 border-t border-border">
            <LogOut className="w-4 h-4 text-primary" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
