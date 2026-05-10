"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type BottomNavigationProps = {
  active: "home" | "today" | "collection" | "cats" | "together";
};

type NavItem = {
  key: "home" | "collection" | "cats";
  href: string;
  label: string;
  icon: ReactNode;
};

export function BottomNavigation({ active }: BottomNavigationProps) {
  const activeKey =
    active === "today" ? "home" : active === "together" ? "collection" : active;
  const items: readonly NavItem[] = [
    {
      key: "home",
      href: "/home",
      label: "今日",
      icon: <HomeIcon />,
    },
    {
      key: "collection",
      href: "/collection",
      label: "コレクション",
      icon: <CollectionIcon />,
    },
    {
      key: "cats",
      href: "/cats",
      label: "ねこ",
      icon: <CatIcon />,
    },
  ];

  return (
    <nav style={styles.bottomNav} aria-label="下部ナビ">
      {items.map((item) => {
        const isActive = activeKey === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={true}
            style={isActive ? styles.activeNavButton : styles.navButton}
          >
            <span
              style={isActive ? styles.activeNavIcon : styles.navIcon}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
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

function CollectionIcon() {
  return (
    <svg viewBox="0 0 24 24" style={styles.svgIcon}>
      <path
        d="M6.2 8.2h11.6v10H6.2z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path
        d="M8.6 8.2 10 5.8h4l1.4 2.4M9.2 12.1h5.6M9.2 15h3.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

const styles = {
  bottomNav: {
    position: "fixed",
    left: "50%",
    bottom: "calc(14px + env(safe-area-inset-bottom))",
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "4px",
    width: "min(calc(100% - 72px), 326px)",
    transform: "translateX(-50%)",
    border: "1px solid rgba(200, 197, 190, 0.9)",
    borderRadius: "24px",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow:
      "0 -2px 0 rgba(200,197,190,0.3), 0 8px 24px rgba(52, 50, 46, 0.12)",
    padding: "5px",
    backdropFilter: "blur(20px)",
  },
  navButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1px",
    minHeight: "42px",
    borderRadius: "18px",
    background: "transparent",
    color: "#777872",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeNavButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1px",
    minHeight: "42px",
    borderRadius: "18px",
    background: "#ecece7",
    color: "#3f433d",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 650,
    letterSpacing: 0,
    cursor: "pointer",
  },
  navIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "19px",
    height: "19px",
    color: "#777872",
    lineHeight: 1,
  },
  activeNavIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "19px",
    height: "19px",
    color: "#566052",
    lineHeight: 1,
  },
  svgIcon: {
    width: "18px",
    height: "18px",
    display: "block",
  },
} satisfies Record<string, CSSProperties>;
