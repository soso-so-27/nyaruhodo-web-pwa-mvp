"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type BottomNavigationProps = {
  active: "home" | "today" | "collection" | "cats" | "together";
  catProfiles?: CatProfile[];
  activeCatId?: string | null;
  onCatSelect?: (catId: string) => void;
};

type CatProfile = {
  id: string;
  name: string;
  appearance?: { coat?: string };
  avatarDataUrl?: string;
  basicInfo?: {
    birthDate?: string;
    gender?: "male" | "female" | "unknown";
  };
};

type NavItem = {
  key: "home" | "collection" | "cats";
  href: string;
  label: string;
  icon: ReactNode;
};

export function BottomNavigation({
  active,
  catProfiles,
  activeCatId,
  onCatSelect,
}: BottomNavigationProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const activeKey =
    active === "today" ? "home" : active === "together" ? "collection" : active;
  const activeCatProfile =
    catProfiles?.find((profile) => profile.id === activeCatId) ?? null;
  const activeCatName = activeCatProfile?.name ?? "ねこ";
  const activeCatAvatarUrl = activeCatProfile?.avatarDataUrl ?? null;
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
    <>
      <nav style={styles.bottomNav} aria-label="下部ナビ">
        {items.map((item) => {
          const isActive = activeKey === item.key;

          if (item.key === "cats") {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setIsSheetOpen(true)}
                style={isActive ? styles.activeNavButton : styles.navButton}
              >
                <span style={styles.catNavAvatar}>
                  {activeCatAvatarUrl ? (
                    <img
                      src={activeCatAvatarUrl}
                      alt=""
                      style={styles.catNavAvatarImg}
                    />
                  ) : (
                    <span style={isActive ? styles.activeNavIcon : styles.navIcon}>
                      <CatIcon />
                    </span>
                  )}
                </span>
                <span style={styles.catNavLabel}>
                  {truncateName(activeCatName)}
                  {"▾"}
                </span>
              </button>
            );
          }

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

      {isSheetOpen ? (
        <>
          <div
            style={styles.sheetOverlay}
            onClick={() => setIsSheetOpen(false)}
          />
          <div style={styles.sheet}>
            <div style={styles.sheetHandle} />
            <p style={styles.sheetTitle}>猫を選ぶ</p>
            <div style={styles.sheetCatGrid}>
              {(catProfiles ?? []).map((profile) => {
                const isSelected = profile.id === activeCatId;
                const age = formatAge(profile.basicInfo?.birthDate);
                const gender = formatGender(profile.basicInfo?.gender);
                const meta = [gender, age].filter(Boolean).join("・");

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      onCatSelect?.(profile.id);
                      setIsSheetOpen(false);
                    }}
                    style={styles.sheetCatItem}
                  >
                    <div
                      style={
                        isSelected
                          ? { ...styles.sheetCatAvatar, ...styles.sheetCatAvatarActive }
                          : styles.sheetCatAvatar
                      }
                    >
                      {profile.avatarDataUrl ? (
                        <img
                          src={profile.avatarDataUrl}
                          alt={profile.name}
                          style={styles.sheetCatAvatarPhoto}
                        />
                      ) : (
                        <img
                          src={getCatAvatarSrc(profile.appearance?.coat)}
                          alt={profile.name}
                          style={styles.sheetCatAvatarImg}
                        />
                      )}
                    </div>
                    <span style={styles.sheetCatName}>{profile.name}</span>
                    {meta ? <span style={styles.sheetCatMeta}>{meta}</span> : null}
                  </button>
                );
              })}
            </div>
            <a
              href="/cats"
              style={styles.sheetCatsLink}
              onClick={() => setIsSheetOpen(false)}
            >
              ねこタブで管理する ›
            </a>
          </div>
        </>
      ) : null}
    </>
  );
}

function truncateName(name: string): string {
  return name.length > 5 ? `${name.slice(0, 4)}…` : name;
}

function getCatAvatarSrc(coat?: string): string {
  const coatMap: Record<string, string> = {
    saba: "/sample-cats/saba.png",
    gray: "/sample-cats/gray.png",
    orange_tabby: "/sample-cats/orange_tabby.png",
    black: "/sample-cats/black.png",
    white: "/sample-cats/white.png",
    calico: "/sample-cats/calico.png",
    cream: "/sample-cats/saba.png",
  };

  return coatMap[coat ?? ""] ?? "/sample-cats/saba.png";
}

function formatAge(birthDate?: string): string {
  if (!birthDate) {
    return "";
  }

  const birth = new Date(birthDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (totalMonths < 12) {
    return `${totalMonths}ヶ月`;
  }

  return `${Math.floor(totalMonths / 12)}歳`;
}

function formatGender(gender?: string): string {
  if (gender === "male") {
    return "男の子";
  }

  if (gender === "female") {
    return "女の子";
  }

  return "";
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
    border: "1px solid rgba(224, 222, 216, 0.96)",
    borderRadius: "24px",
    background: "rgba(255, 255, 255, 0.9)",
    boxShadow: "0 8px 20px rgba(52, 50, 46, 0.035)",
    padding: "5px",
    backdropFilter: "blur(14px)",
  },
  navButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1px",
    minHeight: "42px",
    borderRadius: "18px",
    border: "none",
    background: "transparent",
    color: "#777872",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 600,
    fontFamily: "inherit",
    letterSpacing: 0,
    padding: 0,
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
    border: "none",
    background: "#ecece7",
    color: "#3f433d",
    textDecoration: "none",
    fontSize: "10px",
    fontWeight: 650,
    fontFamily: "inherit",
    letterSpacing: 0,
    padding: 0,
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
  catNavAvatar: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catNavAvatarImg: {
    width: "22px",
    height: "22px",
    objectFit: "cover",
    borderRadius: "50%",
  },
  catNavLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: 0,
    display: "flex",
    alignItems: "center",
    gap: "1px",
  },
  sheetOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.25)",
    zIndex: 30,
  },
  sheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fbfaf7",
    borderRadius: "20px 20px 0 0",
    zIndex: 40,
    padding: "0 20px calc(32px + env(safe-area-inset-bottom))",
  },
  sheetHandle: {
    width: "36px",
    height: "4px",
    background: "#d0cdc6",
    borderRadius: "99px",
    margin: "10px auto 16px",
  },
  sheetTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#8a8a80",
    margin: "0 0 14px",
    textAlign: "center",
  },
  sheetCatGrid: {
    display: "flex",
    gap: "16px",
    overflowX: "auto",
    paddingBottom: "4px",
    scrollbarWidth: "none",
    marginBottom: "16px",
  },
  sheetCatItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    flexShrink: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit",
  },
  sheetCatAvatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    border: "3px solid transparent",
    overflow: "hidden",
    background: "#f5f3ef",
  },
  sheetCatAvatarActive: {
    border: "3px solid #6B9E82",
  },
  sheetCatAvatarPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
  },
  sheetCatAvatarImg: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    margin: "6px auto",
    display: "block",
  },
  sheetCatName: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#2a2a28",
    maxWidth: "72px",
    textAlign: "center",
    wordBreak: "break-all",
  },
  sheetCatMeta: {
    fontSize: "10px",
    color: "#9a9890",
  },
  sheetCatsLink: {
    display: "block",
    textAlign: "center",
    fontSize: "13px",
    color: "#6B9E82",
    textDecoration: "none",
    padding: "10px 0",
  },
} satisfies Record<string, CSSProperties>;
