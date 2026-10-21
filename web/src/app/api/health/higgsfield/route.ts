import { handler, json } from "@/lib/server/http";
import { keyCheck } from "@/lib/server/higgsfield";

// Public: does Higgsfield accept our key right now? (asks for an upload URL; nothing generated or charged)
export const GET = handler(async () => json(await keyCheck()));
