"use client";
import { UserPlus } from "lucide-react";
import { shareLink } from "@/lib/share";

export const InviteButton = ({ className = "" }) => {
  const invite = () => shareLink({ text: "🐾 Crea la historia de tu mascota con humor chileno en Petipop", url: window.location.origin + "/" });

  return (
    <button
      onClick={invite}
      data-testid="invite-friends-button"
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-white text-xs font-display font-semibold shadow-sm active:scale-95 transition-transform shrink-0 ${className}`}
      aria-label="Invitar amigos a Petipop"
    >
      <UserPlus className="w-4 h-4" />
      <span className="whitespace-nowrap">Invitar amigos</span>
    </button>
  );
};
