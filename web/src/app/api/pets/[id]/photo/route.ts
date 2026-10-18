import { photoRoute } from "@/lib/server/photoRoutes";
import { getPet } from "@/lib/server/domain";
import { db } from "@/lib/server/db";

export const maxDuration = 60;
export const POST = photoRoute(getPet, async (id, file) => { await db().from("pets").update({ photo_file: file }).eq("id", id); });
