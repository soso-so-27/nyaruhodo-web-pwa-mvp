import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ねてるねこ",
    short_name: "ねてるねこ",
    description: "ねがおを一枚とると、よる8時にねこだよりがとどく、静かなアプリ",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#f4f1ea",
    lang: "ja",
    icons: [
      {
        src: "/icon-envelope-v2-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable" as "any",
      },
      {
        src: "/icon-envelope-v2-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable" as "any",
      },
    ],
  };
}
