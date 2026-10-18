import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/supabase";
import { getCurrentUser } from "@/lib/server/auth";

/** Supabase Auth PKCE callback: exchange the code, link/create the app user, return to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const sb = await createSessionClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      try { await getCurrentUser(req); } catch (e) { console.error("link app user", e); }
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/?auth=error", url.origin));
}
