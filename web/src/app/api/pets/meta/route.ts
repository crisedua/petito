import { json } from "@/lib/server/http";
import { PERSONALITY_OPTIONS, SPECIES } from "@/lib/catalogs";

export const GET = () =>
  json({ species: Object.entries(SPECIES).map(([key, label]) => ({ key, label })), personality_options: PERSONALITY_OPTIONS });
