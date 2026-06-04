"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  keepExchangePhoto,
  saveOwnSleepingPhoto,
  saveSharedExchangePhoto,
  selectDeliverableSleepingPhoto,
  type ExchangePhoto,
} from "../../lib/home/sleepingPhotos";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  getActiveCatProfile,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import { AppIcon } from "../ui/AppIcons";

type OnboardingState = "intro" | "saving" | "delivered" | "empty" | "kept";

export function OnboardingFlow() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>("intro");
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState("");
  const [deliveredPhoto, setDeliveredPhoto] = useState<ExchangePhoto | null>(null);
  const [message, setMessage] = useState("");

  async function handleSelectSleepingPhoto() {
    if (state === "saving") {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    const cleanupInput = () => {
      window.setTimeout(() => {
        input.remove();
      }, 0);
    };

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file || !file.type.startsWith("image/")) {
        cleanupInput();
        return;
      }

      setState("saving");
      setMessage("");

      try {
        const profiles = readCatProfiles();
        const activeProfile = getActiveCatProfile(profiles, readActiveCatId());
        const catId = activeProfile.id;

        saveActiveCatId(catId);
        const savedResult = await saveSleepingPhotoWithFallback(file, catId);

        if (!savedResult) {
          setMessage("写真を小さくしても保存できませんでした。");
          setState("intro");
          return;
        }

        const { dataUrl, ownPhoto } = savedResult;
        setSelectedPhotoSrc(dataUrl);
        saveSharedExchangePhoto({ ownPhoto });

        const selected = selectDeliverableSleepingPhoto({
          triggerLabel: "ねがお",
          theme: "sleeping",
          category: "sleeping",
          seed: `${ownPhoto.id}:${Date.now()}`,
          excludePhotoId: ownPhoto.id,
          recipientCatId: catId,
        });

        trackProductEvent("onboarding_sleeping_photo_delivered", {
          has_delivered_photo: Boolean(selected.photo),
        });

        if (!selected.photo) {
          setMessage("ねがおは入りました。とどく候補がまだありません。");
          setState("empty");
          return;
        }

        setDeliveredPhoto({
          id: `onboarding-delivered-${selected.photo.id}-${Date.now()}`,
          sourcePhotoId: selected.photo.id,
          src: selected.photo.src,
          title: selected.photo.title,
          subtitle: selected.photo.subtitle,
          triggerLabel: "ねがお",
          theme: "sleeping",
          deliveredAt: Date.now(),
        });
        setState("delivered");
      } catch {
        setMessage("写真を保存できませんでした。");
        setState("intro");
      } finally {
        cleanupInput();
      }
    };

    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (!input.files?.length) {
        input.remove();
      }
    }, 60000);
  }

  function handleKeepDeliveredPhoto() {
    if (!deliveredPhoto) {
      return;
    }

    keepExchangePhoto(deliveredPhoto);
    window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
    trackProductEvent("onboarding_delivered_photo_kept", {
      source_photo_id: deliveredPhoto.sourcePhotoId ?? null,
    });
    setState("kept");
  }

  function handleGoHome() {
    window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
    router.push("/home");
  }

  return (
    <main style={styles.page}>
      <div style={styles.paperBackground} aria-hidden="true" />
      <div style={styles.container}>
        <p style={styles.brand}>ねてるねこ</p>

        {state === "intro" || state === "saving" ? (
          <section style={styles.hero} aria-label="ねてるねこのはじめかた">
            <div style={styles.flow} aria-hidden="true">
              <span style={styles.flowIcon}>
                <AppIcon name="camera" size={20} />
              </span>
              <span style={styles.flowDots} />
              <span style={styles.flowIconAccent}>
                <AppIcon name="mail" size={20} />
              </span>
            </div>
            <h1 style={styles.title}>
              だれかのねがおが
              <br />
              1枚とどきます
            </h1>
            <p style={styles.lead}>
              うちのねがおを届けると、
              <br />
              ほかのねがおがひとつ届きます。
            </p>
            <button
              type="button"
              onClick={() => {
                void handleSelectSleepingPhoto();
              }}
              style={styles.primaryButton}
              disabled={state === "saving"}
            >
              {state === "saving" ? "届けています..." : "うちのねがおを届ける"}
            </button>
            <button type="button" onClick={handleGoHome} style={styles.textButton}>
              あとで
            </button>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "delivered" && deliveredPhoto ? (
          <section style={styles.result} aria-label="とどいたねがお">
            <p style={styles.kicker}>ねがおがとどきました</p>
            <div style={styles.photoPair}>
              {selectedPhotoSrc ? (
                <img src={selectedPhotoSrc} alt="" style={styles.ownPhoto} />
              ) : null}
              <span style={styles.pairDots} />
              <img src={deliveredPhoto.src} alt="" style={styles.deliveredPhoto} />
            </div>
            <p style={styles.resultText}>
              とっておくと、アルバムに入ります。
            </p>
            <button
              type="button"
              onClick={handleKeepDeliveredPhoto}
              style={styles.primaryButton}
            >
              とっておく
            </button>
            <button type="button" onClick={handleGoHome} style={styles.textButton}>
              閉じる
            </button>
          </section>
        ) : null}

        {state === "empty" ? (
          <section style={styles.result} aria-label="ねがおを保存しました">
            <p style={styles.kicker}>ねがおが入りました</p>
            {selectedPhotoSrc ? (
              <img src={selectedPhotoSrc} alt="" style={styles.savedPhoto} />
            ) : null}
            <p style={styles.resultText}>
              とどく候補がまだありません。設定からテスト用のねがおを追加できます。
            </p>
            <a href="/settings" style={styles.primaryLink}>
              設定で追加する
            </a>
            <button type="button" onClick={handleGoHome} style={styles.textButton}>
              ホームへ
            </button>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "kept" ? (
          <section style={styles.result} aria-label="保存しました">
            <p style={styles.kicker}>とっておきました</p>
            <h2 style={styles.subTitle}>
              うちのねこページを
              <br />
              作れます
            </h2>
            <p style={styles.resultText}>
              アカウントに接続すると、ねがおをあとから見返せます。
            </p>
            <a href="/account/create" style={styles.primaryLink}>
              うちのねこページを作る
            </a>
            <button type="button" onClick={handleGoHome} style={styles.textButton}>
              ホームへ
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function resizeAndEncode(
  file: File,
  maxSize = 1100,
  quality = 0.78,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    image.src = url;
  });
}

async function saveSleepingPhotoWithFallback(file: File, catId: string) {
  const attempts = [
    { maxSize: 760, quality: 0.72 },
    { maxSize: 560, quality: 0.68 },
    { maxSize: 420, quality: 0.62 },
  ];

  for (const attempt of attempts) {
    const dataUrl = await resizeAndEncode(file, attempt.maxSize, attempt.quality);
    const ownPhoto = saveOwnSleepingPhoto({
      catId,
      src: dataUrl,
      triggerLabel: "ねがお",
      theme: "sleeping",
      shared: true,
    });

    if (ownPhoto) {
      return { dataUrl, ownPhoto };
    }
  }

  return null;
}

const SERIF =
  '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';

const styles = {
  page: {
    position: "relative",
    minHeight: "100dvh",
    overflow: "hidden",
    color: "#2f2a25",
    background: "#f7f1e7",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif',
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    background:
      "linear-gradient(180deg, #fffdf8 0%, #f8f2e8 52%, #f2e8d9 100%)",
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 430px)",
    minHeight: "100dvh",
    margin: "0 auto",
    padding:
      "calc(42px + env(safe-area-inset-top)) 28px calc(34px + env(safe-area-inset-bottom))",
    display: "grid",
    alignContent: "center",
    boxSizing: "border-box",
  },
  brand: {
    position: "fixed",
    top: "calc(42px + env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    margin: 0,
    color: "#6b6257",
    fontFamily: SERIF,
    fontSize: "16px",
    fontWeight: 400,
    letterSpacing: "0.16em",
    lineHeight: 1.4,
  },
  hero: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "18px",
  },
  flow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    color: "#8b8173",
    marginBottom: "2px",
  },
  flowIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(239,229,214,0.8)",
    color: "#746b5f",
    border: "1px solid rgba(120,108,94,0.12)",
  },
  flowIconAccent: {
    width: "46px",
    height: "46px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(244,228,221,0.78)",
    color: "#b98678",
    border: "1px solid rgba(178,132,116,0.12)",
  },
  flowDots: {
    width: "60px",
    height: "2px",
    borderRadius: "999px",
    background:
      "repeating-linear-gradient(90deg, rgba(142,128,110,0.42) 0 4px, transparent 4px 10px)",
  },
  title: {
    margin: "8px 0 0",
    color: "#202020",
    fontFamily: SERIF,
    fontSize: "30px",
    fontWeight: 470,
    lineHeight: 1.42,
    letterSpacing: "0.08em",
  },
  lead: {
    margin: 0,
    color: "#6a6258",
    fontFamily: SERIF,
    fontSize: "14.5px",
    fontWeight: 400,
    lineHeight: 1.9,
    letterSpacing: "0.06em",
  },
  primaryButton: {
    width: "min(100%, 280px)",
    minHeight: "54px",
    marginTop: "18px",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.86)",
    color: "#403a33",
    boxShadow: "0 10px 24px rgba(90,76,60,0.08)",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  primaryLink: {
    width: "min(100%, 280px)",
    minHeight: "54px",
    marginTop: "14px",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.86)",
    color: "#403a33",
    boxShadow: "0 10px 24px rgba(90,76,60,0.08)",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  textButton: {
    border: "none",
    background: "transparent",
    color: "#8a8174",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    padding: "8px 12px",
  },
  message: {
    margin: 0,
    color: "#8a8174",
    fontSize: "12px",
    lineHeight: 1.6,
  },
  result: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "16px",
  },
  kicker: {
    margin: 0,
    color: "#6a6258",
    fontFamily: SERIF,
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.12em",
  },
  subTitle: {
    margin: "6px 0 0",
    color: "#202020",
    fontFamily: SERIF,
    fontSize: "26px",
    fontWeight: 470,
    lineHeight: 1.45,
    letterSpacing: "0.08em",
  },
  photoPair: {
    display: "grid",
    gridTemplateColumns: "96px 34px 128px",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
  },
  ownPhoto: {
    width: "96px",
    height: "96px",
    objectFit: "cover",
    borderRadius: "22px",
    opacity: 0.72,
    border: "6px solid rgba(255,253,248,0.74)",
    boxShadow: "0 8px 20px rgba(90,76,60,0.08)",
  },
  deliveredPhoto: {
    width: "128px",
    height: "128px",
    objectFit: "cover",
    borderRadius: "26px",
    border: "7px solid rgba(255,253,248,0.82)",
    boxShadow: "0 14px 34px rgba(90,76,60,0.12)",
  },
  savedPhoto: {
    width: "min(100%, 260px)",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "26px",
    border: "7px solid rgba(255,253,248,0.82)",
    boxShadow: "0 14px 34px rgba(90,76,60,0.12)",
  },
  pairDots: {
    width: "30px",
    height: "2px",
    borderRadius: "999px",
    background:
      "repeating-linear-gradient(90deg, rgba(142,128,110,0.42) 0 4px, transparent 4px 10px)",
  },
  resultText: {
    width: "min(100%, 286px)",
    margin: 0,
    color: "#6a6258",
    fontFamily: SERIF,
    fontSize: "13.5px",
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: "0.06em",
  },
} satisfies Record<string, CSSProperties>;
