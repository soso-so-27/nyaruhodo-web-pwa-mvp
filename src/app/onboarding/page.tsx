import type { Metadata } from "next";
import { OnboardingFlow } from "../../components/onboarding/OnboardingFlow";

const title = "ねてるねこ | 猫の寝顔が、よる8時にとどく";
const description =
  "じぶんの猫の寝顔を一枚入れると、知らないおうちの猫の寝顔が一通とどく、静かなWebアプリです。";
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
        alt: "猫の封蝋がついた、ねてるねこのねこだより",
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
