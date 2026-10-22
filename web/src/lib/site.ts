/** Public site identity used in share previews (Open Graph / X cards) and page titles. */
export const SITE_URL = (process.env.PUBLIC_BASE_URL || "https://www.petipop.pro").replace(/\/$/, "");
export const SITE_TITLE = "Petipop · El universo de tu mascota";
export const SITE_DESCRIPTION =
  "Dale voz a tu mascota en un video que habla, crea retratos e historias, guarda sus recuerdos y compártelos con tu gente. Pruébalo gratis.";
export const OG_IMAGE = { url: "/og-image.jpg?v=petipop", width: 1200, height: 630, alt: "Petipop: el universo de tu mascota" };
