"use client";

import type { CSSProperties } from "react";

type BottomNavigationProps = {
  active: "today" | "cats";
};

export function BottomNavigation({ active }: BottomNavigationProps) {
  return (
    <nav style={styles.bottomNav} aria-label={"ホーム内ナビ"}>
      <a
        href="/home"
        style={active === "today" ? styles.activeNavButton : styles.navButton}
      >
        {"今日"}
      </a>
      <a href="/home#record" style={styles.navButton}>
        {"きろく"}
      </a>
      <a
        href="/cats"
        style={active === "cats" ? styles.activeNavButton : styles.navButton}
      >
        {"ねこ"}
      </a>
    </nav>
  );
}

const styles = {
  bottomNav: {
    position: "fixed",
    left: "50%",
    bottom: "calc(18px + env(safe-area-inset-bottom))",
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
    width: "min(calc(100% - 28px), 402px)",
    transform: "translateX(-50%)",
    border: "1px solid rgba(212, 212, 216, 0.9)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 12px 30px rgba(39, 39, 42, 0.08)",
    padding: "6px",
    backdropFilter: "blur(14px)",
  },
  navButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    borderRadius: "999px",
    background: "transparent",
    color: "#71717a",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeNavButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    borderRadius: "999px",
    background: "#3f3f46",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
