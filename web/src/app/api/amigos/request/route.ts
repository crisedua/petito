import { fail, handler, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { requestToOwner } from "@/lib/server/social";

/** "Conectar" from a public album: asks that pet's owner, who has to accept. */
export const POST = handler(async (req: Request) => {
  const me = await requireUser(req);
  const { pet_slug } = await readJson<{ pet_slug?: string }>(req);
  const { data: pet } = await db().from("pets").select("user_id").eq("share_slug", String(pet_slug ?? "")).eq("public_enabled", true).maybeSingle();
  if (!pet) throw fail(404, "Álbum no encontrado o privado");
  const c = await requestToOwner(me, pet.user_id);
  return json({ status: c.status, connection_id: c.id });
});
