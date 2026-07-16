import type { CSSProperties } from "react";

export const tayoriPhotoFrameStyles = {
  frame: {
    border: "1px solid rgba(255, 255, 255, 0.84)",
    borderRadius: 0,
    background: "var(--paper-card)",
    boxShadow: "0 5px 8px rgba(72, 58, 39, 0.16)",
  },
  image: {
    display: "block",
    borderRadius: 0,
  },
} satisfies Record<string, CSSProperties>;
