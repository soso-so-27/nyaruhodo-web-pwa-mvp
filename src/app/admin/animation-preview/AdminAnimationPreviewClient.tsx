"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { HomeEnvelopeMotionArt } from "../../../components/home/HomeEnvelopeMotionArt";
import { HOME_ENVELOPE_OPEN_MS } from "../../../components/home/homeEnvelopeMotionConfig";

type PreviewPhase = "idle" | "opening" | "result";
type PreviewMode = "current" | "simple";
type SimpleRevealSpeed = "fast" | "recommended" | "slow";

const PREVIEW_PHOTO_SRC = "/sample-cats/pose-belly.webp";
const SIMPLE_REVEAL_PRESETS: Array<{
  key: SimpleRevealSpeed;
  label: string;
  durationMs: number;
  envelopeDurationMs: number;
  envelopeDelayMs: number;
}> = [
  {
    key: "fast",
    label: "速い: 300ms",
    durationMs: 300,
    envelopeDurationMs: 180,
    envelopeDelayMs: 40,
  },
  {
    key: "recommended",
    label: "推奨: 760ms",
    durationMs: 760,
    envelopeDurationMs: 360,
    envelopeDelayMs: 100,
  },
  {
    key: "slow",
    label: "ゆっくり: 950ms",
    durationMs: 950,
    envelopeDurationMs: 460,
    envelopeDelayMs: 120,
  },
];

export default function AdminAnimationPreviewClient() {
  const [phase, setPhase] = useState<PreviewPhase>("idle");
  const [mode, setMode] = useState<PreviewMode>("simple");
  const [simpleSpeed, setSimpleSpeed] =
    useState<SimpleRevealSpeed>("recommended");
  const [playKey, setPlayKey] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const resultTimerRef = useRef<number | null>(null);
  const simplePreset =
    SIMPLE_REVEAL_PRESETS.find((preset) => preset.key === simpleSpeed) ??
    SIMPLE_REVEAL_PRESETS[1];
  const simpleRevealVars = {
    "--admin-simple-reveal-duration": `${simplePreset.durationMs}ms`,
    "--admin-simple-envelope-duration": `${simplePreset.envelopeDurationMs}ms`,
    "--admin-simple-envelope-delay": `${simplePreset.envelopeDelayMs}ms`,
  } as CSSProperties;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return () => {
      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current);
      }
    };
  }, []);

  function resetTimer() {
    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  }

  function changeMode(nextMode: PreviewMode) {
    if (nextMode === mode || phase === "opening") {
      return;
    }
    resetTimer();
    setMode(nextMode);
    setPhase("idle");
    setPlayKey((current) => current + 1);
  }

  function replay() {
    resetTimer();
    setPlayKey((current) => current + 1);
    setPhase("opening");

    const duration =
      mode === "simple" ? simplePreset.durationMs : HOME_ENVELOPE_OPEN_MS;
    const delay = prefersReducedMotion ? 120 : duration;
    resultTimerRef.current = window.setTimeout(() => {
      resultTimerRef.current = null;
      setPhase("result");
    }, delay);
  }

  const isOpening = phase === "opening";
  const isSimple = mode === "simple";
  const shouldShowResult = isSimple ? phase !== "idle" : phase === "result";
  const chromeStyle = isOpening ? styles.hiddenChrome : undefined;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <a href="/admin/analytics" style={styles.backLink}>
          Analyticsへ戻る
        </a>
        <p style={styles.kicker}>Admin preview</p>
        <h1 style={styles.title}>開封アニメーション確認</h1>
        <p style={styles.description}>
          実機でねこだより開封の見え方を確認できます。通常ユーザーには表示されません。
        </p>
      </section>

      <section style={styles.modeTabs} aria-label="確認モード">
        {(["current", "simple"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => changeMode(item)}
            disabled={isOpening}
            style={{
              ...styles.modeButton,
              ...(mode === item ? styles.modeButtonActive : {}),
            }}
          >
            {item === "current" ? "現行" : "シンプル"}
          </button>
        ))}
      </section>
      {mode === "current" ? (
        <p style={styles.compareNote}>現行は比較用です。本番ホームでは採用していません。</p>
      ) : null}
      {mode === "simple" ? (
        <section style={styles.speedTabs} aria-label="シンプル速度">
          {SIMPLE_REVEAL_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                if (!isOpening) {
                  setSimpleSpeed(preset.key);
                  setPhase("idle");
                  setPlayKey((current) => current + 1);
                }
              }}
              disabled={isOpening}
              style={{
                ...styles.speedButton,
                ...(simpleSpeed === preset.key ? styles.speedButtonActive : {}),
              }}
            >
              {preset.label}
            </button>
          ))}
        </section>
      ) : null}

      <section style={styles.previewShell} aria-label="開封アニメーション確認">
        <div
          style={{
            ...styles.phoneFrame,
            ...(isSimple ? simpleRevealVars : {}),
          }}
        >
          <div style={styles.paperBackdrop} aria-hidden="true" />
          <a
            href="/settings"
            aria-label="設定"
            style={{ ...styles.settingsButton, ...chromeStyle }}
          >
            ⚙
          </a>

          <div style={styles.stage}>
            <p style={{ ...styles.previewCopy, ...chromeStyle }}>
              よる8時の便りを確認中
            </p>
            <button
              type="button"
              className={[
                "admin-envelope-preview-button",
                isSimple ? "simple-reveal" : "current-reveal",
                isOpening ? "is-opening" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={replay}
              disabled={isOpening}
              aria-busy={isOpening}
              aria-label="ホームよる8時便を再生"
              style={styles.envelopeButton}
            >
              <span
                data-envelope-body="true"
                style={styles.envelopeBody}
                aria-hidden="true"
              >
                {isSimple ? (
                  <img
                    src="/images/home/generated-envelope-wide-v2.webp"
                    alt=""
                    className="simple-envelope-image"
                    draggable={false}
                    style={styles.simpleEnvelopeImage}
                  />
                ) : (
                  <>
                    <HomeEnvelopeMotionArt
                      isOpening={isOpening}
                      playKey={playKey}
                    />
                    {phase !== "idle" ? (
                      <span
                        data-develop-photo="true"
                        style={styles.developPhoto}
                        aria-hidden="true"
                      >
                        <img
                          src={PREVIEW_PHOTO_SRC}
                          alt=""
                          draggable={false}
                          style={styles.developImage}
                        />
                      </span>
                    ) : null}
                  </>
                )}
              </span>
              <span
                data-envelope-action="true"
                style={styles.envelopeAction}
                aria-hidden="true"
              />
            </button>

            {shouldShowResult ? (
              <div
                style={{
                  ...styles.resultOverlay,
                  ...(isSimple ? styles.simpleResultOverlay : {}),
                }}
                aria-live="polite"
              >
                <div
                  style={{
                    ...styles.resultStage,
                    ...(isSimple ? styles.simpleResultStage : {}),
                  }}
                >
                  <p style={styles.resultTitle}>ねこだより、とどいた</p>
                  <div style={styles.resultPhotoFrame}>
                    <img
                      src={PREVIEW_PHOTO_SRC}
                      alt="開封アニメーション確認用の猫写真"
                      draggable={false}
                      style={styles.resultPhoto}
                    />
                  </div>
                  <p style={styles.resultNote}>ねこだよりに入りました</p>
                  {phase === "result" ? (
                    <button type="button" onClick={replay} style={styles.replayButton}>
                      もう一度再生
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <nav style={{ ...styles.bottomNav, ...chromeStyle }} aria-label="preview">
            <span>きょう</span>
            <span>ねこだより</span>
            <span>うちのこ</span>
          </nav>
        </div>
      </section>

      <section style={styles.controls}>
        <button
          type="button"
          onClick={replay}
          disabled={isOpening}
          style={styles.primaryButton}
        >
          {phase === "idle" ? "ホームよる8時便を再生" : "もう一度再生"}
        </button>
        <p style={styles.metaText}>
          {mode === "simple" ? `シンプル: ${simplePreset.durationMs}ms` : `現行: ${HOME_ENVELOPE_OPEN_MS}ms`} / reduced motion:{" "}
          {prefersReducedMotion ? "有効" : "無効"}
        </p>
      </section>

      <style>{`
        .admin-envelope-preview-button [data-envelope-action="true"]::before {
          content: "ひらく";
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          color: rgba(151, 72, 62, 0.72);
          font-size: 15px;
          letter-spacing: 0;
          white-space: nowrap;
        }

        .admin-envelope-preview-button.is-opening [data-envelope-action="true"]::before {
          animation: adminEnvelopeActionFade 120ms ease-out both;
        }

        .admin-envelope-preview-button.current-reveal.is-opening [data-develop-photo="true"] {
          animation: adminEnvelopePhotoReveal ${HOME_ENVELOPE_OPEN_MS}ms cubic-bezier(0.2, 0.82, 0.2, 1) both;
        }

        .admin-envelope-preview-button.simple-reveal.is-opening .simple-envelope-image {
          animation: adminSimpleEnvelopeOut var(--admin-simple-envelope-duration, 360ms) var(--admin-simple-envelope-delay, 100ms) cubic-bezier(0.4, 0, 1, 1) both;
        }

        @keyframes adminEnvelopeActionFade {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          to { opacity: 0; transform: translate(-50%, -52%) scale(0.98); }
        }

        @keyframes adminEnvelopePhotoReveal {
          0%, 36% {
            opacity: 0;
            transform: translate(-50%, 26px) scale(0.86);
            filter: blur(5px);
          }
          66% {
            opacity: 0.9;
            transform: translate(-50%, -78px) scale(1.02);
            filter: blur(1px);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -92px) scale(1);
            filter: blur(0);
          }
        }

        @keyframes adminSimpleEnvelopeOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
          to {
            opacity: 0;
            transform: translateY(4px) scale(0.985);
            filter: blur(0.6px);
          }
        }

        @keyframes eveningOpeningOverlayIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes eveningOpeningStageIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes simpleRevealResultIn {
          0%, 34% {
            opacity: 0;
            transform: scale(0.98);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .admin-envelope-preview-button.is-opening [data-envelope-action="true"]::before,
          .admin-envelope-preview-button.current-reveal.is-opening [data-develop-photo="true"],
          .admin-envelope-preview-button.simple-reveal.is-opening .simple-envelope-image {
            animation-duration: 1ms;
            animation-delay: 0ms;
          }
        }
      `}</style>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "22px 16px 40px",
    color: "#322b25",
    fontFamily: "var(--font-zen-kaku), system-ui, sans-serif",
    background:
      "radial-gradient(circle at 22% 8%, rgba(234, 166, 127, 0.24), transparent 34%), radial-gradient(circle at 88% 18%, rgba(193, 206, 222, 0.24), transparent 34%), #f6efe3",
  },
  header: {
    width: "min(100%, 560px)",
    margin: "0 auto 14px",
  },
  backLink: {
    display: "inline-flex",
    color: "#8a5e50",
    textDecoration: "none",
    fontSize: 13,
    marginBottom: 14,
  },
  kicker: {
    margin: 0,
    color: "#a65045",
    fontSize: 12,
  },
  title: {
    margin: "4px 0 8px",
    fontSize: 26,
    fontWeight: 500,
    letterSpacing: 0,
  },
  description: {
    margin: 0,
    color: "#6c5c50",
    fontSize: 14,
    lineHeight: 1.7,
  },
  modeTabs: {
    width: "min(100%, 560px)",
    margin: "0 auto 14px",
    display: "flex",
    justifyContent: "center",
    gap: 8,
  },
  speedTabs: {
    width: "min(100%, 560px)",
    margin: "-2px auto 14px",
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  speedButton: {
    border: "1px solid rgba(122, 95, 78, 0.2)",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255, 252, 247, 0.58)",
    color: "#756157",
    fontSize: 12,
    cursor: "pointer",
  },
  speedButtonActive: {
    borderColor: "rgba(166, 84, 72, 0.36)",
    background: "rgba(255, 249, 243, 0.92)",
    color: "#9b4c42",
  },
  modeButton: {
    minHeight: 38,
    minWidth: 92,
    borderRadius: 999,
    border: "1px solid rgba(91, 74, 62, 0.18)",
    background: "rgba(255, 252, 247, 0.58)",
    color: "#6a5b51",
    font: "inherit",
    cursor: "pointer",
  },
  modeButtonActive: {
    borderColor: "rgba(166, 80, 69, 0.44)",
    background: "rgba(255, 249, 243, 0.92)",
    color: "#9b4c42",
  },
  compareNote: {
    width: "min(100%, 560px)",
    margin: "-4px auto 12px",
    color: "#8a6258",
    fontSize: 12,
    textAlign: "center",
  },
  previewShell: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
  },
  phoneFrame: {
    position: "relative",
    width: "min(100%, 390px)",
    minHeight: "min(720px, calc(100dvh - 230px))",
    overflow: "hidden",
    borderRadius: 28,
    border: "1px solid rgba(91, 74, 62, 0.14)",
    background:
      "radial-gradient(circle at 22% 8%, rgba(234, 166, 127, 0.22), transparent 35%), radial-gradient(circle at 92% 18%, rgba(190, 205, 222, 0.24), transparent 35%), #f7f0e4",
    boxShadow: "0 20px 55px rgba(72, 55, 42, 0.14)",
  },
  paperBackdrop: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.08)), url('/images/home-backgrounds/paper-grain-tile.webp')",
    backgroundSize: "auto, 420px 420px",
    opacity: 0.75,
    pointerEvents: "none",
  },
  settingsButton: {
    position: "absolute",
    right: 22,
    top: 24,
    width: 42,
    height: 42,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    border: "1px solid rgba(91, 74, 62, 0.16)",
    background: "rgba(255, 252, 247, 0.72)",
    color: "#8a7b70",
    textDecoration: "none",
    zIndex: 4,
  },
  stage: {
    position: "relative",
    minHeight: 590,
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    padding: "76px 22px 112px",
    zIndex: 1,
  },
  previewCopy: {
    position: "absolute",
    top: 112,
    margin: 0,
    color: "#78695f",
    fontSize: 14,
    letterSpacing: 0,
    transition: "opacity 140ms ease",
  },
  envelopeButton: {
    position: "relative",
    width: "min(82vw, 310px)",
    height: 248,
    border: 0,
    padding: 0,
    background: "transparent",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  envelopeBody: {
    position: "absolute",
    inset: 0,
    display: "block",
  },
  simpleEnvelopeImage: {
    position: "absolute",
    left: "50%",
    top: "43%",
    width: "96%",
    height: "auto",
    display: "block",
    transform: "translate(-50%, -50%)",
    filter: "drop-shadow(0 16px 26px rgba(73, 52, 38, 0.16))",
    pointerEvents: "none",
  },
  envelopeAction: {
    position: "absolute",
    left: "50%",
    top: "86%",
    width: 92,
    height: 36,
    transform: "translate(-50%, -50%)",
    borderRadius: 999,
    background: "rgba(255, 250, 244, 0.86)",
    border: "1px solid rgba(166, 80, 69, 0.22)",
    boxShadow: "0 8px 18px rgba(72, 50, 32, 0.08)",
    zIndex: 8,
    pointerEvents: "none",
  },
  developPhoto: {
    position: "absolute",
    left: "50%",
    top: "52%",
    width: "48%",
    aspectRatio: "1 / 1",
    zIndex: 5,
    borderRadius: 18,
    padding: 5,
    background: "rgba(255, 252, 247, 0.92)",
    boxShadow: "0 12px 26px rgba(70, 52, 39, 0.16)",
    opacity: 0,
    transform: "translate(-50%, 26px) scale(0.86)",
    pointerEvents: "none",
  },
  developImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    borderRadius: 14,
  },
  resultOverlay: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    padding: "54px 16px 100px",
    background: "rgba(247, 240, 228, 0.54)",
    zIndex: 10,
    animation: "eveningOpeningOverlayIn 240ms ease-out both",
  },
  simpleResultOverlay: {
    background: "rgba(247, 240, 228, 0.98)",
    animation: "none",
  },
  resultStage: {
    width: "100%",
    display: "grid",
    justifyItems: "center",
    gap: 14,
    animation: "eveningOpeningStageIn 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  simpleResultStage: {
    animation:
      "simpleRevealResultIn var(--admin-simple-reveal-duration, 760ms) cubic-bezier(0, 0, 0.2, 1) both",
  },
  resultTitle: {
    margin: 0,
    color: "#6a4c42",
    fontSize: 17,
    letterSpacing: 0,
  },
  resultPhotoFrame: {
    width: "min(calc(100vw - 32px), 100%, 390px)",
    aspectRatio: "1 / 1",
    borderRadius: 22,
    padding: 6,
    boxSizing: "border-box",
    background: "rgba(255, 252, 247, 0.68)",
    boxShadow:
      "0 1px 0 rgba(255,255,255,.52) inset, 0 16px 38px rgba(96,78,54,0.12)",
  },
  resultPhoto: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    borderRadius: 17,
  },
  resultNote: {
    margin: "4px 0 0",
    color: "#75655a",
    fontSize: 14,
  },
  replayButton: {
    minHeight: 44,
    borderRadius: 999,
    border: "1px solid rgba(91, 74, 62, 0.2)",
    background: "rgba(255, 252, 247, 0.86)",
    padding: "0 22px",
    color: "#5e5148",
    font: "inherit",
    cursor: "pointer",
  },
  bottomNav: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 22,
    height: 68,
    borderRadius: 999,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    alignItems: "center",
    justifyItems: "center",
    border: "1px solid rgba(91, 74, 62, 0.14)",
    background: "rgba(255, 252, 247, 0.78)",
    color: "#807166",
    fontSize: 12,
    zIndex: 4,
  },
  hiddenChrome: {
    opacity: 0,
    pointerEvents: "none" as const,
    transition: "opacity 140ms ease",
  },
  controls: {
    width: "min(100%, 560px)",
    margin: "18px auto 0",
    display: "grid",
    gap: 8,
    justifyItems: "center",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    border: "1px solid rgba(91, 74, 62, 0.2)",
    background: "rgba(255, 252, 247, 0.84)",
    padding: "0 24px",
    color: "#5d5148",
    font: "inherit",
    cursor: "pointer",
  },
  metaText: {
    margin: 0,
    color: "#7d6d61",
    fontSize: 12,
  },
} satisfies Record<string, CSSProperties>;
