import { json } from "@/lib/server/http";
import { getCurrentUser, SUSPENDED_DETAIL, userPublic } from "@/lib/server/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return json({ detail: "Inicia sesión para continuar" }, 401);
    if (user.suspended_at) return json({ detail: SUSPENDED_DETAIL, suspended: true }, 403);
    return json(userPublic(user));
  } catch (e: any) {
    console.error("auth/me failed", e);
    return json({ detail: `No pudimos cargar tu cuenta: ${String(e?.message ?? e).slice(0, 200)}` }, 500);
  }
}
