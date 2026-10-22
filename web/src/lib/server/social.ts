/**
 * Amigos de Petipop: connections between owners and what they share with them.
 *
 * Rules: owners only see each other's shares once BOTH chose to connect (an invite link the owner
 * handed out, or a request the owner accepted). Emails are never shown to other owners. Removing a
 * connection hides everything both ways at once, because every read checks the connection again.
 */
import { randomBytes } from "node:crypto";
import { db, iso } from "./db";
import { fail } from "./http";
import { isoNow, newId } from "./ids";
import { mediaPath } from "./storage";
import { emotionLabels } from "./serializers";
import { plusByOwner, portraitThumb, videoThumb } from "./thumbs";
import { ALL_PORTRAIT_STYLES, THEMES } from "@/lib/catalogs";
import type { AppUser } from "./auth";

export const MAX_FRIENDS = 500;
export const REQUESTS_PER_DAY = 30;
export const COMMENTS_PER_DAY = 200;
export const NOTE_MAX = 280;
export const COMMENT_MAX = 500;
export const SHARE_KINDS = ["story", "portrait", "video", "memory"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export type Connection = { id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted"; created_at: string; accepted_at: string | null };

// ---------- owners as other owners see them ----------

type OwnerCard = { id: string; name: string; picture: string | null; pets: { name: string; species: string; photo_url: string | null }[] };

const firstName = (u: { name: string | null }) => (u.name ?? "").trim() || "Dueño de Petipop";

/** Name, picture and pets of each owner (no email). */
export async function ownerCards(userIds: string[]): Promise<Map<string, OwnerCard>> {
  const ids = [...new Set(userIds)].filter(Boolean);
  const out = new Map<string, OwnerCard>();
  if (!ids.length) return out;
  const [{ data: users }, { data: pets }] = await Promise.all([
    db().from("app_users").select("user_id, name, picture").in("user_id", ids),
    db().from("pets").select("id, user_id, name, species, photo_file, created_at").in("user_id", ids).order("created_at", { ascending: true }),
  ]);
  for (const u of users ?? []) out.set(u.user_id, { id: u.user_id, name: firstName(u), picture: u.picture, pets: [] });
  for (const p of pets ?? []) out.get(p.user_id)?.pets.push({ name: p.name, species: p.species, photo_url: p.photo_file ? mediaPath(p.id, p.photo_file) : null });
  return out;
}

// ---------- invite codes ----------

export async function friendCode(user: AppUser, reset = false): Promise<string> {
  if (!reset) {
    const { data } = await db().from("app_users").select("friend_code").eq("user_id", user.user_id).single();
    if (data?.friend_code) return data.friend_code;
  }
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(6).toString("hex");
    const { error } = await db().from("app_users").update({ friend_code: code }).eq("user_id", user.user_id);
    if (!error) return code;
  }
  throw new Error("could not create friend code");
}

export async function ownerByCode(code: string): Promise<string> {
  if (!/^[a-f0-9]{8,32}$/.test(code)) throw fail(404, "Enlace no válido");
  const { data } = await db().from("app_users").select("user_id").eq("friend_code", code).maybeSingle();
  if (!data) throw fail(404, "Este enlace ya no es válido. Pídele uno nuevo a tu amigo.");
  return data.user_id;
}

// ---------- connections ----------

export async function connectionBetween(a: string, b: string): Promise<Connection | null> {
  const { data } = await db().from("connections").select("*")
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`).maybeSingle();
  return (data as Connection) ?? null;
}

export async function friendIds(userId: string): Promise<string[]> {
  const { data } = await db().from("connections").select("requester_id, addressee_id")
    .eq("status", "accepted").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  return (data ?? []).map((c) => (c.requester_id === userId ? c.addressee_id : c.requester_id));
}

async function assertRoom(userId: string) {
  const { count } = await db().from("connections").select("id", { count: "exact", head: true })
    .eq("status", "accepted").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if ((count ?? 0) >= MAX_FRIENDS) throw fail(400, `Llegaste al máximo de ${MAX_FRIENDS} amigos`);
}

async function accept(c: Connection): Promise<Connection> {
  const patch = { status: "accepted" as const, accepted_at: isoNow() };
  await db().from("connections").update(patch).eq("id", c.id);
  return { ...c, ...patch };
}

/** Invite link: the owner who handed out the link already chose, so opening it connects right away. */
export async function connectByCode(me: AppUser, code: string): Promise<{ connection: Connection; owner: string }> {
  const owner = await ownerByCode(code);
  if (owner === me.user_id) throw fail(400, "Este es tu propio enlace. Compártelo con otros dueños.");
  const existing = await connectionBetween(me.user_id, owner);
  if (existing?.status === "accepted") return { connection: existing, owner };
  await assertRoom(me.user_id);
  await assertRoom(owner);
  if (existing) return { connection: await accept(existing), owner };
  const row: Connection = { id: newId(), requester_id: owner, addressee_id: me.user_id, status: "accepted", created_at: isoNow(), accepted_at: isoNow() };
  const { error } = await db().from("connections").insert(row);
  if (error) {
    const again = await connectionBetween(me.user_id, owner);
    if (again) return { connection: again.status === "accepted" ? again : await accept(again), owner };
    throw error;
  }
  return { connection: row, owner };
}

/** Request from a public album: the other owner has to accept. If they already asked me, it connects. */
export async function requestToOwner(me: AppUser, owner: string): Promise<Connection> {
  if (owner === me.user_id) throw fail(400, "Esta es tu propia mascota 🐾");
  const existing = await connectionBetween(me.user_id, owner);
  if (existing) {
    if (existing.status === "pending" && existing.addressee_id === me.user_id) return accept(existing);
    return existing;
  }
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db().from("connections").select("id", { count: "exact", head: true }).eq("requester_id", me.user_id).gte("created_at", since);
  if ((count ?? 0) >= REQUESTS_PER_DAY) throw fail(429, "Enviaste muchas solicitudes hoy. Intenta mañana.");
  await assertRoom(me.user_id);
  const row: Connection = { id: newId(), requester_id: me.user_id, addressee_id: owner, status: "pending", created_at: isoNow(), accepted_at: null };
  const { error } = await db().from("connections").insert(row);
  if (error) {
    const again = await connectionBetween(me.user_id, owner);
    if (again) return again;
    throw error;
  }
  return row;
}

export async function myConnection(me: AppUser, id: string): Promise<Connection> {
  const { data } = await db().from("connections").select("*").eq("id", id).maybeSingle();
  const c = data as Connection | null;
  if (!c || (c.requester_id !== me.user_id && c.addressee_id !== me.user_id)) throw fail(404, "Solicitud no encontrada");
  return c;
}

export async function acceptRequest(me: AppUser, id: string) {
  const c = await myConnection(me, id);
  if (c.status === "accepted") return c;
  if (c.addressee_id !== me.user_id) throw fail(403, "Solo quien recibe la solicitud puede aceptarla");
  await assertRoom(me.user_id);
  return accept(c);
}

/** Decline, cancel or remove: either side can end it. */
export async function endConnection(me: AppUser, id: string) {
  const c = await myConnection(me, id);
  await db().from("connections").delete().eq("id", c.id);
}

// ---------- shareable items ----------

type ItemCard = {
  kind: ShareKind; id: string; pet_id: string | null; title: string; subtitle: string | null;
  thumb_url: string | null; view_path: string | null; created_at: string | null;
  memory?: { feeling_text: string | null; happened_on: string | null; emotion_labels: ReturnType<typeof emotionLabels>; ai_reflection: string | null };
};
const key = (kind: string, id: string) => `${kind}:${id}`;

/**
 * Finished items as cards, keyed "kind:id". `ownerId` limits to one owner's items (used when sharing,
 * so nobody can share someone else's creation).
 */
export async function itemCards(refs: { kind: string; item_id: string }[], ownerId?: string): Promise<Map<string, ItemCard>> {
  const ids = (k: ShareKind) => [...new Set(refs.filter((r) => r.kind === k).map((r) => r.item_id))];
  const q = (table: string, list: string[], cols: string) => {
    if (!list.length) return Promise.resolve({ data: [] as any[] });
    let x = db().from(table).select(cols).in("id", list);
    if (ownerId) x = x.eq("user_id", ownerId);
    return x;
  };
  const [stories, portraits, videos, memories] = await Promise.all([
    q("stories", ids("story"), "id, share_slug, title, theme, status, pet_id, pet_name, created_at"),
    q("portraits", ids("portrait"), "id, user_id, share_slug, style, category, status, clean_file, pet_id, pet_name, created_at"),
    q("videos", ids("video"), "id, user_id, share_slug, line, status, mode, clean_file, pet_id, pet_name, created_at"),
    q("memories", ids("memory"), "id, pet_id, title, happened_on, date_unknown, feeling_text, emotions, photo_file, ai_reflection, created_at"),
  ]);
  const out = new Map<string, ItemCard>();
  const plus = await plusByOwner([...(portraits.data ?? []), ...(videos.data ?? [])].map((d: any) => d.user_id));
  for (const d of (stories.data ?? []) as any[]) {
    if (!["preview_ready", "paid"].includes(d.status)) continue;
    out.set(key("story", d.id), { kind: "story", id: d.id, pet_id: d.pet_id, title: d.title || `La historia de ${d.pet_name || "mi mascota"}`, subtitle: THEMES[d.theme]?.label ?? null, thumb_url: mediaPath(d.id, "slide_0.jpg"), view_path: `/h/${d.share_slug}`, created_at: iso(d.created_at) });
  }
  for (const d of (portraits.data ?? []) as any[]) {
    if (!["preview_ready", "paid"].includes(d.status)) continue;
    out.set(key("portrait", d.id), { kind: "portrait", id: d.id, pet_id: d.pet_id, title: d.pet_name ? `${d.pet_name}, ${(ALL_PORTRAIT_STYLES[d.style]?.label ?? "retrato").toLowerCase()}` : ALL_PORTRAIT_STYLES[d.style]?.label ?? "Retrato", subtitle: d.category === "memorial" ? "Homenaje" : "Retrato", thumb_url: portraitThumb(d, plus.get(d.user_id) ?? false), view_path: `/r/${d.share_slug}`, created_at: iso(d.created_at) });
  }
  for (const d of (videos.data ?? []) as any[]) {
    if (!["preview_ready", "paid"].includes(d.status) || d.mode !== "full") continue;
    out.set(key("video", d.id), { kind: "video", id: d.id, pet_id: d.pet_id, title: d.pet_name ? `${d.pet_name} habla` : "Video que habla", subtitle: d.line ?? null, thumb_url: videoThumb(d, plus.get(d.user_id) ?? false), view_path: `/v/${d.share_slug}`, created_at: iso(d.created_at) });
  }
  for (const m of (memories.data ?? []) as any[]) {
    out.set(key("memory", m.id), {
      kind: "memory", id: m.id, pet_id: m.pet_id, title: m.title || "Un recuerdo", subtitle: null,
      thumb_url: m.photo_file ? mediaPath(m.id, m.photo_file) : null, view_path: null, created_at: iso(m.created_at),
      memory: { feeling_text: m.feeling_text, happened_on: m.date_unknown ? null : m.happened_on, emotion_labels: emotionLabels(m.emotions), ai_reflection: m.ai_reflection },
    });
  }
  return out;
}

/** Everything the owner could share, newest first, marked if already shared. */
export async function shareOptions(me: AppUser) {
  const uid = me.user_id;
  const [s, p, v, m, shared] = await Promise.all([
    db().from("stories").select("id").eq("user_id", uid).in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(100),
    db().from("portraits").select("id").eq("user_id", uid).in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(100),
    db().from("videos").select("id").eq("user_id", uid).eq("mode", "full").in("status", ["preview_ready", "paid"]).order("created_at", { ascending: false }).limit(100),
    db().from("memories").select("id").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
    db().from("shares").select("kind, item_id").eq("user_id", uid),
  ]);
  const refs = [
    ...(s.data ?? []).map((d) => ({ kind: "story", item_id: d.id })),
    ...(p.data ?? []).map((d) => ({ kind: "portrait", item_id: d.id })),
    ...(v.data ?? []).map((d) => ({ kind: "video", item_id: d.id })),
    ...(m.data ?? []).map((d) => ({ kind: "memory", item_id: d.id })),
  ];
  const cards = await itemCards(refs, uid);
  const done = new Set((shared.data ?? []).map((x) => key(x.kind, x.item_id)));
  return [...cards.values()]
    .map((c) => ({ ...c, already_shared: done.has(key(c.kind, c.id)) }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

// ---------- shares, hearts, comments ----------

export type ShareRow = { id: string; user_id: string; pet_id: string | null; kind: ShareKind; item_id: string; note: string | null; created_at: string };

export async function createShare(me: AppUser, kind: string, itemId: string, note: unknown): Promise<{ share: ShareRow; created: boolean }> {
  if (!SHARE_KINDS.includes(kind as ShareKind) || typeof itemId !== "string" || !itemId) throw fail(400, "Elige qué compartir");
  const card = (await itemCards([{ kind, item_id: itemId }], me.user_id)).get(key(kind, itemId));
  if (!card) throw fail(404, "No encontramos esa creación, o aún no está lista");
  const text = typeof note === "string" ? note.trim().slice(0, NOTE_MAX) || null : null;
  const { data: existing } = await db().from("shares").select("*").eq("user_id", me.user_id).eq("kind", kind).eq("item_id", itemId).maybeSingle();
  if (existing) {
    if (text !== null && text !== existing.note) await db().from("shares").update({ note: text }).eq("id", existing.id);
    return { share: { ...(existing as ShareRow), note: text ?? existing.note }, created: false };
  }
  const row: ShareRow = { id: newId(), user_id: me.user_id, pet_id: card.pet_id, kind: kind as ShareKind, item_id: itemId, note: text, created_at: isoNow() };
  const { error } = await db().from("shares").insert(row);
  if (error) throw error;
  return { share: row, created: true };
}

/** A share the viewer may see: their own, or a connection's. */
export async function visibleShare(me: AppUser, shareId: string): Promise<ShareRow> {
  const { data } = await db().from("shares").select("*").eq("id", shareId).maybeSingle();
  const s = data as ShareRow | null;
  if (!s) throw fail(404, "Publicación no encontrada");
  if (s.user_id !== me.user_id) {
    const c = await connectionBetween(me.user_id, s.user_id);
    if (c?.status !== "accepted") throw fail(404, "Publicación no encontrada");
  }
  return s;
}

export async function deleteShare(me: AppUser, shareId: string) {
  const { data } = await db().from("shares").select("user_id").eq("id", shareId).maybeSingle();
  if (!data || data.user_id !== me.user_id) throw fail(404, "Publicación no encontrada");
  await db().from("shares").delete().eq("id", shareId);
}

export async function toggleHeart(me: AppUser, shareId: string) {
  await visibleShare(me, shareId);
  const { data: mine } = await db().from("share_reactions").select("share_id").eq("share_id", shareId).eq("user_id", me.user_id).maybeSingle();
  if (mine) await db().from("share_reactions").delete().eq("share_id", shareId).eq("user_id", me.user_id);
  else await db().from("share_reactions").upsert({ share_id: shareId, user_id: me.user_id, created_at: isoNow() }, { onConflict: "share_id,user_id", ignoreDuplicates: true });
  const { count } = await db().from("share_reactions").select("share_id", { count: "exact", head: true }).eq("share_id", shareId);
  return { hearted: !mine, hearts: count ?? 0 };
}

export async function listComments(me: AppUser, shareId: string) {
  const share = await visibleShare(me, shareId);
  const { data } = await db().from("share_comments").select("*").eq("share_id", shareId).order("created_at", { ascending: true }).limit(300);
  const cards = await ownerCards((data ?? []).map((c) => c.user_id));
  return (data ?? []).map((c) => ({
    id: c.id, body: c.body, created_at: iso(c.created_at),
    author: { id: c.user_id, name: cards.get(c.user_id)?.name ?? "Dueño de Petipop", picture: cards.get(c.user_id)?.picture ?? null },
    mine: c.user_id === me.user_id,
    can_delete: c.user_id === me.user_id || share.user_id === me.user_id,
  }));
}

export async function addComment(me: AppUser, shareId: string, body: unknown) {
  await visibleShare(me, shareId);
  const text = typeof body === "string" ? body.trim().slice(0, COMMENT_MAX) : "";
  if (!text) throw fail(400, "Escribe un comentario");
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db().from("share_comments").select("id", { count: "exact", head: true }).eq("user_id", me.user_id).gte("created_at", since);
  if ((count ?? 0) >= COMMENTS_PER_DAY) throw fail(429, "Comentaste mucho hoy. Intenta mañana.");
  const row = { id: newId(), share_id: shareId, user_id: me.user_id, body: text, created_at: isoNow() };
  const { error } = await db().from("share_comments").insert(row);
  if (error) throw error;
  return row;
}

/** The comment's author, or the owner of the post it's on, can delete it. */
export async function deleteComment(me: AppUser, shareId: string, commentId: string) {
  const { data: c } = await db().from("share_comments").select("id, user_id, share_id").eq("id", commentId).eq("share_id", shareId).maybeSingle();
  if (!c) throw fail(404, "Comentario no encontrado");
  if (c.user_id !== me.user_id) {
    const { data: s } = await db().from("shares").select("user_id").eq("id", shareId).maybeSingle();
    if (s?.user_id !== me.user_id) throw fail(403, "No puedes borrar este comentario");
  }
  await db().from("share_comments").delete().eq("id", commentId);
}

/** Newest shares from the viewer and their connections, with item, pet, owner, hearts and comment counts. */
export async function feed(me: AppUser, before?: string | null, limit = 20) {
  const authors = [me.user_id, ...(await friendIds(me.user_id))];
  let q = db().from("shares").select("*").in("user_id", authors).order("created_at", { ascending: false }).limit(limit + 10);
  if (before && !Number.isNaN(Date.parse(before))) q = q.lt("created_at", new Date(before).toISOString());
  const { data } = await q;
  const rows = (data ?? []) as ShareRow[];
  const [items, owners, pets] = await Promise.all([
    itemCards(rows.map((r) => ({ kind: r.kind, item_id: r.item_id }))),
    ownerCards(rows.map((r) => r.user_id)),
    rows.some((r) => r.pet_id)
      ? db().from("pets").select("id, name, photo_file").in("id", [...new Set(rows.map((r) => r.pet_id).filter(Boolean))] as string[]).then((r) => r.data ?? [])
      : Promise.resolve([] as any[]),
  ]);
  // Items deleted since they were shared drop out of the feed.
  const live = rows.filter((r) => items.has(key(r.kind, r.item_id))).slice(0, limit);
  const ids = live.map((r) => r.id);
  const [hearts, comments] = ids.length
    ? await Promise.all([
        db().from("share_reactions").select("share_id, user_id").in("share_id", ids).then((r) => r.data ?? []),
        db().from("share_comments").select("share_id").in("share_id", ids).then((r) => r.data ?? []),
      ])
    : [[], []];
  const petMap = new Map(pets.map((p: any) => [p.id, { name: p.name, photo_url: p.photo_file ? mediaPath(p.id, p.photo_file) : null }]));
  const out = live.map((r) => {
    const o = owners.get(r.user_id);
    return {
      id: r.id, kind: r.kind, note: r.note, created_at: iso(r.created_at), mine: r.user_id === me.user_id,
      owner: { id: r.user_id, name: o?.name ?? "Dueño de Petipop", picture: o?.picture ?? null },
      pet: r.pet_id ? petMap.get(r.pet_id) ?? null : null,
      item: items.get(key(r.kind, r.item_id)),
      hearts: hearts.filter((h: any) => h.share_id === r.id).length,
      hearted: hearts.some((h: any) => h.share_id === r.id && h.user_id === me.user_id),
      comments: comments.filter((c: any) => c.share_id === r.id).length,
    };
  });
  const more = rows.length >= limit + 10 || live.length === limit;
  return { items: out, next_before: more ? out[out.length - 1]?.created_at ?? null : null, friends: authors.length - 1 };
}

/** Friends, pending requests both ways, and my invite code. */
export async function overview(me: AppUser) {
  const { data } = await db().from("connections").select("*").or(`requester_id.eq.${me.user_id},addressee_id.eq.${me.user_id}`).order("created_at", { ascending: false });
  const rows = (data ?? []) as Connection[];
  const other = (c: Connection) => (c.requester_id === me.user_id ? c.addressee_id : c.requester_id);
  const cards = await ownerCards(rows.map(other));
  const card = (c: Connection) => cards.get(other(c)) ?? { id: other(c), name: "Dueño de Petipop", picture: null, pets: [] };
  return {
    friend_code: await friendCode(me),
    friends: rows.filter((c) => c.status === "accepted").map((c) => ({ connection_id: c.id, since: iso(c.accepted_at ?? c.created_at), owner: card(c) })),
    incoming: rows.filter((c) => c.status === "pending" && c.addressee_id === me.user_id).map((c) => ({ connection_id: c.id, created_at: iso(c.created_at), owner: card(c) })),
    outgoing: rows.filter((c) => c.status === "pending" && c.requester_id === me.user_id).map((c) => ({ connection_id: c.id, created_at: iso(c.created_at), owner: card(c) })),
  };
}

export async function pendingCount(me: AppUser) {
  const { count } = await db().from("connections").select("id", { count: "exact", head: true }).eq("addressee_id", me.user_id).eq("status", "pending");
  return count ?? 0;
}
