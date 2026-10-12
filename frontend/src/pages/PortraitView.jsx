import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Loader2, PawPrint, Crown, ArrowRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortraitBySlug, mediaUrl } from "@/lib/api";

export default function PortraitView() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(false);
  const [opened, setOpened] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    getPortraitBySlug(slug).then((d) => { setP(d); setOpened(!d.gift_enabled); }).catch(() => setErr(true));
  }, [slug]);

  // Returning from Mercado Pago: poll until the webhook confirms payment.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pago") !== "success") return;
    if (p?.paid) return;
    setConfirming(true);
    let tries = 0;
    const t = setInterval(async () => {
      tries += 1;
      try {
        const d = await getPortraitBySlug(slug);
        setP(d);
        if (d.paid || tries >= 8) { clearInterval(t); setConfirming(false); }
      } catch { if (tries >= 8) { clearInterval(t); setConfirming(false); } }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, p?.paid]);

  if (err) return (
    <div className="mobile-frame items-center justify-center text-center px-8" data-testid="portrait-view-error">
      <PawPrint className="w-12 h-12 text-primary mb-4" />
      <h2 className="font-display font-bold text-xl text-neutral-900">No encontramos este retrato</h2>
      <p className="text-sm text-muted-foreground mt-2">El enlace puede haber expirado.</p>
      <Button onClick={() => nav("/")} className="mt-6 rounded-2xl">Ir a Petito</Button>
    </div>
  );

  if (!p) return <div className="mobile-frame items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const imgUrl = p.paid ? mediaUrl(p.clean_url) : mediaUrl(p.preview_url);

  const downloadImage = async () => {
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `petito-retrato-${p.pet_name || "mascota"}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { /* ignore */ }
  };

  return (
    <div className="mobile-frame" data-testid="portrait-view-screen">
      <AnimatePresence mode="wait">
        {!opened ? (
          <motion.div key="wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="flex-1 paw-pattern flex flex-col items-center justify-center text-center px-8">
            <motion.div animate={{ rotate: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: 2.4 }}>
              <Gift className="w-24 h-24 text-white drop-shadow-lg" />
            </motion.div>
            <h1 className="mt-6 font-display font-bold text-3xl text-white leading-tight">Tienes un regalo de Petito 🎁</h1>
            {p.gift_from && <p className="mt-2 text-white/90">De parte de <b>{p.gift_from}</b></p>}
            <Button onClick={() => setOpened(true)} className="mt-8 h-14 px-8 rounded-2xl text-base font-display font-semibold bg-white text-primary hover:bg-white/90" data-testid="portrait-open-gift">
              Abrir mi regalo <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </motion.div>
        ) : (
          <motion.div key="reveal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 px-5 pt-5 font-display font-semibold text-primary">
              <div className="w-8 h-8 rounded-full bg-primary grid place-items-center"><PawPrint className="w-5 h-5 text-white" /></div>
              Petito
            </div>
            <div className="flex-1 px-5 pt-3 pb-8 overflow-y-auto no-scrollbar">
              {p.gift_enabled && p.gift_to && (
                <p className="text-center font-script text-2xl text-primary mb-1" data-testid="portrait-view-dedication">
                  Para {p.gift_to}{p.gift_from ? `, de ${p.gift_from}` : ""}
                </p>
              )}
              {p.category === "memorial" && (
                <div className="text-center mb-1" data-testid="portrait-view-memorial">
                  {p.pet_name && <p className="font-script text-3xl text-slate-700">{p.pet_name}</p>}
                  {p.memorial_dates && <p className="text-sm text-slate-400 -mt-1">{p.memorial_dates}</p>}
                </div>
              )}
              <div className="relative w-full rounded-3xl overflow-hidden bg-stone-900 border-4 border-white shadow-2xl mx-auto" style={{ aspectRatio: "3 / 4", maxWidth: 360 }} data-testid="portrait-view-image">
                {imgUrl && <img src={imgUrl} alt="Retrato" className="w-full h-full object-cover" />}
              </div>
              {p.category === "memorial" && p.memorial_caption && (
                <p className="mt-3 text-center font-script text-2xl text-slate-600">“{p.memorial_caption}”</p>
              )}
              {p.gift_enabled && p.gift_message && (
                <p className="mt-3 text-center text-sm text-neutral-700 italic">“{p.gift_message}”</p>
              )}

              {confirming && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary" data-testid="portrait-view-confirming">
                  <Loader2 className="w-4 h-4 animate-spin" /> Confirmando tu pago...
                </div>
              )}

              {p.paid && (
                <Button onClick={downloadImage} className="mt-6 w-full h-14 rounded-2xl font-semibold" data-testid="portrait-view-download">
                  <Download className="w-5 h-5 mr-2" /> Descargar imagen
                </Button>
              )}

              <div className="mt-8 bg-white rounded-3xl border border-border p-5 text-center shadow-sm">
                <Crown className="w-8 h-8 text-primary mx-auto" />
                <p className="mt-2 font-display font-semibold text-neutral-900">¿Y tu mascota?</p>
                <p className="text-sm text-muted-foreground">Crea su retrato de realeza en Petito.</p>
                <Button onClick={() => nav("/retrato")} className="mt-4 rounded-2xl font-semibold" data-testid="portrait-view-cta">
                  Crear mi retrato <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
