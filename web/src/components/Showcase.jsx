"use client";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Crown, Mic, Sparkles } from "lucide-react";
import { getShowcase } from "@/lib/api";

const C = { ink: "#3A2A20", muted: "#8A7868", accent: "#B85C3C", line: "#EEE3D2" };

// Until an admin features real creations (Admin → Muestras → Portada), show the built-in examples.
const FALLBACK = [
  { kind: "portrait", id: "f1", label: "Retrato", title: "Un retrato de realeza", before: "/samples/dog.jpg", after: "/portrait-styles/renacentista.jpg", fallback: true },
  { kind: "static", id: "f2", label: "Te habla", title: "Un video donde te habla con su voz", icon: Mic, bg: "#FBEEE4", fg: "#B85C3C" },
  { kind: "portrait", id: "f3", label: "Halloween", title: "Disfraces para la temporada", before: "/samples/dog.jpg", after: "/portrait-styles/halloween.jpg", fallback: true },
];

/** Three real transformations on the landing: a portrait with its before photo, a talking video, and one more. */
export default function Showcase() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    getShowcase().then((d) => setItems(d.items?.length ? d.items : FALLBACK)).catch(() => setItems(FALLBACK));
  }, []);
  const list = items ?? FALLBACK;
  return (
    <div className="-mx-6 px-6 flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory" data-testid="landing-showcase">
      {list.map((it) => (
        <div key={it.id} className="snap-start shrink-0 w-[62%] max-w-[240px]">
          {it.kind === "video" ? <VideoTile it={it} /> : it.kind === "portrait" ? <PortraitTile it={it} /> : <StaticTile it={it} />}
        </div>
      ))}
    </div>
  );
}

function Label({ icon: Icon, children }) {
  return (
    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
      <Icon className="w-3 h-3" /> {children}
    </span>
  );
}

/** Before photo pinned in the corner of the result, so the transformation is obvious at a glance. */
function PortraitTile({ it }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-stone-200" style={{ aspectRatio: "3 / 4" }} data-testid="showcase-portrait">
      <img src={it.after} alt={it.title} className="absolute inset-0 w-full h-full object-cover" />
      <Label icon={Crown}>{it.label}</Label>
      {!it.fallback && (
        <div className="absolute bottom-2 left-2 w-[34%] rounded-lg overflow-hidden border-2 border-white shadow-md" style={{ aspectRatio: "3 / 4" }}>
          <img src={it.before} alt="Antes" className="w-full h-full object-cover" />
          <span className="absolute bottom-0 inset-x-0 text-[9px] font-bold text-white text-center" style={{ background: "rgba(0,0,0,0.55)" }}>Antes</span>
        </div>
      )}
      {it.pet_name && <span className="absolute bottom-2 right-2 font-script text-xl text-white drop-shadow">{it.pet_name}</span>}
    </div>
  );
}

/** Plays muted on its own; one tap turns the sound on. */
function VideoTile({ it }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  const toggle = () => {
    const v = ref.current; if (!v) return;
    v.muted = !muted; setMuted(!muted);
    if (!muted) return;
    v.currentTime = 0; v.play().catch(() => {});
  };
  return (
    <button onClick={toggle} className="relative block w-full rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-stone-900" style={{ aspectRatio: "3 / 4" }} data-testid="showcase-video">
      <video ref={ref} src={it.video} poster={it.poster} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
      <Label icon={Mic}>{it.label}</Label>
      <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full grid place-items-center text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </span>
      {muted && <span className="absolute bottom-3 left-2 text-[11px] font-bold text-white drop-shadow">Toca para escuchar</span>}
    </button>
  );
}

function StaticTile({ it }) {
  const Icon = it.icon || Sparkles;
  return (
    <div className="relative rounded-2xl overflow-hidden border-4 border-white shadow-lg grid place-items-center text-center p-4" style={{ aspectRatio: "3 / 4", background: it.bg }}>
      <div>
        <div className="w-14 h-14 mx-auto rounded-2xl bg-white grid place-items-center" style={{ color: it.fg }}><Icon className="w-7 h-7" /></div>
        <div className="mt-3 font-display font-bold" style={{ color: C.ink }}>{it.label}</div>
        <div className="mt-1 text-xs" style={{ color: C.muted }}>{it.title}</div>
      </div>
    </div>
  );
}
