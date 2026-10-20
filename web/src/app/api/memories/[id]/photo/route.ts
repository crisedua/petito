import { photoRoute } from "@/lib/server/photoRoutes";
import { getMemory } from "@/lib/server/domain";
import { db } from "@/lib/server/db";

export const maxDuration = 60;
export const POST = photoRoute(getMemory, async (id, file) => { await db().from("memories").update({ photo_file: file }).eq("id", id); }, "memory");
