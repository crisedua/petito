import { toast } from "sonner";
import { isMobile } from "@/lib/install";

const prefetched = new Map(); // imageUrl -> File | null, filled ahead of the tap

/**
 * Download a shareable image as soon as it's on screen. iPhone Safari only allows the share sheet right
 * after a tap, and a download in between can use that up; with the file ready the tap shares at once.
 */
export function prefetchShareImage(imageUrl, fileName) {
  if (!imageUrl || prefetched.has(imageUrl) || typeof window === "undefined" || !isMobile()) return;
  prefetched.set(imageUrl, null);
  fetch(imageUrl).then((r) => (r.ok ? r.blob() : null)).then((blob) => {
    if (blob && blob.size > 1000) prefetched.set(imageUrl, new File([blob], fileName || "petipop.jpg", { type: blob.type || "image/jpeg" }));
  }).catch(() => {});
}

/** Share an image file where phones allow it (WhatsApp, Instagram); otherwise share the link. */
export async function shareImage({ title = "Petipop", text, url, imageUrl, fileName }) {
  if (imageUrl && isMobile() && navigator.canShare) {
    try {
      let file = prefetched.get(imageUrl);
      if (!file) {
        const blob = await (await fetch(imageUrl)).blob();
        file = blob.size > 1000 ? new File([blob], fileName || "petipop.jpg", { type: blob.type || "image/jpeg" }) : null;
      }
      if (file && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title, text: `${text} ${url}` }); return "shared"; }
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
export async function shareLink({ title = "Petipop", text, url }) {
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
