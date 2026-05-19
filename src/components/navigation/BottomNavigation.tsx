"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type BottomNavigationProps = {
  active: "home" | "today" | "torisetu" | "collection" | "cats" | "together";
};

type NavItem = {
  key: "home" | "torisetu" | "collection" | "cats";
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
      label: "ホーム",
      icon: <HomeIcon />,
    },
    {
      key: "torisetu",
      href: "/torisetu",
      label: "トリセツ",
      icon: <BookIcon />,
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

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" style={styles.svgIcon}>
      <path
        d="M6.2 5.8h6.1c1 0 1.7.7 1.7 1.7v10.7c0-.8-.7-1.5-1.7-1.5H6.2z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M17.8 5.8h-3.8v12.4c0-.8.7-1.5 1.7-1.5h2.1z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M8.4 9.2h3.2M8.4 12h3.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CatIcon() {
  return (
    <svg viewBox="0 0 24 24" style={styles.svgIcon}>
      <path
        d="M7.4 9.4 7.1 6.1l2.8 1.7a7.2 7.2 0 0 1 4.2 0l2.8-1.7-.3 3.3a6.2 6.2 0 0 1 1.5 4c0 3.2-2.5 5.6-6.1 5.6s-6.1-2.4-6.1-5.6c0-1.5.5-2.9 1.5-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M9.3 13.1h.1M14.6 13.1h.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M10.3 15.5c.45.45 1 .68 1.7.68s1.25-.23 1.7-.68"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.55"
      />
      <path
        d="M4.5 12.8H7M17 12.8h2.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
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
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "4px",
    width: "min(calc(100% - 48px), 380px)",
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
    gap: "2px",
    minHeight: "44px",
    borderRadius: "18px",
    background: "transparent",
    color: "#777872",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeNavButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    minHeight: "44px",
    borderRadius: "18px",
    background: "#ecece7",
    color: "#3f433d",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 650,
    letterSpacing: 0,
    cursor: "pointer",
  },
  navIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    color: "#777872",
    lineHeight: 1,
  },
  activeNavIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    color: "#566052",
    lineHeight: 1,
  },
  svgIcon: {
    width: "19px",
    height: "19px",
    display: "block",
  },
} satisfies Record<string, CSSProperties>;
