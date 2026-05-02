import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "にゃるほど",
  description: "猫の様子から、飼い主の迷いを減らすアプリ",
  applicationName: "にゃるほど",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "にゃるほど",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4a261",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
