import type { Metadata } from "next";
import { OnboardingFlow } from "../../components/onboarding/OnboardingFlow";

const title = "ねてるねこ | 4匹のねこから、気になる1匹を";
const description =
  "まず4匹のねこから気になる1匹を選び、あなたの猫の写真を1枚送って交換する、静かなWebアプリです。";
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
