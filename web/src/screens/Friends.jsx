"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Heart, MessageCircle, Send, Share2, Trash2, UserPlus, Users, Check, X, Link2,
  RefreshCw, Plus, Calendar, Film, Crown, Mic, BookHeart, PawPrint,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  getFriends, getFeed, shareOptions, createShare, deleteShare, toggleHeart, getComments, addComment, deleteComment,
  acceptConnection, endConnection, resetFriendCode, mediaUrl,
} from "@/lib/api";

const C = { bg: "#FBF6EE", ink: "#3A2A20", muted: "#8A7868", accent: "#B85C3C", line: "#EADFCF", soft: "#FBEEE4", card: "#EEE3D2" };

const KIND = {
  story: { label: "Historia", color: "#B85C3C", icon: Film },
  portrait: { label: "Retrato", color: "#C79A3B", icon: Crown },
  video: { label: "Video", color: "#8A9B6E", icon: Mic },
  memory: { label: "Recuerdo", color: "#9C5F86", icon: BookHeart },
};

const errMsg = (e, fallback) => e?.response?.data?.detail || fallback;

export function timeAgo(isoStr) {
  if (!isoStr) return "";
  const s = Math.max(0, (Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 60) return "recién";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 7) return d === 1 ? "ayer" : `hace ${d} días`;
  return new Date(isoStr).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function Avatar({ src, name, size = 40 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="rounded-full overflow-hidden grid place-items-center shrink-0 border-2 border-white shadow-sm"
      style={{ width: size, height: size, background: "#E2A878" }}>
      {src ? <img src={src} alt={name} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        : <span className="font-display font-bold text-white" style={{ fontSize: size * 0.4 }}>{initial}</span>}
    </div>
  );
}

const inviteUrl = (code) => `${window.location.origin}/amigos/conectar/${code}`;

async function shareInvite(code, name) {
  const url = inviteUrl(code);
  const text = `🐾 ${name ? `${name} te invita` : "Te invito"} a conectar en Petito para compartir las historias de nuestras mascotas`;
  if (navigator.share) {
    try { await navigator.share({ title: "Petito", text, url }); return; } catch { return; }
  }
  try { await navigator.clipboard.writeText(`${text} 👉 ${url}`); toast.success("Enlace copiado 🐾"); }
  catch { toast.error("No se pudo copiar el enlace"); }
}

export default function Friends() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "amigos" ? "amigos" : "novedades");
  const [overview, setOverview] = useState(null);
  const [feed, setFeed] = useState(null);
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [preselect, setPreselect] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null);

  const loadOverview = useCallback(() => getFriends().then(setOverview).catch(() => setOverview({ friends: [], incoming: [], outgoing: [], friend_code: null })), []);
  const loadFeed = useCallback(() => getFeed().then((d) => { setFeed(d); setNextBefore(d.next_before); }).catch(() => setFeed({ items: [], friends: 0 })), []);

  useEffect(() => { loadOverview(); loadFeed(); }, [loadOverview, loadFeed]);

  // /amigos?compartir=memory:<id> opens the share sheet with that item picked (from a memory's page).
  useEffect(() => {
    const pick = params.get("compartir");
    if (pick && pick.includes(":")) {
      const [kind, id] = pick.split(":");
      setPreselect({ kind, id });
      setShareOpen(true);
      setParams({}, { replace: true });
    }
  }, []); // eslint-disable-line

  const more = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const d = await getFeed(nextBefore);
      setFeed((f) => ({ ...f, items: [...f.items, ...d.items.filter((x) => !f.items.some((y) => y.id === x.id))] }));
      setNextBefore(d.next_before);
    } catch { toast.error("No se pudo cargar más"); }
    finally { setLoadingMore(false); }
  };

  const patchItem = (id, patch) => setFeed((f) => ({ ...f, items: f.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const pending = overview?.incoming?.length ?? 0;

  return (
    <div className="mobile-frame" style={{ background: C.bg }} data-testid="friends-screen">
      <div className="flex items-center gap-3 px-5 pt-5">
        <button onClick={() => nav("/universo")} data-testid="friends-back"
          className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: C.line }}>
          <ArrowLeft className="w-4 h-4" style={{ color: C.ink }} />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl" style={{ color: C.ink }}>Amigos de Petito</h1>
          <p className="text-xs" style={{ color: C.muted }}>Comparte con los dueños que tú eliges</p>
        </div>
      </div>

      <div className="flex gap-2 px-5 mt-4">
        {[["novedades", "Novedades", Heart], ["amigos", "Amigos", Users]].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`friends-tab-${k}`}
            className="relative flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-display font-semibold transition-all"
            style={tab === k ? { background: C.accent, color: "#fff" } : { background: "#fff", color: C.muted, border: `1px solid ${C.line}` }}>
            <Icon className="w-4 h-4" /> {label}
            {k === "amigos" && pending > 0 && (
              <span className="absolute -top-1.5 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold grid place-items-center bg-red-500 text-white" data-testid="friends-pending-badge">{pending}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 pt-4 pb-12 overflow-y-auto no-scrollbar">
        {tab === "novedades" ? (
          <>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setPreselect(null); setShareOpen(true); }} data-testid="friends-share-button"
              className="w-full flex items-center gap-3 p-4 rounded-2xl border text-left" style={{ background: "#fff", borderColor: C.card }}>
              <Avatar src={user?.picture} name={user?.name} size={40} />
              <span className="flex-1 font-display text-sm" style={{ color: C.muted }}>Comparte una historia, retrato, video o recuerdo…</span>
              <span className="w-9 h-9 rounded-full grid place-items-center" style={{ background: C.accent }}><Plus className="w-5 h-5 text-white" /></span>
            </motion.button>

            {feed === null ? (
              <div className="grid place-items-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: C.accent }} /></div>
            ) : feed.items.length === 0 ? (
              <EmptyFeed hasFriends={feed.friends > 0} onInvite={() => setTab("amigos")} onShare={() => setShareOpen(true)} />
            ) : (
              <div className="mt-4 space-y-4" data-testid="friends-feed">
                {feed.items.map((it) => (
                  <FeedCard key={it.id} it={it} onOpen={(p) => nav(p)}
                    onHeart={async () => {
                      patchItem(it.id, { hearted: !it.hearted, hearts: it.hearts + (it.hearted ? -1 : 1) });
                      try { const r = await toggleHeart(it.id); patchItem(it.id, { hearted: r.hearted, hearts: r.hearts }); }
                      catch { patchItem(it.id, { hearted: it.hearted, hearts: it.hearts }); }
                    }}
                    onComments={() => setCommentsFor(it)}
                    onUnshare={async () => {
                      try { await deleteShare(it.id); setFeed((f) => ({ ...f, items: f.items.filter((x) => x.id !== it.id) })); toast.success("Dejaste de compartirlo"); }
                      catch { toast.error("No se pudo quitar"); }
                    }} />
                ))}
                {nextBefore && (
                  <button onClick={more} disabled={loadingMore} data-testid="friends-feed-more"
                    className="w-full h-11 rounded-2xl bg-white border font-display font-semibold text-sm" style={{ borderColor: C.line, color: C.accent }}>
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Ver más"}
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <FriendsTab overview={overview} me={user} reload={() => { loadOverview(); loadFeed(); }} setOverview={setOverview} />
        )}
      </div>

      <AnimatePresence>
        {shareOpen && (
          <ShareSheet preselect={preselect} onClose={() => setShareOpen(false)}
            onShared={() => { setShareOpen(false); setTab("novedades"); loadFeed(); }}
            hasFriends={(overview?.friends?.length ?? 0) > 0} />
        )}
        {commentsFor && (
          <CommentsSheet share={commentsFor} onClose={() => setCommentsFor(null)}
            onCount={(n) => patchItem(commentsFor.id, { comments: n })} />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyFeed({ hasFriends, onInvite, onShare }) {
  return (
    <div className="mt-6 p-6 rounded-3xl bg-white border text-center" style={{ borderColor: C.card }} data-testid="friends-feed-empty">
      <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center" style={{ background: C.soft }}><PawPrint className="w-7 h-7" style={{ color: C.accent }} /></div>
      {hasFriends ? (
        <>
          <p className="mt-3 font-display font-bold" style={{ color: C.ink }}>Todavía nadie ha compartido</p>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>Sé el primero: comparte una creación o un recuerdo con tus amigos.</p>
          <button onClick={onShare} className="mt-4 px-5 h-11 rounded-2xl font-display font-semibold text-white" style={{ background: C.accent }}>Compartir algo</button>
        </>
      ) : (
        <>
          <p className="mt-3 font-display font-bold" style={{ color: C.ink }}>Conecta con otros dueños</p>
          <p className="mt-1 text-sm" style={{ color: C.muted }}>Envía tu enlace a quien tú quieras. Cuando se conecten, verán lo que comparten entre ustedes.</p>
          <button onClick={onInvite} data-testid="friends-empty-invite" className="mt-4 px-5 h-11 rounded-2xl font-display font-semibold text-white inline-flex items-center gap-2" style={{ background: C.accent }}>
            <UserPlus className="w-4 h-4" /> Invitar amigos
          </button>
        </>
      )}
    </div>
  );
}

function FeedCard({ it, onOpen, onHeart, onComments, onUnshare }) {
  const [confirm, setConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const k = KIND[it.kind] || KIND.story;
  const item = it.item || {};
  const mem = item.memory;
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-white border overflow-hidden shadow-sm" style={{ borderColor: C.card }} data-testid={`feed-item-${it.id}`}>
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar src={it.owner.picture} name={it.owner.name} size={38} />
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-sm truncate" style={{ color: C.ink }}>
            {it.mine ? "Tú" : it.owner.name}{it.pet?.name ? <span className="font-semibold" style={{ color: C.muted }}> · con {it.pet.name}</span> : null}
          </div>
          <div className="text-[11px]" style={{ color: C.muted }}>{timeAgo(it.created_at)}</div>
        </div>
        <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: k.color }}>{k.label}</span>
      </div>
      {it.note && <p className="px-4 pt-3 text-sm font-display leading-relaxed whitespace-pre-wrap" style={{ color: "#4A3B30" }}>{it.note}</p>}

      {mem ? (
        <div className="mt-3">
          {item.thumb_url && <img src={mediaUrl(item.thumb_url)} alt={item.title} className="w-full object-cover" style={{ aspectRatio: "16 / 10" }} />}
          <div className="px-4 pt-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#A7937F" }}><Calendar className="w-3.5 h-3.5" /> {mem.happened_on || "hace un tiempo"}</div>
            <div className="mt-1 font-display font-bold text-lg" style={{ color: C.ink }}>{item.title}</div>
            {mem.emotion_labels?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mem.emotion_labels.map((e) => <span key={e.key} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.soft, color: C.accent }}>{e.emoji} {e.label}</span>)}
              </div>
            )}
            {mem.feeling_text && (
              <p className={`mt-2 text-sm font-display leading-relaxed whitespace-pre-wrap ${expanded ? "" : "line-clamp-4"}`} style={{ color: "#4A3B30" }}
                onClick={() => setExpanded(true)}>{mem.feeling_text}</p>
            )}
          </div>
        </div>
      ) : (
        <button onClick={() => item.view_path && onOpen(item.view_path)} className="mt-3 block w-full text-left" data-testid={`feed-open-${it.id}`}>
          <div className="relative mx-4 rounded-2xl overflow-hidden bg-stone-200" style={{ aspectRatio: "4 / 5" }}>
            {item.thumb_url && <img src={mediaUrl(item.thumb_url)} alt={item.title} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0.15; }} />}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent 55%)" }} />
            {it.kind === "video" && <span className="absolute inset-0 grid place-items-center"><span className="w-14 h-14 rounded-full bg-white/85 grid place-items-center"><Mic className="w-6 h-6" style={{ color: C.accent }} /></span></span>}
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <div className="font-display font-bold truncate">{item.title}</div>
              {item.subtitle && <div className="text-xs text-white/85 line-clamp-2">{it.kind === "video" ? `“${item.subtitle}”` : item.subtitle}</div>}
            </div>
          </div>
        </button>
      )}

      <div className="flex items-center gap-1 px-2 py-2 mt-1">
        <button onClick={onHeart} data-testid={`feed-heart-${it.id}`} className="flex items-center gap-1.5 px-3 h-10 rounded-full active:scale-95 transition-transform">
          <Heart className="w-5 h-5" style={{ color: it.hearted ? "#E0533D" : C.muted }} fill={it.hearted ? "#E0533D" : "none"} />
          <span className="text-sm font-semibold" style={{ color: C.muted }}>{it.hearts || ""}</span>
        </button>
        <button onClick={onComments} data-testid={`feed-comments-${it.id}`} className="flex items-center gap-1.5 px-3 h-10 rounded-full active:scale-95 transition-transform">
          <MessageCircle className="w-5 h-5" style={{ color: C.muted }} />
          <span className="text-sm font-semibold" style={{ color: C.muted }}>{it.comments || ""}</span>
        </button>
        <div className="flex-1" />
        {it.mine && (confirm ? (
          <div className="flex items-center gap-1 pr-2">
            <span className="text-xs" style={{ color: C.muted }}>¿Dejar de compartir?</span>
            <button onClick={onUnshare} className="px-2.5 h-8 rounded-full text-xs font-bold text-white" style={{ background: C.accent }} data-testid={`feed-unshare-confirm-${it.id}`}>Sí</button>
            <button onClick={() => setConfirm(false)} className="px-2.5 h-8 rounded-full text-xs font-bold" style={{ color: C.muted }}>No</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} data-testid={`feed-unshare-${it.id}`} className="w-10 h-10 rounded-full grid place-items-center" aria-label="Dejar de compartir">
            <Trash2 className="w-4 h-4" style={{ color: C.muted }} />
          </button>
        ))}
      </div>
    </motion.article>
  );
}

function Sheet({ children, onClose, testid }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="relative w-full max-w-[28rem] max-h-[88dvh] flex flex-col rounded-t-[2rem] shadow-2xl" style={{ background: C.bg }} data-testid={testid}>
        <div className="mx-auto mt-2.5 w-10 h-1.5 rounded-full bg-black/10" />
        {children}
      </motion.div>
    </motion.div>
  );
}

function ShareSheet({ preselect, onClose, onShared, hasFriends }) {
  const [opts, setOpts] = useState(null);
  const [picked, setPicked] = useState(preselect ? `${preselect.kind}:${preselect.id}` : null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { shareOptions().then(setOpts).catch(() => setOpts([])); }, []);

  const send = async () => {
    if (!picked) return;
    const [kind, id] = picked.split(":");
    setBusy(true);
    try {
      const r = await createShare(kind, id, note.trim());
      toast.success(r.created ? (hasFriends ? "¡Compartido con tus amigos! 🐾" : "Compartido. Tus amigos lo verán cuando se conecten 🐾") : "Ya lo habías compartido; actualizamos tu mensaje");
      onShared();
    } catch (e) { toast.error(errMsg(e, "No se pudo compartir")); }
    finally { setBusy(false); }
  };

  return (
    <Sheet onClose={onClose} testid="share-sheet">
      <div className="flex items-center justify-between px-5 pt-3">
        <h2 className="font-display font-bold text-lg" style={{ color: C.ink }}>Compartir con mis amigos</h2>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: C.line }}><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3 pb-3">
        {opts === null ? (
          <div className="grid place-items-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.accent }} /></div>
        ) : opts.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: C.muted }}>Aún no tienes creaciones ni recuerdos. Crea uno desde el universo de tu mascota y vuelve aquí. 🐾</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5" data-testid="share-options">
            {opts.map((o) => {
              const k = KIND[o.kind] || KIND.story;
              const id = `${o.kind}:${o.id}`;
              const on = picked === id;
              return (
                <button key={id} onClick={() => setPicked(id)} data-testid={`share-option-${o.kind}-${o.id}`}
                  className="relative rounded-2xl overflow-hidden text-left border-2 transition-all" style={{ aspectRatio: "3 / 4", borderColor: on ? C.accent : "transparent", background: "#fff" }}>
                  {o.thumb_url ? <img src={mediaUrl(o.thumb_url)} alt={o.title} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.target.style.opacity = 0.15; }} />
                    : <div className="absolute inset-0 grid place-items-center" style={{ background: C.soft }}><k.icon className="w-7 h-7" style={{ color: k.color }} /></div>}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent 55%)" }} />
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: k.color }}>{k.label}</span>
                  {on && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full grid place-items-center" style={{ background: C.accent }}><Check className="w-4 h-4 text-white" /></span>}
                  <span className="absolute bottom-1.5 left-1.5 right-1.5 text-white text-[11px] font-display font-semibold">
                    {o.already_shared && <span className="inline-block mb-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/90" style={{ color: C.accent }}>Ya compartido</span>}
                    <span className="block line-clamp-2">{o.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="px-5 pt-2 pb-5 border-t" style={{ borderColor: C.line }}>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} rows={2} data-testid="share-note"
          placeholder="Escribe algo para tus amigos (opcional)"
          className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-display resize-none outline-none focus:ring-2" style={{ borderColor: C.line, color: C.ink }} />
        <button onClick={send} disabled={!picked || busy} data-testid="share-submit"
          className="mt-2 w-full h-12 rounded-2xl font-display font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: C.accent }}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Share2 className="w-4 h-4" /> Compartir</>}
        </button>
        <p className="mt-2 text-center text-[11px]" style={{ color: C.muted }}>Solo lo verán los dueños con los que estás conectado.</p>
      </div>
    </Sheet>
  );
}

function CommentsSheet({ share, onClose, onCount }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { getComments(share.id).then(setList).catch(() => { toast.error("No se pudieron cargar los comentarios"); setList([]); }); }, [share.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [list]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try { const l = await addComment(share.id, body); setList(l); onCount(l.length); setText(""); }
    catch (e) { toast.error(errMsg(e, "No se pudo comentar")); }
    finally { setBusy(false); }
  };
  const remove = async (c) => {
    try { await deleteComment(share.id, c.id); const l = list.filter((x) => x.id !== c.id); setList(l); onCount(l.length); }
    catch { toast.error("No se pudo borrar"); }
  };

  return (
    <Sheet onClose={onClose} testid="comments-sheet">
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <h2 className="font-display font-bold text-lg" style={{ color: C.ink }}>Comentarios</h2>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white border grid place-items-center" style={{ borderColor: C.line }}><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-3 min-h-[30dvh]">
        {list === null ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: C.accent }} /></div>
          : list.length === 0 ? <p className="py-10 text-center text-sm" style={{ color: C.muted }}>Sé el primero en dejar un cariño 💛</p>
          : (
            <div className="space-y-3" data-testid="comments-list">
              {list.map((c) => (
                <div key={c.id} className="flex gap-2.5" data-testid={`comment-${c.id}`}>
                  <Avatar src={c.author.picture} name={c.author.name} size={32} />
                  <div className="flex-1 min-w-0 rounded-2xl bg-white border px-3 py-2" style={{ borderColor: C.card }}>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-xs truncate" style={{ color: C.ink }}>{c.mine ? "Tú" : c.author.name}</span>
                      <span className="text-[10px]" style={{ color: C.muted }}>{timeAgo(c.created_at)}</span>
                      <div className="flex-1" />
                      {c.can_delete && <button onClick={() => remove(c)} aria-label="Borrar comentario" data-testid={`comment-delete-${c.id}`}><Trash2 className="w-3.5 h-3.5" style={{ color: C.muted }} /></button>}
                    </div>
                    <p className="text-sm font-display whitespace-pre-wrap break-words" style={{ color: "#4A3B30" }}>{c.body}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
      </div>
      <div className="flex items-end gap-2 px-5 pt-2 pb-5 border-t" style={{ borderColor: C.line }}>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={1} data-testid="comment-input"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escribe un comentario…" className="flex-1 rounded-2xl border bg-white px-4 py-3 text-sm font-display resize-none outline-none" style={{ borderColor: C.line, color: C.ink }} />
        <button onClick={send} disabled={!text.trim() || busy} data-testid="comment-send"
          className="w-12 h-12 rounded-2xl grid place-items-center text-white disabled:opacity-50" style={{ background: C.accent }}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </Sheet>
  );
}

function FriendsTab({ overview, me, reload, setOverview }) {
  const [busyId, setBusyId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  if (!overview) return <div className="grid place-items-center py-16"><Loader2 className="w-7 h-7 animate-spin" style={{ color: C.accent }} /></div>;

  const act = async (id, fn, ok) => {
    setBusyId(id);
    try { await fn(); if (ok) toast.success(ok); reload(); }
    catch (e) { toast.error(errMsg(e, "No se pudo completar")); }
    finally { setBusyId(null); setConfirmRemove(null); }
  };
  const newLink = async () => {
    try { const r = await resetFriendCode(); setOverview((o) => ({ ...o, friend_code: r.friend_code })); toast.success("Enlace nuevo listo. El anterior ya no funciona."); }
    catch { toast.error("No se pudo crear un enlace nuevo"); }
  };

  return (
    <div className="space-y-6">
      <section className="p-5 rounded-3xl border" style={{ background: "#fff", borderColor: C.card }} data-testid="friends-invite-card">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5" style={{ color: C.accent }} />
          <h2 className="font-display font-bold" style={{ color: C.ink }}>Tu enlace para conectar</h2>
        </div>
        <p className="mt-1 text-sm" style={{ color: C.muted }}>Envíalo solo a quien quieras. Al abrirlo, quedan conectados y pueden ver lo que comparten entre ustedes.</p>
        {overview.friend_code && (
          <div className="mt-3 px-3 py-2 rounded-xl text-xs font-mono truncate" style={{ background: C.bg, color: C.muted }} data-testid="friends-invite-link">
            {inviteUrl(overview.friend_code)}
          </div>
        )}
        <button onClick={() => shareInvite(overview.friend_code, me?.name)} disabled={!overview.friend_code} data-testid="friends-invite-share"
          className="mt-3 w-full h-12 rounded-2xl font-display font-bold text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
          <UserPlus className="w-4 h-4" /> Invitar a un amigo
        </button>
        <button onClick={newLink} data-testid="friends-invite-reset" className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ color: C.muted }}>
          <RefreshCw className="w-3.5 h-3.5" /> Crear un enlace nuevo (el anterior deja de funcionar)
        </button>
        <p className="mt-3 text-[11px] text-center" style={{ color: C.muted }}>También puedes tocar “Conectar” en el álbum público de otra mascota.</p>
      </section>

      {overview.incoming.length > 0 && (
        <section data-testid="friends-incoming">
          <h3 className="font-display font-bold mb-2" style={{ color: C.ink }}>Quieren conectar contigo</h3>
          <div className="space-y-2.5">
            {overview.incoming.map((r) => (
              <PersonRow key={r.connection_id} owner={r.owner} sub={timeAgo(r.created_at)}>
                <button onClick={() => act(r.connection_id, () => acceptConnection(r.connection_id), `¡Ahora estás conectado con ${r.owner.name}! 🐾`)} disabled={busyId === r.connection_id}
                  data-testid={`friend-accept-${r.connection_id}`} className="px-3 h-9 rounded-full text-xs font-bold text-white" style={{ background: C.accent }}>Aceptar</button>
                <button onClick={() => act(r.connection_id, () => endConnection(r.connection_id))} disabled={busyId === r.connection_id}
                  data-testid={`friend-decline-${r.connection_id}`} className="w-9 h-9 rounded-full grid place-items-center border" style={{ borderColor: C.line }} aria-label="Rechazar"><X className="w-4 h-4" style={{ color: C.muted }} /></button>
              </PersonRow>
            ))}
          </div>
        </section>
      )}

      <section data-testid="friends-list">
        <h3 className="font-display font-bold mb-2" style={{ color: C.ink }}>Tus amigos {overview.friends.length > 0 && <span style={{ color: C.muted }}>({overview.friends.length})</span>}</h3>
        {overview.friends.length === 0 ? (
          <p className="text-sm p-4 rounded-2xl bg-white border text-center" style={{ borderColor: C.card, color: C.muted }}>Aún no tienes amigos en Petito. ¡Invita al primero! 🐶🐱</p>
        ) : (
          <div className="space-y-2.5">
            {overview.friends.map((f) => (
              <PersonRow key={f.connection_id} owner={f.owner} sub={f.owner.pets.length ? f.owner.pets.map((p) => p.name).join(", ") : "Dueño de Petito"}>
                {confirmRemove === f.connection_id ? (
                  <>
                    <button onClick={() => act(f.connection_id, () => endConnection(f.connection_id), "Ya no están conectados")} data-testid={`friend-remove-confirm-${f.connection_id}`}
                      className="px-3 h-9 rounded-full text-xs font-bold text-white" style={{ background: C.accent }}>Quitar</button>
                    <button onClick={() => setConfirmRemove(null)} className="px-2 h-9 text-xs font-bold" style={{ color: C.muted }}>No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmRemove(f.connection_id)} data-testid={`friend-remove-${f.connection_id}`}
                    className="px-3 h-9 rounded-full text-xs font-semibold border" style={{ borderColor: C.line, color: C.muted }}>Quitar</button>
                )}
              </PersonRow>
            ))}
          </div>
        )}
      </section>

      {overview.outgoing.length > 0 && (
        <section data-testid="friends-outgoing">
          <h3 className="font-display font-bold mb-2" style={{ color: C.ink }}>Solicitudes enviadas</h3>
          <div className="space-y-2.5">
            {overview.outgoing.map((r) => (
              <PersonRow key={r.connection_id} owner={r.owner} sub="Esperando respuesta">
                <button onClick={() => act(r.connection_id, () => endConnection(r.connection_id), "Solicitud cancelada")} data-testid={`friend-cancel-${r.connection_id}`}
                  className="px-3 h-9 rounded-full text-xs font-semibold border" style={{ borderColor: C.line, color: C.muted }}>Cancelar</button>
              </PersonRow>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PersonRow({ owner, sub, children }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border" style={{ borderColor: C.card }}>
      <div className="relative">
        <Avatar src={owner.picture} name={owner.name} size={44} />
        {owner.pets?.[0]?.photo_url && (
          <img src={mediaUrl(owner.pets[0].photo_url)} alt={owner.pets[0].name} className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-sm truncate" style={{ color: C.ink }}>{owner.name}</div>
        <div className="text-xs truncate" style={{ color: C.muted }}>{sub}</div>
      </div>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}
