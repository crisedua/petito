/** Public site identity used in share previews (Open Graph / X cards) and page titles. */
export const SITE_URL = (process.env.PUBLIC_BASE_URL || "https://www.petito.pro").replace(/\/$/, "");
export const SITE_TITLE = "Petipo · El universo de tu mascota";
export const SITE_DESCRIPTION =
  "Dale voz a tu mascota en un video que habla, crea retratos e historias, guarda sus recuerdos y compártelos con tu gente. Pruébalo gratis.";
export const OG_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630, alt: "Petipo: el universo de tu mascota" };
