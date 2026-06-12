"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { BoxIcon, CameraIcon } from "../ui/AppIcons";

type BottomNavigationProps = {
  active: "home" | "today" | "collection" | "cats";
  homeVariant?: "default" | "desk";
  homeState?: "1" | "1b" | "2" | "3" | "4";
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

export function BottomNavigation({
  active,
  homeVariant = "default",
  homeState = "1",
}: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingKey, setPendingKey] = useState<NavItem["key"] | null>(null);
  const activeKey = active === "today" ? "home" : active;
  const items: readonly NavItem[] = [
    {
      key: "home",
      href: "/home",
      label: "とる",
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
      icon: <span style={styles.catTabIcon} />,
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
        const displayLabel =
          item.key === "home" && homeVariant === "desk" ? "きょう" : item.label;
        const displayIcon =
          item.key === "home" && homeVariant === "desk" ? (
            <TodayPairIcon state={homeState} />
          ) : (
            item.icon
          );
        return (
          <Link
            key={item.key}
            href={item.href}
            prefetch={true}
            style={isActive ? styles.activeNavButton : styles.navButton}
            aria-label={displayLabel}
            aria-current={activeKey === item.key ? "page" : undefined}
            onClick={(event) => handleNavClick(event, item, isActive)}
          >
            <span
              style={isActive ? styles.activeNavIcon : styles.navIcon}
              aria-hidden="true"
            >
              {displayIcon}
            </span>
            <span style={isActive ? styles.activeNavLabel : styles.navLabel}>
              {displayLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function TodayPairIcon({ state }: { state: "1" | "1b" | "2" | "3" | "4" }) {
  const firstFilled = state === "2" || state === "3" || state === "4";
  const secondFilled = state === "3" || state === "4";

  return (
    <svg
      viewBox="0 0 28 22"
      style={styles.todayPairIcon}
      data-testid="today-pair-nav-icon"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="4"
        width="9"
        height="14"
        rx="3"
        data-testid="today-pair-nav-slot"
        fill={firstFilled ? "currentColor" : "var(--paper)"}
        fillOpacity={firstFilled ? 1 : 0.48}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray={firstFilled ? undefined : "2.2 2"}
        opacity={firstFilled ? 0.86 : 0.82}
      />
      <rect
        x="16"
        y="4"
        width="9"
        height="14"
        rx="3"
        data-testid="today-pair-nav-slot"
        fill={secondFilled ? "currentColor" : "var(--paper)"}
        fillOpacity={secondFilled ? 1 : 0.48}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray={secondFilled ? undefined : "2.2 2"}
        opacity={secondFilled ? 0.86 : 0.82}
      />
    </svg>
  );
}

const styles = {
  bottomNav: {
    position: "fixed",
    left: "50%",
    bottom: "calc(var(--bottom-nav-bottom-offset) + env(safe-area-inset-bottom))",
    zIndex: 20,
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "2px",
    width: "min(calc(100% - 48px), 410px)",
    height: "var(--bottom-nav-height)",
    transform: "translateX(-50%)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-tile)",
    background: "color-mix(in srgb, var(--paper) 88%, transparent)",
    boxShadow: "var(--shadow-float)",
    padding: "8px",
    backdropFilter: "blur(14px)",
    viewTransitionName: "bottom-nav",
  },
  activeNavIndicator: {
    position: "absolute",
    top: "8px",
    bottom: "8px",
    left: "8px",
    width: "calc((100% - 20px) / 3)",
    borderRadius: "var(--radius-tile)",
    background: "var(--paper-card)",
    boxShadow: "var(--shadow-rest)",
    pointerEvents: "none",
    transition: "transform var(--dur-instant) var(--ease-settle)",
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
    minHeight: "60px",
    borderRadius: "var(--radius-tile)",
    background: "transparent",
    color: "var(--ink-soft)",
    textDecoration: "none",
    cursor: "pointer",
    transition:
      "color var(--dur-instant) var(--ease-gentle), transform var(--dur-instant) var(--ease-settle)",
  },
  activeNavButton: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    minHeight: "60px",
    borderRadius: "var(--radius-tile)",
    background: "transparent",
    color: "var(--ink)",
    textDecoration: "none",
    cursor: "pointer",
    transform: "translateY(-1px)",
    transition:
      "color var(--dur-instant) var(--ease-gentle), transform var(--dur-instant) var(--ease-settle)",
  },
  navIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    color: "var(--ink-soft)",
    lineHeight: 1,
    transition: "color var(--dur-instant) var(--ease-gentle), transform var(--dur-instant) var(--ease-settle)",
  },
  activeNavIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    color: "var(--ink)",
    lineHeight: 1,
    transform: "scale(1.02)",
    transition: "color var(--dur-instant) var(--ease-gentle), transform var(--dur-instant) var(--ease-settle)",
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
  catTabIcon: {
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
  todayPairIcon: {
    display: "block",
    width: "26px",
    height: "22px",
    overflow: "visible",
  },
  navLabel: {
    color: "currentColor",
    fontFamily: "var(--font-serif)",
    fontSize: "10px",
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: "var(--tracking-label)",
  },
  activeNavLabel: {
    color: "currentColor",
    fontFamily: "var(--font-serif)",
    fontSize: "10px",
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: "var(--tracking-label)",
  },
} satisfies Record<string, CSSProperties>;
