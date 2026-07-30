import type { Metadata } from "next";
import { OnboardingFlow } from "../../components/onboarding/OnboardingFlow";

const title =
  "ねてるねこ | スマホには、撮った写真。ねてるねこには、自分で選んだ写真。";
const description =
  "うちの子の写真を1枚選んで「うちのこ」に保存。ねこくじで出会う4匹から目にとまった1匹を選ぶと、その日の「ねこだより」になります。猫に目をとめながら、うちの子らしさに気づいていくWebアプリです。";
const socialImage = "/images/social/onboarding-og.webp";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/onboarding",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/onboarding",
    siteName: "ねてるねこ",
    title,
    description,
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "ねてるねこのねこだよりのイラスト",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
