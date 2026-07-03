"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import { hasUnopenedArrivedOmoideMemory } from "../../lib/home/omoideDelivery";

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

const COLLECTION_NAV_ENTRY_STORAGE_KEY = "neteruneko_collection_nav_entry";

export function BottomNavigation({
  active,
  homeState = "1",
}: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingKey, setPendingKey] = useState<NavItem["key"] | null>(null);
  const [hasUnopenedOmoide, setHasUnopenedOmoide] = useState(false);
  const activeKey = active === "today" ? "home" : active;
  const items: readonly NavItem[] = [
    {
      key: "home",
      href: "/home",
      label: "きょう",
      icon: <TodayPairIcon state={homeState} />,
    },
    {
      key: "collection",
      href: "/collection",
      label: "ねこだより",
      icon: <GeneratedNavIcon src="/icons/bottom-nav-mainichi.webp" />,
    },
    {
      key: "cats",
      href: "/cats",
      label: "うちのこ",
      icon: <GeneratedNavIcon src="/icons/bottom-nav-uchinoko.webp" />,
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

  useEffect(() => {
    function refreshUnopenedOmoide() {
      setHasUnopenedOmoide(hasUnopenedArrivedOmoideMemory());
    }

    refreshUnopenedOmoide();
    window.addEventListener(
      "neteruneko_omoide_memories_updated",
      refreshUnopenedOmoide,
    );
    window.addEventListener("storage", refreshUnopenedOmoide);
    window.addEventListener("focus", refreshUnopenedOmoide);
    const intervalId = window.setInterval(refreshUnopenedOmoide, 60_000);

    return () => {
      window.removeEventListener(
        "neteruneko_omoide_memories_updated",
        refreshUnopenedOmoide,
      );
      window.removeEventListener("storage", refreshUnopenedOmoide);
      window.removeEventListener("focus", refreshUnopenedOmoide);
      window.clearInterval(intervalId);
    };
  }, []);

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    item: NavItem,
    isActive: boolean,
  ) {
    if (isActive) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    setPendingKey(item.key);
    if (item.key === "collection") {
      try {
        window.sessionStorage.setItem(COLLECTION_NAV_ENTRY_STORAGE_KEY, "1");
      } catch {
        // Navigation should still work if sessionStorage is unavailable.
      }
    }

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
    <nav
      style={styles.bottomNav}
      aria-label="下部ナビゲーション"
      data-app-bottom-nav=""
    >
      <span
        style={{
          ...styles.activeNavIndicator,
          transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
        }}
        aria-hidden="true"
      />
      {items.map((item) => {
        const isActive = displayActiveKey === item.key;
        const displayLabel = item.label;
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
              {item.icon}
              {item.key === "cats" && hasUnopenedOmoide ? (
                <span
                  data-testid="cats-nav-unopened-omoide-dot"
                  style={styles.unopenedSealDot}
                />
              ) : null}
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
  const isAfterCapture = state === "2" || state === "3" || state === "4";

  return (
    <GeneratedNavIcon
      src="/icons/bottom-nav-today.webp"
      todayTestSlots
      style={isAfterCapture ? styles.generatedNavIconActive : undefined}
    />
  );
}

function GeneratedNavIcon({
  src,
  todayTestSlots = false,
  style,
}: {
  src: string;
  todayTestSlots?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={styles.generatedNavIconWrap}
      data-testid={todayTestSlots ? "today-pair-nav-icon" : undefined}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        width={44}
        height={44}
        loading="eager"
        decoding="async"
        style={{ ...styles.generatedNavIcon, ...style }}
      />
      {todayTestSlots ? (
        <>
          <span data-testid="today-pair-nav-slot" style={styles.generatedNavTestSlotLeft} />
          <span data-testid="today-pair-nav-slot" style={styles.generatedNavTestSlotRight} />
        </>
      ) : null}
    </span>
  );
}

const styles = {
  bottomNav: {
    position: "fixed",
    left: "50%",
    bottom: "var(--bottom-nav-safe-offset)",
    zIndex: 20,
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "4px",
    width: "min(calc(100% - 48px), 410px)",
    height: "var(--bottom-nav-height)",
    transform: "translateX(-50%)",
    border: "1px solid color-mix(in srgb, var(--control-border) 92%, transparent)",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper) 86%, transparent)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper) 72%, transparent) inset, 0 14px 34px -22px rgba(70, 50, 30, 0.24)",
    padding: "4px",
    backdropFilter: "blur(14px)",
    viewTransitionName: "bottom-nav",
  },
  activeNavIndicator: {
    position: "absolute",
    top: "4px",
    bottom: "4px",
    left: "4px",
    width: "calc((100% - 16px) / 3)",
    borderRadius: "var(--radius-full)",
    border: "1px solid color-mix(in srgb, var(--control-border-selected) 34%, transparent)",
    background: "var(--control-surface-selected)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper) 78%, transparent) inset, 0 10px 24px -20px rgba(70, 50, 30, 0.28)",
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
    gap: "4px",
    minHeight: "52px",
    borderRadius: "var(--radius-full)",
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
    gap: "4px",
    minHeight: "52px",
    borderRadius: "var(--radius-full)",
    background: "transparent",
    color: "var(--ink)",
    textDecoration: "none",
    cursor: "pointer",
    transition:
      "color var(--dur-instant) var(--ease-gentle), transform var(--dur-instant) var(--ease-settle)",
  },
  navIcon: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "26px",
    color: "var(--ink-soft)",
    lineHeight: 1,
    transition: "color var(--dur-instant) var(--ease-gentle), transform var(--dur-instant) var(--ease-settle)",
  },
  activeNavIcon: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "26px",
    color: "var(--ink)",
    lineHeight: 1,
    transform: "scale(1.02)",
    transition: "color var(--dur-instant) var(--ease-gentle), transform var(--dur-instant) var(--ease-settle)",
  },
  generatedNavIconWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "26px",
    overflow: "visible",
  },
  generatedNavIcon: {
    display: "block",
    width: "28px",
    height: "28px",
    objectFit: "contain",
    opacity: 0.82,
  },
  generatedNavIconActive: {
    opacity: 0.96,
  },
  generatedNavTestSlotLeft: {
    position: "absolute",
    left: "5px",
    top: "5px",
    width: "9px",
    height: "12px",
    opacity: 0,
    pointerEvents: "none",
  },
  generatedNavTestSlotRight: {
    position: "absolute",
    right: "5px",
    top: "5px",
    width: "9px",
    height: "12px",
    opacity: 0,
    pointerEvents: "none",
  },
  unopenedSealDot: {
    position: "absolute",
    top: "0px",
    right: "0px",
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    background: "var(--seal)",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--paper) 86%, transparent)",
    pointerEvents: "none",
  },
  navLabel: {
    display: "none",
    color: "currentColor",
    fontFamily: "var(--font-ui)",
    fontSize: "11.5px",
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: "var(--tracking-label)",
  },
  activeNavLabel: {
    color: "currentColor",
    fontFamily: "var(--font-ui)",
    fontSize: "11.5px",
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: "var(--tracking-label)",
  },
} satisfies Record<string, CSSProperties>;
