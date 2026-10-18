import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { shareOptions } from "@/lib/server/social";

export const GET = handler(async (req: Request) => json(await shareOptions(await requireUser(req))));
