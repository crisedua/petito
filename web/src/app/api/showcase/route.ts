import { handler } from "@/lib/server/http";
import { resolveShowcase } from "@/lib/server/showcase";

/** Public: the creations featured on the landing. */
export const GET = handler(async () =>
  new Response(JSON.stringify({ items: await resolveShowcase() }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
  }));
