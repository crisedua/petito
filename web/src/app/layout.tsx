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
  applicationName: "Petito",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Petito" },
  // What WhatsApp, Instagram, Facebook, X and iMessage show when someone shares a Petito link.
  openGraph: {
    type: "website",
    siteName: "Petito",
    locale: "es_CL",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/og-image.jpg"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#E05A47",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body>
        {/* Chrome/Edge/Samsung offer their install dialog once, early in page load; keep it for our "Agregar" buttons. */}
        <Script id="install-capture" strategy="beforeInteractive">{`
          window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); window.__petitoBIP = e; window.dispatchEvent(new Event("petito:bip")); });
          window.addEventListener("appinstalled", function () { window.__petitoInstalled = true; window.__petitoBIP = null; });
        `}</Script>
        <noscript>Necesitas activar JavaScript para usar Petito.</noscript>
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
