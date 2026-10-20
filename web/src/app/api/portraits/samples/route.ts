import { handler, json } from "@/lib/server/http";
import { chosenSamples } from "@/lib/server/styleSamples";

/** style → sample image chosen by an admin (styles not listed use the built-in sample). */
export const GET = handler(async () => json(await chosenSamples()));
