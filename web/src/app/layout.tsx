import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { SwRegister } from "@/components/app/SwRegister";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { InstallPrompt } from "@/components/app/InstallPrompt";
import { Analytics } from "@/components/app/Analytics";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Petipop",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Petipop" },
  // What WhatsApp, Instagram, Facebook, X and iMessage show when someone shares a Petipop link.
  openGraph: {
    type: "website",
    siteName: "Petipop",
    locale: "es_CL",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/og-image.jpg?v=petipop"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#E05A47",
};

// Google Analytics 4 measurement ID; NEXT_PUBLIC_GA_ID overrides it.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-52CQL94LPY";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            {/* GA4 counts in-app navigation as page views by itself (browser history changes). */}
            <Script id="ga4" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}
        {/* Chrome/Edge/Samsung offer their install dialog once, early in page load; keep it for our "Agregar" buttons. */}
        <Script id="install-capture" strategy="beforeInteractive">{`
          window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__petitoBIP = e; window.dispatchEvent(new Event("petito:bip")); });
          window.addEventListener("appinstalled", function () { window.__petitoInstalled = true; window.__petitoBIP = null; });
        `}</Script>
        <noscript>Necesitas activar JavaScript para usar Petipop.</noscript>
        <div className="App">
          <Toaster position="top-center" richColors />
          <AuthProvider>{children}</AuthProvider>
          <SwRegister />
          <WhatsAppButton />
          <InstallPrompt />
          <Analytics />
        </div>
      </body>
    </html>
  );
}
