import { json } from "@/lib/server/http";
import { EMOTIONS } from "@/lib/catalogs";

export const GET = () => json({ emotions: EMOTIONS });
