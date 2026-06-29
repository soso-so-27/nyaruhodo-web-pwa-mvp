"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { trackProductEvent } from "../../lib/analytics/productAnalytics";

type UserDeviceGateProps = {
  children: ReactNode;
};

const DESKTOP_QUERY = "(min-width: 768px)";
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

export function UserDeviceGate({ children }: UserDeviceGateProps) {
  const pathname = usePathname() ?? "/";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const [isRuntimeDesktop, setIsRuntimeDesktop] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const trackedRoutesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }

    const desktopMedia = window.matchMedia(DESKTOP_QUERY);
    const finePointerMedia = window.matchMedia(FINE_POINTER_QUERY);

    const update = () => {
      setCurrentUrl(window.location.href);
      setIsRuntimeDesktop(isDesktopLikeDevice(desktopMedia, finePointerMedia));
    };

    update();
    window.addEventListener("resize", update);
    desktopMedia.addEventListener("change", update);
    finePointerMedia.addEventListener("change", update);

    return () => {
      window.removeEventListener("resize", update);
      desktopMedia.removeEventListener("change", update);
      finePointerMedia.removeEventListener("change", update);
    };
  }, [isAdminRoute, pathname]);

  useEffect(() => {
    if (isAdminRoute || !isRuntimeDesktop) {
      return;
    }

    const key = pathname;
    if (trackedRoutesRef.current.has(key)) {
      return;
    }
    trackedRoutesRef.current.add(key);

    trackProductEvent("desktop_block_view", {
      route: pathname,
      source: readSafeSource(),
      viewport_width: window.innerWidth,
      is_in_app_browser: isInAppBrowser(),
      is_standalone_pwa: isStandalonePwa(),
    });
  }, [isAdminRoute, isRuntimeDesktop, pathname]);

  if (isAdminRoute) {
    return <>{children}</>;
  }

  async function copyUrl() {
    if (!currentUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div
      className="deviceGate"
      data-runtime-desktop={isRuntimeDesktop ? "true" : "false"}
    >
      <main className="deviceGateDesktopNotice" aria-labelledby="deviceGateTitle">
        <section className="deviceGatePanel">
          <p className="deviceGateLabel">ねてるねこ</p>
          <h1 id="deviceGateTitle">
            ねてるねこは、
            <br />
            スマホで使うアプリです。
          </h1>
          <p className="deviceGateLead">
            スマホで開くと、
            <br />
            ねがおを1枚入れて
            <br />
            ねこだよりを受け取れます。
          </p>
          <p className="deviceGateCopy">
            このページをスマホで開いてください。
          </p>
          {currentUrl ? (
            <div className="deviceGateUrlBox">
              <span>{currentUrl}</span>
            </div>
          ) : null}
          {isRuntimeDesktop ? (
            <button type="button" className="deviceGateButton" onClick={copyUrl}>
              URLをコピー
            </button>
          ) : null}
          <p className="deviceGateStatus" aria-live="polite">
            {copyState === "copied"
              ? "コピーしました。スマホに送って開いてください。"
              : copyState === "failed"
                ? "コピーできませんでした。アドレスバーのURLを使ってください。"
                : "InstagramやLINEでスマホへ送ると開きやすいです。"}
          </p>
        </section>
      </main>
      <div className="deviceGateMobileApp">{children}</div>
      <style>{`
        .deviceGate {
          min-height: 100%;
        }

        .deviceGateDesktopNotice {
          display: none;
        }

        @media (min-width: 768px) {
          .deviceGateMobileApp {
            display: none;
          }

          .deviceGateDesktopNotice {
            display: grid;
          }
        }

        .deviceGate[data-runtime-desktop="true"] > .deviceGateMobileApp {
          display: none;
        }

        .deviceGate[data-runtime-desktop="true"] > .deviceGateDesktopNotice {
          display: grid;
        }

        .deviceGateDesktopNotice {
          min-height: 100dvh;
          place-items: center;
          padding: 48px 24px;
          color: var(--ink);
          background: var(--app-paper-background);
          background-size: var(--app-paper-background-size);
          background-position: var(--app-paper-background-position);
          background-repeat: var(--app-paper-background-repeat);
          font-family: var(--font-ui);
        }

        .deviceGatePanel {
          width: min(100%, 520px);
          padding: 40px 36px;
          border: 1px solid color-mix(in srgb, var(--line-strong) 68%, transparent);
          border-radius: 28px;
          background: color-mix(in srgb, var(--paper-card) 78%, transparent);
          box-shadow: 0 22px 48px rgba(93, 73, 50, 0.12);
          text-align: center;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .deviceGateLabel {
          margin: 0 0 18px;
          color: var(--seal);
          font-family: var(--font-display);
          font-size: 15px;
          letter-spacing: 0.14em;
        }

        .deviceGatePanel h1 {
          margin: 0;
          color: var(--ink);
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 400;
          line-height: 1.55;
          letter-spacing: 0.06em;
        }

        .deviceGateLead,
        .deviceGateCopy,
        .deviceGateStatus {
          margin: 24px 0 0;
          color: var(--ink-soft);
          font-size: 16px;
          line-height: 1.9;
          letter-spacing: 0.05em;
        }

        .deviceGateCopy {
          color: var(--ink);
        }

        .deviceGateUrlBox {
          margin: 28px auto 0;
          padding: 12px 14px;
          border: 1px solid color-mix(in srgb, var(--line-strong) 54%, transparent);
          border-radius: 16px;
          background: color-mix(in srgb, var(--paper) 82%, transparent);
          color: var(--ink-soft);
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
          text-align: left;
        }

        .deviceGateButton {
          margin-top: 18px;
          min-height: 48px;
          min-width: 184px;
          padding: 0 24px;
          border: 1px solid color-mix(in srgb, var(--seal) 32%, transparent);
          border-radius: 999px;
          background: color-mix(in srgb, var(--paper) 92%, var(--seal-soft) 8%);
          color: var(--seal);
          font: inherit;
          font-weight: 500;
          letter-spacing: 0.08em;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(93, 73, 50, 0.1);
        }

        .deviceGateButton:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--seal) 56%, transparent);
          outline-offset: 4px;
        }

        .deviceGateStatus {
          min-height: 1.9em;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function isDesktopLikeDevice(
  desktopMedia: MediaQueryList,
  finePointerMedia: MediaQueryList,
) {
  if (desktopMedia.matches) {
    return true;
  }

  if (isMobileUserAgent()) {
    return false;
  }

  return finePointerMedia.matches && navigator.maxTouchPoints === 0;
}

function isMobileUserAgent() {
  return /iPhone|iPod|Android.*Mobile|Windows Phone|Mobile Safari/i.test(
    navigator.userAgent,
  );
}

function isInAppBrowser() {
  return /Instagram|FBAN|FBAV|Line|Twitter|TikTok/i.test(navigator.userAgent);
}

function isStandalonePwa() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function readSafeSource() {
  const raw = new URLSearchParams(window.location.search).get("source");
  const normalized = raw?.trim().toLowerCase();
  if (
    normalized === "instagram_story" ||
    normalized === "instagram_bio" ||
    normalized === "instagram_dm" ||
    normalized === "instagram" ||
    normalized === "direct"
  ) {
    return normalized;
  }
  return normalized ? "unknown" : "direct";
}
