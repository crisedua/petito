import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, PawPrint, Download, Share2, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoryBySlug, mediaUrl } from "@/lib/api";
import { StoryCarousel } from "@/components/StoryCarousel";

export default function StoryView() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoryBySlug(slug).then(setStory).catch(() => toast.error("Historia no encontrada")).finally(() => setLoading(false));
  }, [slug]);

  const shareUrl = window.location.href;

  const downloadAll = async () => {
    const slides = (story?.slides || []).filter((s) => !s.locked && s.image_url);
    toast.info("Descargando...");
    for (let i = 0; i < slides.length; i++) {
      try {
        const res = await fetch(mediaUrl(slides[i].image_url));
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `cuentapatas-${story.pet_name}-${i + 1}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        await new Promise((r) => setTimeout(r, 250));
      } catch { /* skip */ }
    }
  };

  const shareNative = async () => {
    const text = `¡Mira la historia de ${story.pet_name} en Cuentapatas! 🐾`;
    if (navigator.share) { try { await navigator.share({ title: "Cuentapatas", text, url: shareUrl }); } catch {} }
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`, "_blank");
  };

  if (loading) return <div className="mobile-frame grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!story) return (
    <div className="mobile-frame grid place-items-center px-8 text-center">
      <div>
        <PawPrint className="w-12 h-12 text-primary mx-auto mb-3" />
        <p className="font-display font-semibold text-lg">Historia no encontrada</p>
        <Button onClick={() => nav("/")} className="mt-4 rounded-2xl">Ir al inicio</Button>
      </div>
    </div>
  );

  return (
    <div className="mobile-frame" data-testid="story-view-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <button onClick={() => nav("/")} className="flex items-center gap-2 font-display font-semibold text-primary">
          <div className="w-8 h-8 rounded-full bg-primary grid place-items-center"><PawPrint className="w-5 h-5 text-white" /></div>
          Cuentapatas
        </button>
      </div>
      <div className="flex-1 px-5 pt-4 pb-32 overflow-y-auto no-scrollbar">
        <h1 className="font-display font-bold text-xl text-center text-neutral-900">{story.title}</h1>
        <p className="text-center text-sm text-muted-foreground mb-4">{story.theme_label} · {story.pet_name}</p>
        <StoryCarousel slides={story.slides} paid={story.paid} onUnlock={() => nav("/crear")} />

        {story.paid ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button onClick={downloadAll} variant="secondary" className="h-13 rounded-2xl font-semibold col-span-2 bg-white border border-border py-3" data-testid="view-download-button">
              <Download className="w-5 h-5 mr-2" /> Descargar diapositivas
            </Button>
            <Button onClick={shareNative} className="h-13 rounded-2xl font-semibold bg-[#25D366] hover:bg-[#1da851] py-3" data-testid="view-share-button">
              <Share2 className="w-5 h-5 mr-2" /> Compartir
            </Button>
            <Button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Enlace copiado"); }} variant="secondary" className="h-13 rounded-2xl font-semibold bg-white border border-border py-3" data-testid="view-copy-button">
              <Copy className="w-5 h-5 mr-2" /> Copiar enlace
            </Button>
          </div>
        ) : (
          <div className="mt-6 text-center bg-white rounded-3xl border border-border p-5">
            <p className="font-display font-semibold text-neutral-900">¿Te gustó? Crea la de tu mascota 🐾</p>
            <Button onClick={() => nav("/crear")} className="mt-3 w-full h-13 rounded-2xl font-display font-semibold py-3" data-testid="view-create-cta">
              Crear mi historia <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
