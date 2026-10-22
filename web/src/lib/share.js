import { toast } from "sonner";

/**
 * Share a link the way that works on this device: the system share sheet when it exists and works
 * (phones), otherwise copy the link, and as a last resort open WhatsApp. Never fails silently.
 * Returns "shared" | "copied" | "whatsapp" | "cancelled".
 */
export async function shareLink({ title = "Petito", text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled"; // the person closed the sheet
      // Desktop browsers often refuse (NotAllowedError, "share already in progress"): fall through.
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} 👉 ${url}`);
    toast.success("Enlace copiado. Pégalo en WhatsApp o donde quieras 🐾");
    return "copied";
  } catch { /* clipboard blocked */ }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
  return "whatsapp";
}

export const whatsappUrl = (text, url) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
