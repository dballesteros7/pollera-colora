import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { TzSync } from "./components/tz-sync";
import { Attribution } from "./components/shell";
import { getLocale, LOCALE_TAG } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const APP_URL = process.env.APP_URL ?? "https://pollera-colora.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Pollera Colorá",
  description: "La polla del Mundial 2026 para el parche · The Colombian World Cup prediction pool",
  icons: {
    icon: [{ url: "/emblem.svg", type: "image/svg+xml" }, { url: "/icon-512.png", sizes: "512x512" }],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Pollera Colorá",
    title: "Pollera Colorá",
    description: "La polla del Mundial 2026 para el parche · The Colombian World Cup prediction pool",
    url: APP_URL,
    locale: "es_CO",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Pollera Colorá" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pollera Colorá",
    description: "La polla del Mundial 2026 para el parche",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF3E2",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = LOCALE_TAG[await getLocale()];
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable}`}
    >
      <body>
        <TzSync />
        {children}
        <Attribution />
      </body>
    </html>
  );
}
