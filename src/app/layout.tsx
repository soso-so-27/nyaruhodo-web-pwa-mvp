import "./globals.css";
import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppAnalyticsTracker } from "../components/analytics/AppAnalyticsTracker";
import { AppReferralTracker } from "../components/analytics/AppReferralTracker";
import { ServiceWorkerRegistrar } from "../components/pwa/ServiceWorkerRegistrar";
import { AppPaperTheme } from "../components/ui/AppPaperTheme";

const kleeOne = localFont({
  src: [
    {
      path: "../../public/fonts/klee-one-400-subset.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/klee-one-600-subset.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-klee-one",
  display: "swap",
});

const zenKakuGothicNew = localFont({
  src: [
    {
      path: "../../public/fonts/zen-kaku-gothic-new-400-subset.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/zen-kaku-gothic-new-500-subset.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-zen-kaku",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://nyaruhodo-web-pwa-mvp.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ねてるねこ",
  description: "ねがおを撮ると、よる8時にねこだよりが届く猫の写真記録アプリ",
  applicationName: "ねてるねこ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ねてるねこ",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-envelope-v2-192.png", type: "image/png" },
    ],
    apple: "/icon-envelope-v2-180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eadfce",
};

const criticalPageBackground = "#eadfce";
const criticalPaperBackground =
  "radial-gradient(78% 48% at 12% 5%, rgba(225, 158, 134, 0.28), transparent 64%), radial-gradient(72% 44% at 92% 100%, rgba(145, 165, 194, 0.24), transparent 66%), linear-gradient(180deg, #efe3d3 0%, #e9ddce 52%, #ded5c8 100%)";

const criticalHtmlStyle: CSSProperties = {
  background: criticalPaperBackground,
  backgroundColor: criticalPageBackground,
  colorScheme: "light",
};

const criticalBodyStyle: CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  background: criticalPaperBackground,
  backgroundColor: criticalPageBackground,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${kleeOne.variable} ${zenKakuGothicNew.variable}`}
      style={criticalHtmlStyle}
    >
      <head>
        <link rel="apple-touch-icon" href="/icon-envelope-v2-180.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-envelope-v2-192.png" type="image/png" />
      </head>
      <body style={criticalBodyStyle}>
        <AppPaperTheme />
        <AppAnalyticsTracker />
        <AppReferralTracker />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
