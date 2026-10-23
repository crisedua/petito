import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The public entry points: the landing page and each feature someone can try.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/probar", "/hablar", "/retrato", "/crear", "/recuerdo", "/plus"].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
