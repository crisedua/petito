"use client";
import { PawPrint, LogIn, ArrowLeft } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// Friendly welcome screen with the "Entrar con Google" button.
export default function Login({ returnPath, subtitle }) {
  const { login } = useAuth();
  const nav = useNavigate();

  return (
    <div className="mobile-frame" data-testid="login-screen">
      <div className="px-5 pt-5">
        <button onClick={() => nav("/")} className="w-9 h-9 rounded-full bg-white border border-border grid place-items-center" data-testid="login-back">
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary grid place-items-center mb-5 shadow-lg shadow-primary/30">
          <PawPrint className="w-9 h-9 text-white" />
        </div>
        <h1 className="font-display font-bold text-3xl text-neutral-900 leading-tight">Bienvenido a Petito</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {subtitle || "Inicia sesión para crear y guardar las historias y retratos de tu regalón 🐾"}
        </p>
        <Button
          onClick={() => login(returnPath)}
          className="mt-8 w-full h-14 rounded-2xl text-base font-display font-semibold bg-white text-neutral-800 border border-border hover:bg-neutral-50 shadow-sm"
          data-testid="google-login-button"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5 mr-3" />
          Entrar con Google
        </Button>
        <p className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
          <LogIn className="w-3.5 h-3.5" /> Sesión segura · se mantiene varios días
        </p>
      </div>
    </div>
  );
}
