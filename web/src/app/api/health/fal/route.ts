import { handler, json } from "@/lib/server/http";
import { falKeyCheck } from "@/lib/server/fal";

// Public: does fal.ai accept our key right now? (no generation, no cost; never returns the key)
export const GET = handler(async () => json(await falKeyCheck()));
