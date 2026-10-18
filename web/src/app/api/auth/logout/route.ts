import { handler, json } from "@/lib/server/http";
import { createSessionClient } from "@/lib/server/supabase";

export const POST = handler(async () => {
  const sb = await createSessionClient();
  await sb.auth.signOut();
  return json({ ok: true });
});
