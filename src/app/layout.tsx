import "./globals.css";
import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppAnalyticsTracker } from "../components/analytics/AppAnalyticsTracker";
import { AppReferralTracker } from "../components/analytics/AppReferralTracker";
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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://nyaruhodo-web-pwa-mvp.vercel.app",
  ),
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
  themeColor: "#f7f0e2",
};

const criticalPageBackground = "#f7f0e2";

const criticalHtmlStyle: CSSProperties = {
  backgroundColor: criticalPageBackground,
  colorScheme: "light",
};

const criticalBodyStyle: CSSProperties = {
  margin: 0,
  minHeight: "100vh",
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
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1170-2532.png"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1206-2622.png"
          media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1320-2868.png"
          media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1170-2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1179-2556.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1284-2778.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1290-2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1125-2436.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1242-2688.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-828-1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-750-1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-1242-2208.png"
          media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/v6/apple-splash-640-1136.png"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-envelope-v2-192.png" type="image/png" />
      </head>
      <body style={criticalBodyStyle}>
        <AppPaperTheme />
        <AppAnalyticsTracker />
        <AppReferralTracker />
        {children}
      </body>
    </html>
  );
}
