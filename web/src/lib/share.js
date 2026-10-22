import { toast } from "sonner";
import { isMobile } from "@/lib/install";

/** Share an image file where phones allow it (WhatsApp, Instagram); otherwise share the link. */
export async function shareImage({ title = "Petito", text, url, imageUrl, fileName }) {
  if (imageUrl && isMobile() && navigator.canShare) {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      if (blob.size > 1000) {
        const file = new File([blob], fileName || "petito.jpg", { type: blob.type || "image/jpeg" });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title, text: `${text} ${url}` }); return "shared"; }
      }
    } catch (e) { if (e?.name === "AbortError") return "cancelled"; }
  }
  if (imageUrl && !isMobile()) { window.open(imageUrl, "_blank", "noopener"); return "opened"; }
  return shareLink({ title, text, url });
}

/**
 * Share a link the way that works on this device: the system share sheet when it exists and works
 * (phones), otherwise copy the link, and as a last resort open WhatsApp. Never fails silently.
 * Returns "shared" | "copied" | "whatsapp" | "cancelled".
 */
export async function shareLink({ title = "Petito", text, url }) {
  // The system share sheet is a phone thing; on a computer it is a surprise (AirDrop, Notes...) and often refused.
  if (navigator.share && isMobile()) {
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
