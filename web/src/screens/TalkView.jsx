"use client";
import { HomeLink } from "@/components/HomeLink";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { shareLink } from "@/lib/share";
import { PawPrint, Loader2, Volume2, VolumeX, Share2, Copy, Download, Sparkles, Mic, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTalkBySlug, talkCheckout, getConfig, mediaUrl } from "@/lib/api";
import { InviteButton } from "@/components/InviteButton";

const clp = (n) => new Intl.NumberFormat("es-CL").format(n || 0);

export default function TalkView() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [t, setT] = useState(null);
  const [err, setErr] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef();

  useEffect(() => { getConfig().then(setCfg).catch(() => {}); }, []);

  useEffect(() => {
    let timer;
    const tick = async () => {
      try {
        const d = await getTalkBySlug(slug);
        setT(d);
        const needsPoll = d.status === "generating" || (d.paid && !d.clean_ready);
        if (needsPoll) timer = setTimeout(tick, 3000);
      } catch { setErr(true); }
    };
    tick();
    return () => clearTimeout(timer);
  }, [slug]);

  // Auto-unlock for Petipo Plus members (no per-item payment)
  const autoTried = useRef(false);
  useEffect(() => {
    if (!t?.id || t.paid || t.mode !== "full" || autoTried.current) return;
    autoTried.current = true;
    talkCheckout(t.id, true).then((r) => { if (r?.already_paid || r?.mode === "plus") window.location.reload(); }).catch(() => {});
  }, [t?.id, t?.paid, t?.mode]);

  if (err) return (
    <div className="mobile-frame items-center justify-center text-center px-8" data-testid="talk-view-error">
      <PawPrint className="w-12 h-12 text-primary mb-4" />
      <h2 className="font-display font-bold text-xl text-neutral-900">No encontramos este video</h2>
      <Button onClick={() => nav("/")} className="mt-6 rounded-2xl">Ir a Petipo</Button>
    </div>
  );
  if (!t) return <div className="mobile-frame items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const price = clp(cfg?.talk_price_clp || 2990);
  const shareUrl = `${window.location.origin}/v/${slug}`;
  const videoSrc = t.paid && t.clean_ready ? mediaUrl(t.clean_url) : mediaUrl(t.preview_url);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  };

  const share = async () => {
    const text = t.motion ? `¡Mira a ${t.pet_name || "mi mascota"} en acción! 🎬🐾` : t.song ? `${t.to_name ? t.to_name + ", " : ""}${t.pet_name || "mi mascota"} te canta una canción 🎤🐾` : t.to_name ? `${t.to_name}, ${t.pet_name || "mi mascota"} te mandó un videomensaje 💌🐾` : `¡Mira a ${t.pet_name || "mi mascota"} hablando en Petipo! 🐾🗣️`;
    await shareLink({ text, url: shareUrl });
  };

  const download = async () => {
    try {
      const res = await fetch(videoSrc);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `petipo-${t.pet_name || "mascota"}.mp4`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error("No se pudo descargar"); }
  };

  const pay = async () => {
    setBusy(true);
    try {
      const res = await talkCheckout(t.id);
      if (res.already_paid || res.mode === "plus") window.location.reload();
      else nav("/plus?from=video");
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo desbloquear"); }
    finally { setBusy(false); }
  };

  // generating
  if (t.status === "generating") {
    return (
      <div className="mobile-frame paw-pattern items-center justify-center text-center px-8" data-testid="talk-view-generating">
        <Loader2 className="w-10 h-10 animate-spin text-white mb-5" />
        <h2 className="font-display font-semibold text-2xl text-white">{t.progress_step || "Dándole voz a tu mascota..."}</h2>
        <p className="text-white/80 mt-2 text-sm">{t.progress_pct || 10}%</p>
      </div>
    );
  }
  if (t.status === "failed") {
    return (
      <div className="mobile-frame items-center justify-center text-center px-8">
        <PawPrint className="w-12 h-12 text-primary mb-4" />
        <h2 className="font-display font-bold text-xl text-neutral-900">No pudimos crear el video</h2>
        <p className="text-sm text-muted-foreground mt-2">{t.error || "Intenta con otra foto."}</p>
        <Button onClick={() => nav(t.mode === "preview_free" ? "/" : "/hablar")} className="mt-6 rounded-2xl">Intentar de nuevo</Button>
      </div>
    );
  }

  const full = t.mode !== "preview_free"; // talk, song and motion videos all get the share hub / paywall
  const paidHd = t.paid && t.clean_ready;
  const finalizing = t.paid && !t.clean_ready;

  return (
    <div className="mobile-frame" data-testid="talk-view-screen">
      <div className="flex items-center justify-between px-5 pt-5">
        <HomeLink className="flex items-center gap-2 font-display font-semibold text-primary">
          <div className="w-8 h-8 rounded-full bg-primary grid place-items-center"><PawPrint className="w-5 h-5 text-white" /></div>
          Petipo
        </HomeLink>
        <InviteButton />
      </div>

      <div className="flex-1 px-5 pt-3 pb-40 overflow-y-auto no-scrollbar">
        {(t.to_name || t.song || t.motion) && (
          <p className="mb-3 text-center font-display font-bold text-lg text-neutral-900" data-testid="talk-view-dedication">
            {t.motion ? <>{t.pet_name || "Tu mascota"} en acción 🎬</> : t.song
              ? <>{t.pet_name || "Tu mascota"} {t.to_name ? <>le canta a <span className="text-primary">{t.to_name}</span></> : "te canta"} 🎤</>
              : <>{t.pet_name || "Tu mascota"} tiene un mensaje para <span className="text-primary">{t.to_name}</span> 💌</>}
          </p>
        )}
        <div className="relative w-full rounded-3xl overflow-hidden bg-stone-900 border-4 border-white shadow-2xl mx-auto" style={{ aspectRatio: "9 / 16", maxWidth: 320 }} data-testid="talk-view-video">
          <video ref={videoRef} src={videoSrc} className="w-full h-full object-cover" autoPlay loop muted={muted} playsInline onClick={toggleSound} />
          <button onClick={toggleSound} data-testid="talk-sound-toggle"
            className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-black/60 text-white grid place-items-center backdrop-blur">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          {muted && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <span className="bg-black/55 text-white text-sm font-semibold px-4 py-2 rounded-full">Toca para oír 🔊</span>
            </div>
          )}
        </div>

        {t.line && !t.motion && <p className={`mt-4 text-center font-script text-primary leading-tight whitespace-pre-line ${t.song ? "text-xl" : "text-2xl"}`} data-testid="talk-view-line">{t.song ? t.line : `“${t.line}”`}</p>}

        {finalizing && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-primary" data-testid="talk-finalizing">
            <Loader2 className="w-4 h-4 animate-spin" /> Preparando tu versión HD sin marca...
          </div>
        )}

        {/* Anonymous free preview */}
        {t.mode === "preview_free" && (
          <div className="mt-6 space-y-3" data-testid="talk-free-cta">
            <Button onClick={() => nav("/hablar")} className="w-full h-14 rounded-2xl font-display font-semibold text-base shadow-lg shadow-primary/30" data-testid="talk-create-full">
              <Sparkles className="w-5 h-5 mr-2" /> Crear el mío completo
            </Button>
            <Button onClick={share} className="w-full h-14 rounded-2xl font-semibold bg-[#25D366] hover:bg-[#1da851]" data-testid="talk-share-free">
              <Share2 className="w-5 h-5 mr-2" /> Compartir este adelanto
            </Button>
          </div>
        )}

        {/* Full, paid HD */}
        {full && paidHd && (
          <div className="mt-6 grid gap-3" data-testid="talk-paid-hub">
            <Button onClick={download} className="h-14 rounded-2xl font-semibold" data-testid="talk-download-hd"><Download className="w-5 h-5 mr-2" /> Descargar en HD</Button>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={share} className="h-14 rounded-2xl font-semibold bg-[#25D366] hover:bg-[#1da851]" data-testid="talk-share-paid"><Share2 className="w-5 h-5 mr-2" /> Compartir</Button>
              <Button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Enlace copiado"); }} variant="secondary" className="h-14 rounded-2xl font-semibold bg-white border border-border" data-testid="talk-copy-link"><Copy className="w-5 h-5 mr-2" /> Enlace</Button>
            </div>
            <button onClick={() => nav("/hablar")} className="mt-1 text-sm text-primary font-semibold flex items-center justify-center gap-1"><Mic className="w-4 h-4" /> Crear otro video</button>
          </div>
        )}

        {/* Full, not paid -> paywall */}
        {full && !t.paid && (
          <>
            <div className="mt-5 text-center">
              <p className="font-display font-semibold text-lg text-neutral-900">¡Quedó buenísimo! 🎬</p>
              <p className="text-sm text-muted-foreground mt-1">Descárgalo en alta calidad, sin marca de agua, con Petipo Plus.</p>
            </div>
            <div className="mt-4 bg-white rounded-3xl border border-border p-5 shadow-sm" data-testid="talk-paywall-card">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold text-stone-900 mb-2" style={{ background: "#F5C355" }}>👑 Petipo Plus</div>
                <div className="font-display font-bold text-xl text-neutral-900">Desbloquéalo con Petipo Plus</div>
                <div className="text-xs text-muted-foreground mt-1">Una sola membresía desbloquea todas tus creaciones</div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                {["Video completo en alta calidad, sin marca de agua", "Retratos e historias incluidos, sin pago por unidad", "Listo para WhatsApp y redes"].map((b) => (
                  <li key={b} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary shrink-0" /> {b}</li>
                ))}
              </ul>
            </div>
            <button onClick={share} className="mt-4 w-full text-sm text-primary font-semibold flex items-center justify-center gap-1.5" data-testid="talk-share-watermark"><Share2 className="w-4 h-4" /> Compartir con marca de agua (gratis)</button>
          </>
        )}
      </div>

      {full && !t.paid && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-[44rem] lg:max-w-[48rem] mx-auto p-4 pb-6 bg-gradient-to-t from-[#FAF6F0] via-[#FAF6F0] to-transparent">
          <Button onClick={pay} disabled={busy} className="w-full h-14 text-base font-display font-semibold rounded-2xl shadow-lg shadow-primary/30" data-testid="talk-pay-button">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Desbloquéalo con Petipo Plus</>}
          </Button>
        </div>
      )}
    </div>
  );
}
