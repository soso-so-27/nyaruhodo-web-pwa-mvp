import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ねてるねこ",
    short_name: "ねてるねこ",
    description: "ねがおを撮ると、よる8時にねこだよりが届く猫の写真記録アプリ",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f7f0e2",
    theme_color: "#f7f0e2",
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
