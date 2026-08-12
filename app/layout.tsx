import localFont from "next/font/local";
import { Montserrat } from "next/font/google";
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

/**
 * Montserrat — the brand's Latin typeface (Brand Guideline p.06: ExtraLight /
 * Regular / Medium / Bold / Black). Listed BEFORE the Lao face in --font-sans so
 * Latin text and numerals render in Montserrat while Lao glyphs, which it does
 * not carry, fall through to Noto Sans Lao.
 *
 * Lao stays on Noto Sans Lao (the local files above) by decision — the
 * guideline names BoonHome, but Noto Sans Lao is what this system ships and
 * renders correctly across the app.
 */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["200", "400", "500", "700", "900"],
  variable: "--font-latin",
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
      {/* Only the CSS variables — not notoSansLao.className. That class sets
          font-family directly and, being a class, outranks the `body` rule in
          globals.css, which would pin every Latin glyph to the Lao face. */}
      <body className={`${notoSansLao.variable} ${montserrat.variable}`}>
        <ThemeProvider>
          {/* Locale lives at the root so logged-out routes (login, /download,
              404) honour the saved language too, not just the (app) group. */}
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
