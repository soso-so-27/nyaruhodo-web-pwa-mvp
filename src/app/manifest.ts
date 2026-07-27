import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ねてるねこ",
    short_name: "ねてるねこ",
    description:
      "うちの猫のねがおを残すと、よる8時ごろ4匹のねこがとどき、気になる1匹を「ねこだより」に残せるアプリ",
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
