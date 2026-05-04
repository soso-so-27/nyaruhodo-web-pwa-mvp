"use client";

import type { CSSProperties, ReactNode } from "react";

type BottomNavigationProps = {
  active: "today" | "cats";
};

type NavItem = {
  key: "today" | "cats";
  href: string;
  label: string;
  icon: ReactNode;
};

export function BottomNavigation({ active }: BottomNavigationProps) {
  const items: readonly NavItem[] = [
    {
      key: "today",
      href: "/home",
      label: "今日",
      icon: <HomeIcon />,
    },
    {
      key: "cats",
      href: "/cats",
      label: "ねこ",
      icon: <CatIcon />,
    },
  ];

  return (
    <nav style={styles.bottomNav} aria-label="ホーム内ナビ">
      {items.map((item) => {
        const isActive = active === item.key;

        return (
          <a
            key={item.key}
            href={item.href}
            style={isActive ? styles.activeNavButton : styles.navButton}
          >
            <span
              style={isActive ? styles.activeNavIcon : styles.navIcon}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" style={styles.svgIcon}>
      <path
        d="M4.5 11.2 12 5l7.5 6.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M7.2 10.6v7.2h9.6v-7.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CatIcon() {
  return (
    <svg viewBox="0 0 24 24" style={styles.svgIcon}>
      <path
        d="M7.2 9.2 6.5 5.5l3.2 2a7.6 7.6 0 0 1 4.6 0l3.2-2-.7 3.7a6.5 6.5 0 0 1 1.4 4.1c0 3.6-2.8 6-6.2 6s-6.2-2.4-6.2-6c0-1.6.5-3 1.4-4.1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M9.2 13.5h.1M14.7 13.5h.1M11 16.2c.7.5 1.3.5 2 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

const styles = {
  bottomNav: {
    position: "fixed",
    left: "50%",
    bottom: "calc(18px + env(safe-area-inset-bottom))",
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "8px",
    width: "min(calc(100% - 96px), 280px)",
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
  navIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    color: "#71717a",
    lineHeight: 1,
  },
  activeNavIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    color: "#ffffff",
    lineHeight: 1,
  },
  svgIcon: {
    width: "21px",
    height: "21px",
    display: "block",
  },
} satisfies Record<string, CSSProperties>;
