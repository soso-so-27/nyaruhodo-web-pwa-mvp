import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "にゃるほど",
    short_name: "にゃるほど",
    description: "猫の様子から、飼い主の迷いを減らすアプリ",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#1a1a18",
    theme_color: "#1a1a18",
    lang: "ja",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable" as "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable" as "any",
      },
    ],
  };
}
