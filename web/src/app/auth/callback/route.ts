import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/supabase";
import { getCurrentUser } from "@/lib/server/auth";

/** Supabase Auth PKCE callback: exchange the code, link/create the app user, return to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const saved = (await cookies()).get("petito_next")?.value;
  let next = url.searchParams.get("next") || "/";
  try { if (saved) next = decodeURIComponent(saved); } catch { /* malformed cookie: keep the query value */ }
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const fail = (reason: string) => {
    console.error("auth callback failed:", reason);
    const to = new URL("/", url.origin);
    to.searchParams.set("auth_error", reason.slice(0, 300));
    return clearNext(NextResponse.redirect(to));
  };

  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) return fail(providerError);
  if (!code) return fail("Google no devolvió el código de inicio de sesión");

  const sb = await createSessionClient();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    // Most common cause: sign-in started on one address and Supabase sent the person back to another
    // (its Site URL), so the browser no longer has the PKCE verifier for this code.
    if (/code verifier/i.test(error.message)) {
      return fail(`El inicio de sesión volvió a otra dirección. En Supabase → Authentication → URL Configuration agrega ${url.origin}/** a Redirect URLs y usa ${url.origin} como Site URL.`);
    }
    return fail(`No se pudo validar el inicio de sesión: ${error.message}`);
  }
  try {
    await getCurrentUser(req);
  } catch (e: any) {
    return fail(`Sesión iniciada, pero no pudimos crear tu cuenta: ${String(e?.message ?? e)}`);
  }
  return clearNext(NextResponse.redirect(new URL(safeNext, url.origin)));
}

function clearNext(res: NextResponse) {
  res.cookies.set("petito_next", "", { path: "/", maxAge: 0 });
  return res;
}
