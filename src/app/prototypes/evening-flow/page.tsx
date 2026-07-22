import type { Metadata } from "next";

import { EveningFlowPrototype } from "../../../components/prototypes/EveningFlowPrototype";

export const metadata: Metadata = {
  title: "よる8時の実機確認 | ねてるねこ",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EveningFlowPrototypePage() {
  return <EveningFlowPrototype />;
}
