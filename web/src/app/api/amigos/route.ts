import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { overview } from "@/lib/server/social";

export const GET = handler(async (req: Request) => json(await overview(await requireUser(req))));
