"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  BookIcon,
  CatIcon,
  CollectionIcon,
  HomeIcon,
} from "../ui/AppIcons";

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
      icon: <HomeIcon style={styles.svgIcon} />,
    },
    {
      key: "torisetu",
      href: "/torisetu",
      label: "トリセツ",
      icon: <BookIcon style={styles.svgIcon} />,
    },
    {
      key: "collection",
      href: "/collection",
      label: "コレクション",
      icon: <CollectionIcon style={styles.svgIcon} />,
    },
    {
      key: "cats",
      href: "/cats",
      label: "ねこ",
      icon: <CatIcon style={styles.svgIcon} />,
    },
  ];

  return (
    <nav style={styles.bottomNav} aria-label="下部ナビゲーション">
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

const styles = {
  bottomNav: {
    position: "fixed",
    left: "50%",
    bottom: "calc(12px + env(safe-area-inset-bottom))",
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "4px",
    width: "min(calc(100% - 28px), 410px)",
    transform: "translateX(-50%)",
    border: "1px solid rgba(200, 197, 190, 0.9)",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow:
      "0 -2px 0 rgba(200,197,190,0.3), 0 8px 24px rgba(52, 50, 46, 0.12)",
    padding: "4px",
    backdropFilter: "blur(20px)",
  },
  navButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    minHeight: "42px",
    borderRadius: "17px",
    background: "transparent",
    color: "#777872",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 560,
    letterSpacing: 0,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  activeNavButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    minHeight: "42px",
    borderRadius: "17px",
    background: "#ecece7",
    color: "#3f433d",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: 0,
    whiteSpace: "nowrap",
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
