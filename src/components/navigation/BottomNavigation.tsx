"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { BoxIcon, CameraIcon } from "../ui/AppIcons";

type BottomNavigationProps = {
  active: "home" | "today" | "torisetu" | "collection" | "cats" | "together";
};

type NavItem = {
  key: "home" | "collection" | "cats";
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
      label: "しゃしん",
      icon: <CameraIcon style={{ ...styles.svgIcon, ...styles.cameraSvgIcon }} />,
    },
    {
      key: "collection",
      href: "/collection",
      label: "アルバム",
      icon: <BoxIcon style={{ ...styles.svgIcon, ...styles.boxSvgIcon }} />,
    },
    {
      key: "cats",
      href: "/cats",
      label: "ねこ",
      icon: <span style={styles.catImageIcon} />,
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
          transform: `translateX(calc(${activeIndex} * (100% + 2px)))`,
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
            aria-label={item.label}
            aria-current={activeKey === item.key ? "page" : undefined}
            onClick={(event) => handleNavClick(event, item, isActive)}
          >
            <span
              style={isActive ? styles.activeNavIcon : styles.navIcon}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span style={isActive ? styles.activeNavLabel : styles.navLabel}>
              {item.label}
            </span>
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
    bottom: "calc(10px + env(safe-area-inset-bottom))",
    zIndex: 20,
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "2px",
    width: "min(calc(100% - 28px), 390px)",
    transform: "translateX(-50%)",
    border: "1px solid rgba(200, 197, 190, 0.9)",
    borderRadius: "20px",
    background: "rgba(255, 255, 255, 0.96)",
    boxShadow:
      "0 -2px 0 rgba(200,197,190,0.3), 0 8px 24px rgba(52, 50, 46, 0.12)",
    padding: "5px",
    backdropFilter: "blur(20px)",
    viewTransitionName: "bottom-nav",
  },
  activeNavIndicator: {
    position: "absolute",
    top: "5px",
    bottom: "5px",
    left: "5px",
    width: "calc((100% - 14px) / 3)",
    borderRadius: "15px",
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
    gap: "3px",
    minHeight: "48px",
    borderRadius: "15px",
    background: "transparent",
    color: "#777872",
    textDecoration: "none",
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
    gap: "3px",
    minHeight: "48px",
    borderRadius: "15px",
    background: "transparent",
    color: "#3f433d",
    textDecoration: "none",
    cursor: "pointer",
    transform: "translateY(-1px)",
    transition:
      "color 0.24s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  navIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    color: "#777872",
    lineHeight: 1,
    transition: "color 0.24s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  activeNavIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    color: "#566052",
    lineHeight: 1,
    transform: "scale(1.02)",
    transition: "color 0.24s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  svgIcon: {
    width: "21px",
    height: "21px",
    display: "block",
  },
  cameraSvgIcon: {
    width: "20px",
    height: "20px",
  },
  boxSvgIcon: {
    width: "21px",
    height: "21px",
  },
  catImageIcon: {
    width: "21px",
    height: "21px",
    display: "block",
    backgroundColor: "currentColor",
    maskImage: "url('/icons/cat-tab-mask.png')",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskImage: "url('/icons/cat-tab-mask.png')",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    transform: "translateY(0.5px)",
  },
  navLabel: {
    color: "currentColor",
    fontSize: "10px",
    fontWeight: 520,
    lineHeight: 1,
    letterSpacing: 0,
  },
  activeNavLabel: {
    color: "currentColor",
    fontSize: "10px",
    fontWeight: 640,
    lineHeight: 1,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;
