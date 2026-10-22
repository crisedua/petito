"use client";
import { HomeLink } from "@/components/HomeLink";
import { Logo } from "@/components/Logo";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { toast } from "sonner";
import { shareLink } from "@/lib/share";
import { Loader2, PawPrint, Download, Share2, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoryBySlug, mediaUrl } from "@/lib/api";
import { StoryCarousel } from "@/components/StoryCarousel";
import { InviteButton } from "@/components/InviteButton";

export default function StoryView() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoryBySlug(slug).then(setStory).catch(() => toast.error("Historia no encontrada")).finally(() => setLoading(false));
  }, [slug]);

  // Stream the magic AI scenes + narration in as they finish
  useEffect(() => {
    if (!story?.bonus_pending && !story?.narration_pending) return;
    const poll = setInterval(async () => {
      try {
        const s = await getStoryBySlug(slug);
        setStory(s);
        if (!s.bonus_pending && !s.narration_pending) clearInterval(poll);
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [story?.bonus_pending, story?.narration_pending, slug]);

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
        a.download = `petipop-${story.pet_name}-${i + 1}.jpg`;
        document.body.appendChild(a); a.click(); a.remove();
        await new Promise((r) => setTimeout(r, 250));
      } catch { /* skip */ }
    }
  };

  const shareNative = async () => {
    const text = `¡Mira la historia de ${story.pet_name} en Petipop! 🐾`;
    await shareLink({ text, url: shareUrl });
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
        <HomeLink className="flex items-center gap-2 font-display font-semibold text-primary"><Logo /></HomeLink>
        <InviteButton />
      </div>
      <div className="flex-1 px-5 pt-4 pb-32 overflow-y-auto no-scrollbar">
        <h1 className="font-display font-bold text-xl text-center text-neutral-900">{story.title}</h1>
        <p className="text-center text-sm text-muted-foreground mb-4">{story.theme_label} · {story.pet_name}</p>
        <StoryCarousel slides={story.slides} paid={story.paid} theme={story.theme} narration={(story.slides || []).some((s) => s.audio_url) || story.narration_pending} bonusPending={story.bonus_pending} petName={story.pet_name} onUnlock={() => nav("/crear")} />

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
