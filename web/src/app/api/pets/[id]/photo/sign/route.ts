import { signRoute } from "@/lib/server/photoRoutes";
import { getPet } from "@/lib/server/domain";

export const POST = signRoute(getPet);
