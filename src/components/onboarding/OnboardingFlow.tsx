"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  createSleepingExchange,
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  keepExchangePhoto,
  saveOwnSleepingPhoto,
  type ExchangePhoto,
  type ExchangePhotoPoolItem,
} from "../../lib/home/sleepingPhotos";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { isUsablePhotoSrc } from "../../lib/photoStorage";
import {
  getActiveCatProfile,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import { AppIcon } from "../ui/AppIcons";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

type OnboardingState = "intro" | "saving" | "delivered" | "empty" | "kept";

export function OnboardingFlow() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>("intro");
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState("");
  const [deliveredPhoto, setDeliveredPhoto] = useState<ExchangePhoto | null>(null);
  const [message, setMessage] = useState("");
  const [isCandidateAdding, setIsCandidateAdding] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    setIsTestMode(new URLSearchParams(window.location.search).has("test"));
  }, []);

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

      if (!file || !isLikelyImageFile(file)) {
        setMessage("写真を選べませんでした。別の写真でもう一度試してください。");
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

        const exchangeResult = await createSleepingExchange({
          ownPhoto,
          triggerLabel: "ねがお",
          theme: "sleeping",
          category: "sleeping",
          seed: `${ownPhoto.id}:${Date.now()}`,
          recipientCatId: catId,
        });

        trackProductEvent("onboarding_sleeping_photo_delivered", {
          has_delivered_photo: Boolean(exchangeResult?.photo),
        });

        if (!exchangeResult?.photo) {
          setMessage(
            isTestMode
              ? "ねがおは入りました。とどく候補がまだありません。テスト用に候補を追加できます。"
              : "ねがおは入りました。いまとどく候補がありません。少しあとで確認してください。",
          );
          setState("empty");
          return;
        }

        const keepResult = await keepExchangePhotoForAlbum(exchangeResult.photo);
        setDeliveredPhoto(keepResult.photo);
        trackProductEvent("onboarding_delivered_photo_auto_kept", {
          source_photo_id: keepResult.photo.sourcePhotoId ?? null,
          saved_to_album: keepResult.saved,
        });
        if (!keepResult.saved) {
          setMessage("ねがおは届きましたが、アルバムに保存できませんでした。設定の保存状態を確認してください。");
        }
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

  function handleContinueAfterDelivery() {
    if (!deliveredPhoto) {
      return;
    }

    keepExchangePhoto(deliveredPhoto);
    trackProductEvent("onboarding_delivered_photo_confirmed", {
      source_photo_id: deliveredPhoto.sourcePhotoId ?? null,
      test_mode: isTestMode,
    });

    if (isTestMode) {
      router.push("/collection");
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
    setState("kept");
  }

  async function handleAddCandidatePhoto() {
    if (isCandidateAdding) {
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

      if (!file || !isLikelyImageFile(file)) {
        setMessage("写真を選べませんでした。別の写真でもう一度試してください。");
        cleanupInput();
        return;
      }

      setIsCandidateAdding(true);
      setMessage("");

      try {
        const saved = await saveStockCandidateWithFallback(file);

        if (!saved) {
          setMessage("候補写真を保存できませんでした。別の写真でもう一度試してください。");
          return;
        }

        const keepResult = await keepExchangePhotoForAlbum(
          toDeliveredExchangePhoto(saved),
        );
        setDeliveredPhoto(keepResult.photo);
        trackProductEvent("onboarding_test_candidate_auto_kept", {
          source_photo_id: keepResult.photo.sourcePhotoId ?? null,
          saved_to_album: keepResult.saved,
        });
        if (!keepResult.saved) {
          setMessage("候補は追加できましたが、アルバムに保存できませんでした。設定の保存状態を確認してください。");
        }
        setState("delivered");
      } catch {
        setMessage("候補写真を保存できませんでした。");
      } finally {
        setIsCandidateAdding(false);
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

  function handleGoHome() {
    if (isTestMode) {
      router.push("/settings");
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
    router.push("/home");
  }

  return (
    <main style={styles.page}>
      <style>{`
        @keyframes onboardingDots {
          0% { transform: translateX(-10px); opacity: 0.24; }
          45% { opacity: 0.72; }
          100% { transform: translateX(10px); opacity: 0.24; }
        }
        @keyframes deliveredEnvelope {
          0% { transform: translateY(8px) scale(0.94); opacity: 0; }
          55% { transform: translateY(-2px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes deliveredPhotoIn {
          0% { transform: translateY(18px) scale(0.9); opacity: 0; filter: blur(5px); }
          65% { transform: translateY(-2px) scale(1.015); opacity: 1; filter: blur(0); }
          100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes ownPhotoSend {
          0% { transform: translateX(0) scale(1); opacity: 0.74; }
          100% { transform: translateX(7px) scale(0.96); opacity: 0.54; }
        }
      `}</style>
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
              ねてるねこを入れると
              <br />
              どこかのねこの
              <br />
              ねがおが
              <br />
              1枚とどきます
            </h1>
            <p style={styles.lead}>
              いいねもコメントもなく、
              <br />
              ただ1枚だけ。
            </p>
            {state === "saving" ? (
              <DeliveryWaiting />
            ) : null}
            <button
              type="button"
              onClick={() => {
                void handleSelectSleepingPhoto();
              }}
              style={styles.primaryButton}
              disabled={state === "saving"}
            >
              {state === "saving" ? "とどけています..." : "ねてるねこを入れる"}
            </button>
            <button type="button" onClick={handleGoHome} style={styles.textButton}>
              あとで
            </button>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "delivered" && deliveredPhoto ? (
          <section style={styles.result} aria-label="とどいたねがお">
            <p style={styles.kicker}>ねがおが届きました</p>
            <div style={styles.deliveryEnvelope} aria-hidden="true">
              <AppIcon name="mail" size={24} />
            </div>
            {selectedPhotoSrc ? (
              <div style={styles.photoPair}>
                <div style={styles.photoItem}>
                  <img src={selectedPhotoSrc} alt="" style={styles.ownPhoto} />
                  <span style={styles.photoLabel}>入れた1枚</span>
                </div>
                <span style={styles.pairDots} />
                <div style={styles.photoItem}>
                  <StoredPhotoImage src={deliveredPhoto.src} alt="" style={styles.deliveredPhoto} />
                  <span style={styles.photoLabel}>届いた1枚</span>
                </div>
              </div>
            ) : (
              <div style={styles.singleDeliveredPhoto}>
                <StoredPhotoImage src={deliveredPhoto.src} alt="" style={styles.deliveredPhoto} />
                <span style={styles.photoLabel}>届いた1枚</span>
              </div>
            )}
            <p style={styles.resultText}>
              とっておくと、アルバムに入ります。
            </p>
            <button
              type="button"
              onClick={handleContinueAfterDelivery}
              style={styles.primaryButton}
            >
              {isTestMode ? "アルバムで見る" : "つぎへ"}
            </button>
            <button type="button" onClick={handleGoHome} style={styles.textButton}>
              閉じる
            </button>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "empty" ? (
          <section style={styles.result} aria-label="ねがおを保存しました">
            <p style={styles.kicker}>ねがおが入りました</p>
            {selectedPhotoSrc ? (
              <img src={selectedPhotoSrc} alt="" style={styles.savedPhoto} />
            ) : null}
            <p style={styles.resultText}>
              {isTestMode
                ? "とどく候補がまだありません。テスト用に、ここで候補を追加できます。"
                : "ねがおは保存されています。次に届く候補が増えるまで、少し待ってください。"}
            </p>
            {isTestMode ? (
              <button
                type="button"
                onClick={() => {
                  void handleAddCandidatePhoto();
                }}
                style={styles.primaryButton}
                disabled={isCandidateAdding}
              >
                {isCandidateAdding ? "追加しています..." : "とどく候補を追加する"}
              </button>
            ) : null}
            <button type="button" onClick={handleGoHome} style={styles.textButton}>
              ホームへ
            </button>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "kept" ? (
          <section style={styles.result} aria-label="保存しました">
            <p style={styles.kicker}>この2枚をとっておく</p>
            <h2 style={styles.subTitle}>
              アルバムに残すために
              <br />
              接続します
            </h2>
            <p style={styles.resultText}>
              接続すると、今日の2枚とこのねこの場所をあとから見返せます。
            </p>
            <a href="/account/create?from=onboarding" style={styles.primaryLink}>
              この2枚をとっておく
            </a>
            <a href="/collection" style={styles.secondaryLink}>
              アルバムで見る
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

function DeliveryWaiting() {
  return (
    <div style={styles.deliveryWaiting} aria-live="polite">
      <span style={styles.deliveryWaitingLine}>
        <span style={styles.deliveryWaitingDot} />
      </span>
      <span style={styles.deliveryWaitingText}>どこかのねがおを受け取っています</span>
    </div>
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
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (error) {
        reject(error);
      }
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
    { maxSize: 560, quality: 0.66 },
    { maxSize: 420, quality: 0.58 },
    { maxSize: 320, quality: 0.5 },
    { maxSize: 240, quality: 0.42 },
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

async function saveStockCandidateWithFallback(file: File) {
  const attempts = [
    { maxSize: 560, quality: 0.66 },
    { maxSize: 420, quality: 0.58 },
    { maxSize: 320, quality: 0.5 },
    { maxSize: 240, quality: 0.42 },
  ];

  for (const attempt of attempts) {
    const dataUrl = await resizeAndEncode(file, attempt.maxSize, attempt.quality);
    const saved = await saveRemoteDeliveryStockPhoto(dataUrl);

    if (saved) {
      return saved;
    }
  }

  return null;
}

function isLikelyImageFile(file: File) {
  if (file.type) {
    return file.type.startsWith("image/");
  }

  return /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function toDeliveredExchangePhoto(photo: ExchangePhotoPoolItem): ExchangePhoto {
  return {
    id: `onboarding-delivered-${photo.id}-${Date.now()}`,
    sourcePhotoId: photo.id,
    src: photo.src,
    title: photo.title,
    subtitle: photo.subtitle,
    triggerLabel: "ねがお",
    theme: "sleeping",
    deliveredAt: Date.now(),
  };
}

async function keepExchangePhotoForAlbum(photo: ExchangePhoto) {
  const candidates = await createAlbumPhotoCandidates(photo);

  for (const candidate of candidates) {
    if (keepExchangePhoto(candidate)) {
      return { photo: candidate, saved: true };
    }
  }

  return { photo: candidates[0] ?? photo, saved: false };
}

async function createAlbumPhotoCandidates(photo: ExchangePhoto) {
  if (!photo.src.startsWith("data:image/")) {
    return [photo];
  }

  const candidates: ExchangePhoto[] = [];
  const seenSrcs = new Set<string>();

  for (const attempt of [
    { maxSize: 420, quality: 0.62 },
    { maxSize: 320, quality: 0.56 },
    { maxSize: 240, quality: 0.5 },
    { maxSize: 180, quality: 0.44 },
  ]) {
    const compressedSrc = await resizeDataUrl(
      photo.src,
      attempt.maxSize,
      attempt.quality,
    );

    if (compressedSrc && isUsablePhotoSrc(compressedSrc) && !seenSrcs.has(compressedSrc)) {
      seenSrcs.add(compressedSrc);
      candidates.push({ ...photo, src: compressedSrc });
    }
  }

  if (isUsablePhotoSrc(photo.src) && !seenSrcs.has(photo.src)) {
    candidates.push(photo);
  }

  return candidates;
}

function resizeDataUrl(
  src: string,
  maxSize = 420,
  quality = 0.62,
): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => {
      resolve(null);
    };

    image.src = src;
  });
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
  deliveryWaiting: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    margin: "0 0 -4px",
  },
  deliveryWaitingLine: {
    position: "relative",
    width: "112px",
    height: "2px",
    borderRadius: "999px",
    overflow: "hidden",
    background:
      "repeating-linear-gradient(90deg, rgba(142,128,110,0.24) 0 4px, transparent 4px 10px)",
  },
  deliveryWaitingDot: {
    position: "absolute",
    top: "-2px",
    left: "50%",
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "rgba(154,134,107,0.7)",
    animation: "onboardingDots 1.1s ease-in-out infinite alternate",
  },
  deliveryWaitingText: {
    color: "#8a8174",
    fontFamily: SERIF,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: "0.08em",
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
  secondaryLink: {
    color: "#6a6258",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "4px 12px",
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
  deliveryEnvelope: {
    width: "54px",
    height: "54px",
    margin: "-2px 0 -2px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(244,228,221,0.72)",
    color: "#b98678",
    border: "1px solid rgba(178,132,116,0.14)",
    boxShadow: "0 10px 24px rgba(90,76,60,0.08)",
    animation: "deliveredEnvelope 460ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  photoPair: {
    display: "grid",
    gridTemplateColumns: "104px 32px 136px",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
  },
  photoItem: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
  },
  singleDeliveredPhoto: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
  },
  ownPhoto: {
    width: "96px",
    height: "96px",
    objectFit: "cover",
    borderRadius: "22px",
    opacity: 0.72,
    border: "6px solid rgba(255,253,248,0.74)",
    boxShadow: "0 8px 20px rgba(90,76,60,0.08)",
    animation: "ownPhotoSend 560ms ease-out both",
  },
  deliveredPhoto: {
    width: "128px",
    height: "128px",
    objectFit: "cover",
    borderRadius: "26px",
    border: "7px solid rgba(255,253,248,0.82)",
    boxShadow: "0 14px 34px rgba(90,76,60,0.12)",
    animation: "deliveredPhotoIn 620ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  photoLabel: {
    color: "#8a8174",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "0.04em",
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
