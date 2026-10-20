import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase Auth session cookie on every request (the @supabase/ssr pattern).
export async function proxy(request: NextRequest) {
  // Supabase falls back to the Site URL (e.g. "/?code=…") when the callback URL isn't in its allow-list.
  // Finish the sign-in anyway instead of silently dropping the code.
  const { pathname, searchParams } = request.nextUrl;
  if (searchParams.has("code") && pathname !== "/auth/callback" && !pathname.startsWith("/api/")) {
    const to = request.nextUrl.clone();
    to.pathname = "/auth/callback";
    to.search = "";
    to.searchParams.set("code", searchParams.get("code")!);
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip Next's own files (incl. the dev live-reload socket, which breaks if this runs on it) and static assets.
  matcher: ["/((?!_next/|favicon.ico|sw.js|manifest.json|icon-.*\\.png|apple-touch-icon\\.png|og-image\\.jpg|portrait-styles/).*)"],
};
