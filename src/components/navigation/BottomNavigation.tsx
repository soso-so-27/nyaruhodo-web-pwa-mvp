"use client";

import type { CSSProperties } from "react";

type BottomNavigationProps = {
  active: "today" | "cats";
};

export function BottomNavigation({ active }: BottomNavigationProps) {
  const items = [
    { key: "today", href: "/home", label: "今日", mark: "今" },
    { key: "record", href: "/home#record", label: "きろく", mark: "記" },
    { key: "cats", href: "/cats", label: "ねこ", mark: "猫" },
  ] as const;

  return (
    <nav style={styles.bottomNav} aria-label={"ホーム内ナビ"}>
      {items.map((item) => {
        const isActive = active === item.key;

        return (
          <a
            key={item.key}
            href={item.href}
            style={isActive ? styles.activeNavButton : styles.navButton}
          >
            <span
              style={isActive ? styles.activeNavMark : styles.navMark}
              aria-hidden="true"
            >
              {item.mark}
            </span>
            <span>{item.label}</span>
          </a>
        );
      })}
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
    gap: "7px",
    width: "min(calc(100% - 28px), 402px)",
    transform: "translateX(-50%)",
    border: "1px solid rgba(212, 212, 216, 0.9)",
    borderRadius: "26px",
    background: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 12px 30px rgba(39, 39, 42, 0.08)",
    padding: "7px",
    backdropFilter: "blur(14px)",
  },
  navButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    minHeight: "50px",
    borderRadius: "20px",
    background: "transparent",
    color: "#71717a",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeNavButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    minHeight: "50px",
    borderRadius: "20px",
    background: "#3f3f46",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  navMark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    background: "#f4f4f5",
    color: "#71717a",
    fontSize: "11px",
    fontWeight: 800,
    lineHeight: 1,
  },
  activeNavMark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.16)",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 800,
    lineHeight: 1,
  },
} satisfies Record<string, CSSProperties>;
