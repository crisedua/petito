"use client";
import { useNavigate } from "@/lib/router";
import { useAuth } from "@/lib/auth";

/** The Petipo logo as a way home: signed-in people go to their pet's universe, everyone else to the landing. */
export function HomeLink({ className = "", style, children }) {
  const nav = useNavigate();
  const { user } = useAuth();
  return (
    <button type="button" onClick={() => nav(user ? "/universo" : "/")} className={`${className} text-left active:opacity-70`} style={style}
      aria-label="Ir al inicio de Petipo" data-testid="home-link">
      {children}
    </button>
  );
}
