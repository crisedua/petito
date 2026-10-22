"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { X, Share, PlusSquare, MoreVertical, MoreHorizontal, Smartphone, Copy, Check, Download, Menu, MonitorDown, Loader2 } from "lucide-react";
import {
  initInstall, subscribeInstall, promptInstall, isStandalone, checkInstalled, platform, isMobile,
  supportsNativeInstall, dismissedRecently, rememberDismiss,
} from "@/lib/install";

const C = { ink: "#3A2A20", muted: "#8A7868", accent: "#B85C3C", line: "#EADFCF", soft: "#FBEEE4", bg: "#FBF6EE" };

// Where the banner may appear on its own on phones (the landing page has its own card at the top).
const BANNER_ROUTES = [/^\/universo$/, /^\/amigos$/, /^\/album$/, /^\/mis-creaciones$/, /^\/perfil$/, /^\/plus$/];
const BANNER_DELAY_MS = 6000;

/** Starts "add to home screen" from anywhere (landing card, profile menu). */
export const openInstallSheet = () => window.dispatchEvent(new Event("petito:install"));

/** Whether to offer the shortcut at all: hidden inside the installed app or when already installed. */
export function useInstallOffer() {
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    initInstall();
    let alive = true;
    const update = () => checkInstalled().then((inst) => alive && setOffer(!inst));
    update();
    const off = subscribeInstall(update);
    return () => { alive = false; off(); };
  }, []);
  return offer;
}

/**
 * Phone banner + the step-by-step sheet. A tap first tries the browser's real install dialog
 * (Chrome, Edge, Samsung Internet); if this browser has none (Safari, Firefox, in-app browsers) or the
 * dialog isn't available, it shows the exact steps for this browser.
 */
export function InstallPrompt() {
  const path = usePathname() || "/";
  const [banner, setBanner] = useState(false);
  const [sheet, setSheet] = useState(null); // null | "steps" | "installed"
  const [working, setWorking] = useState(false);

  const start = async () => {
    setBanner(false);
    if (supportsNativeInstall()) {
      setWorking(true);
      const r = await promptInstall();
      setWorking(false);
      if (r === "accepted") return;
      if (r === "unavailable" && (await checkInstalled())) { setSheet("installed"); return; }
    }
    setSheet("steps");
  };

  useEffect(() => {
    initInstall();
    const open = () => start();
    window.addEventListener("petito:install", open);
    const done = () => { setBanner(false); setSheet(null); toast.success("¡Listo! Petipo quedó instalado 🐾"); };
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("petito:install", open); window.removeEventListener("appinstalled", done); };
  }, []); // eslint-disable-line

  useEffect(() => {
    setBanner(false);
    if (isStandalone() || !isMobile() || dismissedRecently() || !BANNER_ROUTES.some((r) => r.test(path))) return;
    let alive = true;
    const t = setTimeout(() => checkInstalled().then((inst) => alive && !inst && setBanner(true)), BANNER_DELAY_MS);
    return () => { alive = false; clearTimeout(t); };
  }, [path]);

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
                <div className="font-display font-bold text-sm" style={{ color: C.ink }}>Lleva Petipo en tu teléfono</div>
                <div className="text-[11px] leading-snug" style={{ color: C.muted }}>Ábrelo desde tu inicio como una app, sin descargar nada.</div>
              </div>
              <button onClick={start} data-testid="install-banner-add" className="px-3 h-9 rounded-full text-xs font-display font-bold text-white shrink-0" style={{ background: C.accent }}>Agregar</button>
              <button onClick={close} data-testid="install-banner-close" aria-label="Cerrar aviso" className="w-7 h-7 grid place-items-center shrink-0"><X className="w-4 h-4" style={{ color: C.muted }} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {working && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/20" data-testid="install-working">
          <div className="px-5 py-4 rounded-2xl bg-white shadow-xl flex items-center gap-3 font-display font-semibold text-sm" style={{ color: C.ink }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.accent }} /> Abriendo la instalación…
          </div>
        </div>
      )}
      <AnimatePresence>{sheet && <InstallSheet mode={sheet} onClose={() => { setSheet(null); rememberDismiss(); }} />}</AnimatePresence>
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

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + "/"); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { toast.error("No se pudo copiar"); }
  };
  return (
    <button onClick={copy} data-testid="install-copy-link" className="mt-2 flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold border bg-white" style={{ borderColor: C.line, color: C.accent }}>
      {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar enlace</>}
    </button>
  );
}

/** Title + steps for each browser. Exported for tests. */
export function stepsFor(p) {
  switch (p) {
    case "ios-safari":
      return ["Agrega Petipo a tu inicio", <>
        <Step n={1} icon={Share}>Toca el botón <b>Compartir</b>. Si no lo ves, toca <b>⋯</b> abajo y luego Compartir.</Step>
        <Step n={2} icon={PlusSquare}>Desliza hacia abajo y elige <b>“Agregar a inicio”</b>.</Step>
        <Step n={3}>Toca <b>Agregar</b> arriba a la derecha. ¡Listo! 🐾</Step>
      </>];
    case "ios-other":
      return ["Agrega Petipo a tu inicio", <>
        <Step n={1} icon={Share}>Toca el botón <b>Compartir</b> en la barra de direcciones.</Step>
        <Step n={2} icon={PlusSquare}>Elige <b>“Agregar a pantalla de inicio”</b>.</Step>
        <Step n={3}>Si no aparece, abre <b>petito.pro</b> en <b>Safari</b> y repite los pasos.</Step>
      </>];
    case "ios-inapp":
    case "android-inapp": {
      const ios = p === "ios-inapp";
      return ["Primero ábrelo en tu navegador", <>
        <Step n={1} icon={ios ? MoreHorizontal : MoreVertical}>Estás dentro de otra app (Instagram, WhatsApp…). Toca el menú <b>{ios ? "⋯" : "⋮"}</b> y elige <b>“Abrir en {ios ? "Safari" : "Chrome"}”</b> o <b>“Abrir en el navegador”</b>.</Step>
        <Step n={2}>O copia el enlace y pégalo en {ios ? "Safari" : "Chrome"}:<CopyLink /></Step>
        <Step n={3}>Ahí toca <b>Agregar</b> en el aviso de Petipo (o en el menú de tu perfil).</Step>
      </>];
    }
    case "android-samsung":
      return ["Agrega Petipo a tu inicio", <>
        <Step n={1} icon={Menu}>Toca el menú <b>☰</b> abajo a la derecha.</Step>
        <Step n={2} icon={PlusSquare}>Elige <b>“Agregar página a”</b> y luego <b>“Pantalla de inicio”</b>.</Step>
        <Step n={3}>Confirma con <b>Agregar</b>. ¡Listo! 🐾</Step>
      </>];
    case "android-firefox":
      return ["Agrega Petipo a tu inicio", <>
        <Step n={1} icon={MoreVertical}>Toca el menú <b>⋮</b>.</Step>
        <Step n={2} icon={Smartphone}>Elige <b>“Agregar a pantalla de inicio”</b> o <b>“Instalar”</b>.</Step>
        <Step n={3}>Confirma con <b>Agregar</b>. ¡Listo! 🐾</Step>
      </>];
    case "android":
    case "android-other":
      return ["Agrega Petipo a tu inicio", <>
        <Step n={1} icon={MoreVertical}>Toca el menú <b>⋮</b> arriba a la derecha.</Step>
        <Step n={2} icon={Smartphone}>Elige <b>“Agregar a la pantalla principal”</b> o <b>“Instalar app”</b>.</Step>
        <Step n={3}>Confirma con <b>Instalar</b> o <b>Agregar</b>. ¡Listo! 🐾</Step>
      </>];
    case "desktop-chrome":
      return ["Instala Petipo en tu computador", <>
        <Step n={1} icon={MonitorDown}>Toca el ícono de <b>instalar</b> al final de la barra de direcciones.</Step>
        <Step n={2} icon={MoreVertical}>Si no está, abre el menú <b>⋮</b> → <b>“Transmitir, guardar y compartir”</b> → <b>“Instalar página como app”</b>.</Step>
        <Step n={3}>Confirma con <b>Instalar</b>. Petipo se abre en su propia ventana.</Step>
      </>];
    case "desktop-edge":
      return ["Instala Petipo en tu computador", <>
        <Step n={1} icon={MoreHorizontal}>Abre el menú <b>⋯</b> → <b>Aplicaciones</b>.</Step>
        <Step n={2} icon={Download}>Elige <b>“Instalar este sitio como una aplicación”</b> y confirma.</Step>
      </>];
    case "desktop-safari":
      return ["Agrega Petipo a tu Dock", <>
        <Step n={1}>En la barra de menú, abre <b>Archivo</b> → <b>“Agregar al Dock”</b>.</Step>
        <Step n={2}>Confirma con <b>Agregar</b>. Petipo queda en tu Dock como una app.</Step>
      </>];
    default:
      return ["Este navegador no permite instalar sitios", <>
        <Step n={1}>Firefox y otros navegadores no tienen esta opción. Abre <b>petito.pro</b> en <b>Chrome</b>, <b>Edge</b> o <b>Safari</b>:<CopyLink /></Step>
        <Step n={2}>O hazlo desde tu teléfono: abre <b>petito.pro</b> y toca <b>Agregar</b>.</Step>
      </>];
  }
}

function InstallSheet({ mode, onClose }) {
  const p = platform();
  const [title, steps] = mode === "installed"
    ? ["Petipo ya está instalado", <Step key="i" n={1}>Búscalo en tu pantalla de inicio{isMobile() ? "" : ", tu Dock o tu lista de apps"} con el ícono de la patita 🐾. Si lo borraste, recarga esta página y vuelve a intentarlo.</Step>]
    : stepsFor(p);

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
            <p className="text-xs" style={{ color: C.muted }}>{isMobile() ? "Un ícono en tu teléfono que abre Petipo en pantalla completa." : "Petipo en su propia ventana, como una app."}</p>
          </div>
        </div>
        <ol className="mt-5 space-y-4" data-testid={`install-steps-${mode === "installed" ? "installed" : p}`}>{steps}</ol>
        <button onClick={onClose} className="mt-6 w-full h-11 rounded-2xl font-display font-semibold border bg-white" style={{ borderColor: C.line, color: C.muted }}>Ahora no</button>
      </motion.div>
    </motion.div>
  );
}
