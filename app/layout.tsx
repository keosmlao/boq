import localFont from "next/font/local";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "./_components/theme/ThemeProvider";
import { ThemeScript } from "./_components/theme/theme-script";
import { LanguageProvider } from "./_lib/i18n";

const notoSansLao = localFont({
  src: [
    {
      path: "./_fonts/NotoSansLao-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./_fonts/NotoSansLao-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./_fonts/NotoSansLao-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./_fonts/NotoSansLao-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-lao",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ODG Project Management",
    template: "%s | ODG Project Management",
  },
  description: "ODG project management system",
  applicationName: "ODG Project Management",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="lo" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${notoSansLao.className} ${notoSansLao.variable}`}>
        <ThemeProvider>
          {/* Locale lives at the root so logged-out routes (login, /download,
              404) honour the saved language too, not just the (app) group. */}
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
