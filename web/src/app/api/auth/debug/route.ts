import { cookies } from "next/headers";
import { createServiceClient, createSessionClient } from "@/lib/server/supabase";
import { env } from "@/lib/server/env";

/**
 * Sign-in diagnostics for the person calling it (no secrets): which step of
 * Google → Supabase → app account works. Open /api/auth/debug right after trying to sign in.
 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const names = (await cookies()).getAll().map((c) => c.name);
  const out: Record<string, unknown> = {
    site: origin,
    callback_url_to_allow_in_supabase: `${origin}/auth/callback`,
    supabase_url_configured: Boolean(env.supabaseUrl),
    anon_key_configured: Boolean(env.supabaseAnonKey),
    service_key_configured: Boolean(env.supabaseServiceKey),
    supabase_cookies: names.filter((n) => n.startsWith("sb-")),
  };
  try {
    const { data, error } = await (await createSessionClient()).auth.getUser();
    out.signed_in_as = data.user?.email ?? null;
    if (error) out.session_error = error.message;
    if (data.user) {
      const sb = createServiceClient();
      const { data: row, error: dbErr } = await sb.from("app_users").select("user_id, email, auth_user_id").ilike("email", data.user.email ?? "").maybeSingle();
      out.app_account = row ? { user_id: row.user_id, linked: row.auth_user_id === data.user.id } : null;
      if (dbErr) out.app_account_error = dbErr.message;
    }
  } catch (e: any) {
    out.error = String(e?.message ?? e).slice(0, 300);
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
