import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "にゃるほど",
    short_name: "にゃるほど",
    description: "猫の様子から、飼い主の迷いを減らすアプリ",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#f4a261",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
