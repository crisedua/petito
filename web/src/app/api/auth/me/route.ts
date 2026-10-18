import { handler, json } from "@/lib/server/http";
import { requireUser, userPublic } from "@/lib/server/auth";

export const GET = handler(async (req: Request) => json(userPublic(await requireUser(req))));
