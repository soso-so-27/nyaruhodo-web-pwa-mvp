"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
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

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

export function BottomNavigation({ active }: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingKey, setPendingKey] = useState<NavItem["key"] | null>(null);
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
  const displayActiveKey = pendingKey ?? activeKey;
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === displayActiveKey),
  );

  useEffect(() => {
    setPendingKey(null);
  }, [activeKey, pathname]);

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    item: NavItem,
    isActive: boolean,
  ) {
    if (isActive) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    setPendingKey(item.key);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const viewTransitionDocument = document as ViewTransitionDocument;

    if (
      prefersReducedMotion ||
      typeof viewTransitionDocument.startViewTransition !== "function"
    ) {
      return;
    }

    event.preventDefault();
    viewTransitionDocument.startViewTransition(() => {
      router.push(item.href);
    });
  }

  return (
    <nav style={styles.bottomNav} aria-label="下部ナビゲーション">
      <span
        style={{
          ...styles.activeNavIndicator,
          transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
        }}
        aria-hidden="true"
      />
      {items.map((item) => {
        const isActive = displayActiveKey === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={true}
            style={isActive ? styles.activeNavButton : styles.navButton}
            aria-current={activeKey === item.key ? "page" : undefined}
            onClick={(event) => handleNavClick(event, item, isActive)}
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
    overflow: "hidden",
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
    viewTransitionName: "bottom-nav",
  },
  activeNavIndicator: {
    position: "absolute",
    top: "4px",
    bottom: "4px",
    left: "4px",
    width: "calc((100% - 20px) / 4)",
    borderRadius: "17px",
    background: "#ecece7",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)",
    pointerEvents: "none",
    transition: "transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform",
  },
  navButton: {
    position: "relative",
    zIndex: 1,
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
    transition:
      "color 0.24s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  activeNavButton: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    minHeight: "42px",
    borderRadius: "17px",
    background: "transparent",
    color: "#3f433d",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: 0,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transform: "translateY(-1px)",
    transition:
      "color 0.24s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  navIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    color: "#777872",
    lineHeight: 1,
    transition: "color 0.24s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  activeNavIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    color: "#566052",
    lineHeight: 1,
    transform: "scale(1.04)",
    transition: "color 0.24s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  svgIcon: {
    width: "19px",
    height: "19px",
    display: "block",
  },
} satisfies Record<string, CSSProperties>;
