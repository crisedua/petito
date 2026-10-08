import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export const InviteButton = ({ className = "" }) => {
  const invite = async () => {
    const url = window.location.origin + "/";
    const text = "🐾 Crea la historia de tu mascota con humor chileno en Petito";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Petito", text, url });
      } catch { /* cancelado */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text} 👉 ${url}`);
        toast.success("Enlace copiado 🐾");
      } catch {
        toast.error("No se pudo copiar el enlace");
      }
    }
  };

  return (
    <button
      onClick={invite}
      data-testid="invite-friends-button"
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-white text-xs font-display font-semibold shadow-sm active:scale-95 transition-transform shrink-0 ${className}`}
      aria-label="Invitar amigos a Petito"
    >
      <UserPlus className="w-4 h-4" />
      <span className="whitespace-nowrap">Invitar amigos</span>
    </button>
  );
};
