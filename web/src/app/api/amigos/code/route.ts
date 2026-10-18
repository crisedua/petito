import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { friendCode } from "@/lib/server/social";

/** New invite link; the old one stops working. */
export const POST = handler(async (req: Request) => json({ friend_code: await friendCode(await requireUser(req), true) }));
