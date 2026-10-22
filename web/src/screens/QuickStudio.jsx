"use client";
import { HomeLink } from "@/components/HomeLink";
import { Logo } from "@/components/Logo";
import { PawPrint } from "lucide-react";
import TryPortrait from "@/components/TryPortrait";
import { ProfileMenu } from "@/components/ProfileMenu";

/** /probar: the one-minute studio photo, reachable from the menu once signed in (and by anyone with the link). */
export default function QuickStudio() {
  return (
    <div className="mobile-frame" style={{ background: "#FBF6EE" }} data-testid="quick-studio-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <HomeLink className="flex items-center gap-2 font-display font-semibold" style={{ color: "#B85C3C" }}><Logo /></HomeLink>
        <ProfileMenu />
      </div>
      <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto no-scrollbar">
        <h1 className="font-display font-bold text-2xl leading-tight" style={{ color: "#3A2A20" }}>Foto de estudio rápida</h1>
        <p className="mt-1 text-sm" style={{ color: "#7A6A5E" }}>Una foto, un minuto: fondo de color, luz de fotógrafo y su placa con nombre. Queda guardada en su colección.</p>
        <div className="mt-4">
          <TryPortrait title="Sube su foto" subtitle="" testid="quick-try" />
        </div>
      </div>
    </div>
  );
}
