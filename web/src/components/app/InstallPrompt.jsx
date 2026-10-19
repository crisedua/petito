"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { X, Share, PlusSquare, MoreVertical, MoreHorizontal, Smartphone, Copy, Check, Download, Menu } from "lucide-react";
import {
  initInstall, subscribeInstall, canPromptNatively, promptInstall, isStandalone, platform, isMobile,
  dismissedRecently, rememberDismiss,
} from "@/lib/install";

const C = { ink: "#3A2A20", muted: "#8A7868", accent: "#B85C3C", line: "#EADFCF", soft: "#FBEEE4", bg: "#FBF6EE" };

// Where the banner may appear on its own (never in the middle of creating something, or on share pages).
const BANNER_ROUTES = [/^\/$/, /^\/universo$/, /^\/amigos$/, /^\/album$/, /^\/mis-creaciones$/, /^\/perfil$/, /^\/plus$/];
const BANNER_DELAY_MS = 6000;

/** Opens the "add to home screen" sheet from anywhere (e.g. the profile menu). */
export const openInstallSheet = () => window.dispatchEvent(new Event("petito:install"));

/**
 * Small top banner on phones that haven't added Petito yet, plus the sheet with the steps for this
 * phone. Android Chrome gets the native install dialog; iPhone gets Safari's Share → "Agregar a inicio".
 */
export function InstallPrompt() {
  const path = usePathname() || "/";
  const [, force] = useState(0);
  const [banner, setBanner] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    initInstall();
    const off = subscribeInstall(() => force((n) => n + 1));
    const open = () => { setBanner(false); start(); };
    window.addEventListener("petito:install", open);
    const done = () => { setBanner(false); setSheet(false); toast.success("¡Listo! Petito quedó en tu pantalla de inicio 🐾"); };
    window.addEventListener("appinstalled", done);
    return () => { off(); window.removeEventListener("petito:install", open); window.removeEventListener("appinstalled", done); };
  }, []); // eslint-disable-line

  useEffect(() => {
    setBanner(false);
    if (isStandalone() || !isMobile() || dismissedRecently() || !BANNER_ROUTES.some((r) => r.test(path))) return;
    const t = setTimeout(() => setBanner(true), BANNER_DELAY_MS);
    return () => clearTimeout(t);
  }, [path]);

  const start = async () => {
    setBanner(false);
    if (canPromptNatively()) {
      const ok = await promptInstall();
      if (!ok) setSheet(true); // declined or failed: show the manual way too
      return;
    }
    setSheet(true);
  };
  const close = () => { setBanner(false); rememberDismiss(); };

  return (
    <>
      <AnimatePresence>
        {banner && (
          <motion.div initial={{ y: -90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -90, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="fixed top-2 left-0 right-0 z-[60] px-3 flex justify-center pointer-events-none" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
            <div className="pointer-events-auto w-full max-w-[26rem] flex items-center gap-3 p-3 rounded-2xl bg-white border shadow-xl" style={{ borderColor: C.line }} data-testid="install-banner">
              <img src="/apple-touch-icon.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm" style={{ color: C.ink }}>Lleva Petito en tu teléfono</div>
                <div className="text-[11px] leading-snug" style={{ color: C.muted }}>Ábrelo desde tu inicio como una app, sin descargar nada.</div>
              </div>
              <button onClick={start} data-testid="install-banner-add" className="px-3 h-9 rounded-full text-xs font-display font-bold text-white shrink-0" style={{ background: C.accent }}>Agregar</button>
              <button onClick={close} data-testid="install-banner-close" aria-label="Ahora no" className="w-7 h-7 grid place-items-center shrink-0"><X className="w-4 h-4" style={{ color: C.muted }} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{sheet && <InstallSheet onClose={() => { setSheet(false); rememberDismiss(); }} />}</AnimatePresence>
    </>
  );
}

function Step({ n, children, icon: Icon }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full grid place-items-center shrink-0 text-xs font-bold text-white" style={{ background: C.accent }}>{n}</span>
      <div className="flex-1 pt-0.5 text-sm font-display leading-relaxed" style={{ color: C.ink }}>
        {children}
        {Icon && <span className="inline-grid place-items-center w-7 h-7 ml-1.5 align-middle rounded-lg border bg-white" style={{ borderColor: C.line }}><Icon className="w-4 h-4" style={{ color: "#2F7BF6" }} /></span>}
      </div>
    </li>
  );
}

function InstallSheet({ onClose }) {
  const p = platform();
  const [copied, setCopied] = useState(false);
  const native = canPromptNatively();
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + "/"); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { toast.error("No se pudo copiar"); }
  };

  let title = "Agrega Petito a tu inicio";
  let steps;
  if (p === "ios-safari") {
    steps = (
      <>
        <Step n={1} icon={Share}>Toca el botón <b>Compartir</b>. Si no lo ves, toca <b>⋯</b> abajo y luego Compartir.</Step>
        <Step n={2} icon={PlusSquare}>Desliza hacia abajo y elige <b>“Agregar a inicio”</b>.</Step>
        <Step n={3}>Toca <b>Agregar</b> arriba a la derecha. ¡Listo! 🐾</Step>
      </>
    );
  } else if (p === "ios-other") {
    steps = (
      <>
        <Step n={1} icon={Share}>Toca el botón <b>Compartir</b> en la barra de direcciones.</Step>
        <Step n={2} icon={PlusSquare}>Elige <b>“Agregar a pantalla de inicio”</b>.</Step>
        <Step n={3}>Si no aparece, abre <b>petito.pro</b> en <b>Safari</b> y repite los pasos.</Step>
      </>
    );
  } else if (p === "ios-inapp" || p === "android-inapp") {
    title = "Primero ábrelo en tu navegador";
    steps = (
      <>
        <Step n={1} icon={p === "ios-inapp" ? MoreHorizontal : MoreVertical}>Estás dentro de otra app (Instagram, WhatsApp…). Toca el menú <b>{p === "ios-inapp" ? "⋯" : "⋮"}</b> y elige <b>“Abrir en {p === "ios-inapp" ? "Safari" : "Chrome"}”</b> o <b>“Abrir en el navegador”</b>.</Step>
        <Step n={2}>O copia el enlace y pégalo en {p === "ios-inapp" ? "Safari" : "Chrome"}:
          <button onClick={copy} data-testid="install-copy-link" className="mt-2 flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold border bg-white" style={{ borderColor: C.line, color: C.accent }}>
            {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar enlace</>}
          </button>
        </Step>
        <Step n={3}>Ahí toca <b>Agregar</b> en el aviso de Petito (o en el menú de tu perfil) y sigue los pasos.</Step>
      </>
    );
  } else if (p === "android-samsung") {
    steps = (
      <>
        <Step n={1} icon={Menu}>Toca el menú <b>☰</b> abajo a la derecha.</Step>
        <Step n={2} icon={PlusSquare}>Elige <b>“Agregar página a”</b> y luego <b>“Pantalla de inicio”</b>.</Step>
        <Step n={3}>Confirma con <b>Agregar</b>. ¡Listo! 🐾</Step>
      </>
    );
  } else if (p === "android") {
    steps = (
      <>
        <Step n={1} icon={MoreVertical}>Toca el menú <b>⋮</b> arriba a la derecha.</Step>
        <Step n={2} icon={Smartphone}>Elige <b>“Instalar app”</b> o <b>“Agregar a la pantalla principal”</b>.</Step>
        <Step n={3}>Confirma con <b>Instalar</b>. ¡Listo! 🐾</Step>
      </>
    );
  } else {
    title = "Instala Petito";
    steps = (
      <>
        <Step n={1} icon={Download}>En Chrome o Edge, toca el ícono de <b>instalar</b> al final de la barra de direcciones.</Step>
        <Step n={2}>En el teléfono es aún mejor: abre <b>petito.pro</b> y toca <b>Agregar Petito</b>.</Step>
      </>
    );
  }

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="relative w-full max-w-[28rem] rounded-t-[2rem] shadow-2xl px-6 pt-3" style={{ background: C.bg, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }} data-testid="install-sheet">
        <div className="mx-auto w-10 h-1.5 rounded-full bg-black/10" />
        <button onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: C.line }}><X className="w-4 h-4" /></button>
        <div className="mt-4 pr-10 flex items-center gap-3">
          <img src="/apple-touch-icon.png" alt="" className="w-14 h-14 rounded-2xl shadow" />
          <div>
            <h2 className="font-display font-bold text-lg" style={{ color: C.ink }}>{title}</h2>
            <p className="text-xs" style={{ color: C.muted }}>Un ícono en tu teléfono que abre Petito en pantalla completa.</p>
          </div>
        </div>
        {native && (
          <button onClick={async () => { if (await promptInstall()) onClose(); }} data-testid="install-native"
            className="mt-5 w-full h-12 rounded-2xl font-display font-bold text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
            <Download className="w-4 h-4" /> Instalar ahora
          </button>
        )}
        <ol className="mt-5 space-y-4" data-testid={`install-steps-${p}`}>{steps}</ol>
        <button onClick={onClose} className="mt-6 w-full h-11 rounded-2xl font-display font-semibold border bg-white" style={{ borderColor: C.line, color: C.muted }}>Ahora no</button>
      </motion.div>
    </motion.div>
  );
}
