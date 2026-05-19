import localFont from "next/font/local";
import "./globals.css";

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

export const metadata = {
  title: "ODG Project Management",
  description: "ODG project management system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="lo">
      <body className={`${notoSansLao.className} ${notoSansLao.variable}`}>
        {children}
      </body>
    </html>
  );
}
