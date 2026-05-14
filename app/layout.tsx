import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import PwaUpdater from "@/components/PwaUpdater";
import AppLifecycleSync from "@/components/AppLifecycleSync";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#1a2e1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Igreja Ramo da Vida",
  description: "Comunidade Igreja Ramo da Vida — Campinas, SP",
  metadataBase: new URL("https://ramodavida.vercel.app"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ramo da Vida",
    startupImage: [
      {
        url: "/icons/icon-512x512.png",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Igreja Ramo da Vida",
    description: "Comunidade Igreja Ramo da Vida — Campinas, SP",
    url: "https://ramodavida.vercel.app",
    siteName: "Igreja Ramo da Vida",
    images: [
      {
        url: "/opengraph-image",
        width: 600,
        height: 600,
        alt: "Logo Igreja Ramo da Vida",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Igreja Ramo da Vida",
    description: "Comunidade Igreja Ramo da Vida — Campinas, SP",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${inter.variable} ${lora.variable}`}>
      <head>
        {/* iOS standalone — esconde barra de endereço e UI do browser */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Garante área segura (notch/dynamic island) */}
        <meta name="theme-color" content="#1a2e1a" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
        <body className="bg-cream text-gray-900 antialiased font-sans" suppressHydrationWarning>
        <PwaUpdater />
        <AppLifecycleSync />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
