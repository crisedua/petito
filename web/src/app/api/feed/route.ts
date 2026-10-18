import { handler, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { feed } from "@/lib/server/social";

export const GET = handler(async (req: Request) => {
  const me = await requireUser(req);
  return json(await feed(me, new URL(req.url).searchParams.get("before")));
});
