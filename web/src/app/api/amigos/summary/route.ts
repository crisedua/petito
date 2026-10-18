import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { pendingCount } from "@/lib/server/social";

export const GET = handler(async (req: Request) => json({ pending: await pendingCount(await requireUser(req)) }));
