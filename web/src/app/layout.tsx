import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { SwRegister } from "@/components/app/SwRegister";
import { WhatsAppButton } from "@/components/app/WhatsAppButton";
import { InstallPrompt } from "@/components/app/InstallPrompt";
import "./globals.css";

export const metadata: Metadata = {
  title: "Petito · Tu mascota cuenta su historia",
  description: "Petito: tu mascota cuenta su historia. Crea una historia vertical con humor chileno en segundos.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Petito" },
  openGraph: {
    title: "Petito · Tu mascota cuenta su historia",
    description: "Crea una historia vertical de tu mascota con humor chileno.",
    type: "website",
  },
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
        <noscript>Necesitas activar JavaScript para usar Petito.</noscript>
        <div className="App">
          <Toaster position="top-center" richColors />
          <AuthProvider>{children}</AuthProvider>
          <SwRegister />
          <WhatsAppButton />
          <InstallPrompt />
        </div>
      </body>
    </html>
  );
}
