import { signRoute } from "@/lib/server/photoRoutes";
import { getMemory } from "@/lib/server/domain";

export const POST = signRoute(getMemory);
