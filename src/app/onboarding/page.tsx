import type { Metadata } from "next";
import { OnboardingFlow } from "../../components/onboarding/OnboardingFlow";

const title = "ねてるねこ | ねこだよりが、よる8時にとどく";
const description =
  "じぶんの猫のねがおを1枚選ぶと、ほかの猫のねこだよりが最大4枚とどき、その中から1枚を「とどいた」に保存できるWebアプリです。";
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
