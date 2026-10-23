import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search engines index the public pages; the API, admin and personal areas stay out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/perfil", "/mis-creaciones", "/universo", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
