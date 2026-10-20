import { handler, json } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/auth";
import { db, iso } from "@/lib/server/db";

const LABEL: Record<string, string> = {
  visit: "Visita", view_feature: "Abrió sección", share_open: "Abrió enlace compartido", install: "Instaló la app",
  login: "Inició sesión", signup: "Cuenta nueva", photo_uploaded: "Subió foto", result_ready: "Resultado listo",
  paywall: "Vio el pago", checkout_started: "Fue a pagar", paid: "Pagó",
};

/** Latest funnel events, to check tracking works. Optional ?device= or ?name= filters. */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  const u = new URL(req.url).searchParams;
  let q = db().from("events").select("name, feature, device_id, user_id, props, created_at").order("created_at", { ascending: false }).limit(Math.min(Number(u.get("limit") ?? 40), 200));
  if (u.get("device")) q = q.eq("device_id", u.get("device")!);
  if (u.get("name")) q = q.eq("name", u.get("name")!);
  const { data, error } = await q;
  if (error) return json([]);
  const ids = [...new Set((data ?? []).map((e) => e.user_id).filter(Boolean))] as string[];
  const { data: users } = ids.length ? await db().from("app_users").select("user_id, email").in("user_id", ids) : { data: [] as any[] };
  const email = new Map((users ?? []).map((x) => [x.user_id, x.email]));
  return json((data ?? []).map((e) => ({
    name: e.name, label: LABEL[e.name] ?? e.name, feature: e.feature, device: e.device_id ? e.device_id.slice(0, 8) : null,
    device_id: e.device_id, user: e.user_id ? email.get(e.user_id) ?? e.user_id : null, props: e.props, created_at: iso(e.created_at),
  })));
});
