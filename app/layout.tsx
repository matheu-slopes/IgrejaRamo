import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

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

export const metadata: Metadata = {
  title: "Igreja Ramo da Vida",
  description: "Comunidade Igreja Ramo da Vida — Campinas, SP",
  metadataBase: new URL("https://ramodavida.vercel.app"),
  openGraph: {
    title: "Igreja Ramo da Vida",
    description: "Comunidade Igreja Ramo da Vida — Campinas, SP",
    url: "https://ramodavida.vercel.app",
    siteName: "Igreja Ramo da Vida",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Logo Igreja Ramo da Vida",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Igreja Ramo da Vida",
    description: "Comunidade Igreja Ramo da Vida — Campinas, SP",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${inter.variable} ${lora.variable}`}>
        <body className="bg-cream text-gray-900 antialiased font-sans" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
