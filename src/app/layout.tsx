import "./globals.css";
import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppAnalyticsTracker } from "../components/analytics/AppAnalyticsTracker";
import { AppReferralTracker } from "../components/analytics/AppReferralTracker";
import { UserDeviceGate } from "../components/device/UserDeviceGate";
import { PhotoSwCacheController } from "../components/performance/PhotoSwCacheController";
import { PhotoStartupPrefetcher } from "../components/performance/PhotoStartupPrefetcher";
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
const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const startupImages = [
  { width: 320, height: 568, ratio: 2, file: "640-1136" },
  { width: 375, height: 667, ratio: 2, file: "750-1334" },
  { width: 414, height: 896, ratio: 2, file: "828-1792" },
  { width: 360, height: 780, ratio: 3, file: "1080-2340" },
  { width: 375, height: 812, ratio: 3, file: "1125-2436" },
  { width: 390, height: 844, ratio: 3, file: "1170-2532" },
  { width: 393, height: 852, ratio: 3, file: "1179-2556" },
  { width: 402, height: 874, ratio: 3, file: "1206-2622" },
  { width: 414, height: 736, ratio: 3, file: "1242-2208" },
  { width: 414, height: 896, ratio: 3, file: "1242-2688" },
  { width: 428, height: 926, ratio: 3, file: "1284-2778" },
  { width: 430, height: 932, ratio: 3, file: "1290-2796" },
  { width: 440, height: 956, ratio: 3, file: "1320-2868" },
] as const;
const startupHoldImage = "/splash/startup-envelope-hold-1206-2622-v1.webp";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ねてるねこ",
  description: "ねがおを一枚とると、よる8時にねこだよりがとどく、静かなアプリ",
  applicationName: "ねてるねこ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ねてるねこ",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: "/icon-envelope-v2-180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f1ea",
};

const criticalPageBackground = "#f4f1ea";
const criticalPaperBackground =
  "linear-gradient(180deg, rgba(241, 234, 223, 0.24) 0%, rgba(245, 236, 220, 0.14) 48%, rgba(231, 219, 200, 0.18) 100%), url('/images/home-backgrounds/paper-grain-tile.webp'), linear-gradient(180deg, #fbfaf7 0%, #f4f1ea 100%)";
const criticalPaperBackgroundSize = "100% 100%, 512px 512px, 100% 100%";
const criticalPaperBackgroundPosition = "50% 50%, 50% 50%, 50% 50%";
const criticalPaperBackgroundRepeat = "no-repeat, repeat, no-repeat";

const criticalHtmlStyle: CSSProperties = {
  background: criticalPaperBackground,
  backgroundColor: criticalPageBackground,
  backgroundSize: criticalPaperBackgroundSize,
  backgroundPosition: criticalPaperBackgroundPosition,
  backgroundRepeat: criticalPaperBackgroundRepeat,
  colorScheme: "light",
};

const criticalBodyStyle: CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  background: criticalPaperBackground,
  backgroundColor: criticalPageBackground,
  backgroundSize: criticalPaperBackgroundSize,
  backgroundPosition: criticalPaperBackgroundPosition,
  backgroundRepeat: criticalPaperBackgroundRepeat,
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
        {supabaseOrigin ? (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />
        ) : null}
        <meta name="color-scheme" content="light" />
        <link rel="apple-touch-icon" href="/icon-envelope-v2-180.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {startupImages.map((image) => (
          <link
            key={image.file}
            rel="apple-touch-startup-image"
            href={`/splash/startup-envelope-${image.file}-v3.png`}
            media={`screen and (device-width: ${image.width}px) and (device-height: ${image.height}px) and (-webkit-device-pixel-ratio: ${image.ratio}) and (orientation: portrait)`}
          />
        ))}
        {startupImages.map((image) => (
          <link
            key={`preload-startup-${image.file}`}
            rel="preload"
            as="image"
            href={`/splash/startup-envelope-${image.file}-v3.png`}
            media={`screen and (device-width: ${image.width}px) and (device-height: ${image.height}px) and (-webkit-device-pixel-ratio: ${image.ratio}) and (orientation: portrait)`}
            fetchPriority="high"
          />
        ))}
        <link
          rel="preload"
          as="image"
          href={startupHoldImage}
          fetchPriority="high"
        />
      </head>
      <body style={criticalBodyStyle}>
        <AppPaperTheme />
        <AppAnalyticsTracker />
        <AppReferralTracker />
        <PhotoSwCacheController />
        <PhotoStartupPrefetcher />
        <ServiceWorkerRegistrar />
        <UserDeviceGate>{children}</UserDeviceGate>
      </body>
    </html>
  );
}

function getOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
