"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { readClientAdminCapabilities } from "../../lib/adminCapabilitiesClient";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  createSleepingExchange,
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  keepExchangePhoto,
  saveOwnSleepingPhoto,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import {
  getEveningDeliveryCompletionCopy,
  recordEveningDeliveryTarget,
} from "../../lib/home/eveningDelivery";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { isUsablePhotoSrc } from "../../lib/photoStorage";
import {
  getActiveCatProfile,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import { AppButton } from "../ui/AppButton";
import { PhotoTile } from "../ui/PhotoTile";
import { WordmarkHeader } from "../ui/AppHeader";

type OnboardingState =
  | "intro"
  | "saving"
  | "envelope"
  | "revealing"
  | "delivered"
  | "empty"
  | "kept";

const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";

export function OnboardingFlow() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>("intro");
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState("");
  const [deliveredPhoto, setDeliveredPhoto] = useState<ExchangePhoto | null>(null);
  const [isDeliveredPhotoKept, setIsDeliveredPhotoKept] = useState(false);
  const [pendingOwnPhoto, setPendingOwnPhoto] = useState<OwnSleepingPhoto | null>(null);
  const [message, setMessage] = useState("");
  const [isCandidateAdding, setIsCandidateAdding] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [completionCopy, setCompletionCopy] = useState("");
  const autoKeptDeliveredPhotoIdRef = useRef("");

  function markOnboardingAlbumCompletionReady() {
    window.sessionStorage.setItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY, "true");
  }

  useEffect(() => {
    let isMounted = true;

    async function resolveTestMode() {
      const requestedTestMode = new URLSearchParams(window.location.search).has("test");

      if (!requestedTestMode) {
        return;
      }

      const capabilities = await readClientAdminCapabilities();

      if (isMounted) {
        setIsTestMode(capabilities.testToolsEnabled);
      }
    }

    void resolveTestMode();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (state !== "delivered" || !deliveredPhoto || isDeliveredPhotoKept) {
      return;
    }

    if (autoKeptDeliveredPhotoIdRef.current === deliveredPhoto.id) {
      return;
    }

    autoKeptDeliveredPhotoIdRef.current = deliveredPhoto.id;
    void keepDeliveredPhotoForOnboarding();
  }, [state, deliveredPhoto, isDeliveredPhotoKept]);

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
        setMessage("写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください。");
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
          setMessage("写真を保存できませんでした。JPEGやPNGの写真で、もう一度試してください。");
          setState("intro");
          return;
        }

        const { dataUrl, ownPhoto } = savedResult;
        setSelectedPhotoSrc(dataUrl);
        setPendingOwnPhoto(ownPhoto);
        setIsDeliveredPhotoKept(false);
        autoKeptDeliveredPhotoIdRef.current = "";
        const eveningTarget = recordEveningDeliveryTarget(ownPhoto);
        trackProductEvent("take_photo", {
          catId,
          hour: new Date().getHours(),
          isExchangeTarget: eveningTarget.isExchangeTarget,
          source: "onboarding",
          delivery_date_key: eveningTarget.dateKey,
        });

        const delivered = await deliverOwnSleepingPhoto({
          ownPhoto,
          recipientCatId: catId,
          emptyMessage: isTestMode
            ? "ねがおは入りました。とどく候補がまだありません。テスト用に候補を追加できます。"
            : "ねがおは入りました。今日はまだ、とどくねがおを準備中です。",
        });

        if (!delivered) {
          setMessage(
            isTestMode
              ? "ねがおは入りました。とどく候補がまだありません。テスト用に候補を追加できます。"
              : "ねがおは入りました。今日はまだ、とどくねがおを準備中です。",
          );
          setState("empty");
          return;
        }
      } catch {
        setMessage("写真を保存できませんでした。JPEGやPNGの写真で、もう一度試してください。");
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

  async function keepDeliveredPhotoForOnboarding() {
    if (!deliveredPhoto) {
      return;
    }

    const keepResult = await keepExchangePhotoForAlbum(deliveredPhoto);
    setDeliveredPhoto(keepResult.photo);
    trackProductEvent("onboarding_delivered_photo_confirmed", {
      source_photo_id: keepResult.photo.sourcePhotoId ?? null,
      saved_to_album: keepResult.saved,
      test_mode: isTestMode,
    });

    if (!keepResult.saved) {
      setMessage("ねがおはとどきましたが、アルバムに保存できませんでした。設定の保存状態を確認してください。");
      return;
    }

    setIsDeliveredPhotoKept(true);

    if (!isTestMode) {
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      setCompletionCopy(getEveningDeliveryCompletionCopy());
    }
  }

  function handleOpenEnvelope() {
    if (!deliveredPhoto) {
      return;
    }

    trackProductEvent("envelope_opened", {
      source: "onboarding",
      photo_id: deliveredPhoto.id,
    });
    setState("revealing");
    window.setTimeout(() => {
      setState("delivered");
    }, 1400);
  }

  async function deliverOwnSleepingPhoto({
    ownPhoto,
    recipientCatId,
    emptyMessage,
    preferredSourcePhotoId,
  }: {
    ownPhoto: OwnSleepingPhoto;
    recipientCatId: string;
    emptyMessage: string;
    preferredSourcePhotoId?: string | null;
  }) {
    const exchangeResult = await createSleepingExchange({
      ownPhoto,
      triggerLabel: "ねがお",
      theme: "sleeping",
      category: "sleeping",
      seed: `${ownPhoto.id}:${Date.now()}`,
      recipientCatId,
      preferredSourcePhotoId,
      mode: "onboarding",
    });

    trackProductEvent("onboarding_sleeping_photo_delivered", {
      has_delivered_photo: Boolean(exchangeResult?.photo),
      candidate_count: exchangeResult?.diagnostics?.candidateCount ?? null,
      available_count: exchangeResult?.diagnostics?.availableCount ?? null,
      excluded_count: exchangeResult?.diagnostics?.excludedCount ?? null,
    });

    if (!exchangeResult?.photo) {
      setMessage(emptyMessage);
      return false;
    }

    setDeliveredPhoto(exchangeResult.photo);
    setIsDeliveredPhotoKept(false);
    trackProductEvent("envelope_shown", {
      source: "onboarding",
      photo_id: exchangeResult.photo.id,
    });
    setState("envelope");
    return true;
  }

  async function handleAddCandidatePhoto() {
    if (!isTestMode) {
      return;
    }

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

        trackProductEvent("onboarding_test_candidate_added", {
          source_photo_id: saved.sourceOwnPhotoId ?? saved.id,
        });

        if (!pendingOwnPhoto) {
          setMessage("とどく候補を追加しました。もう一度ねてるねこを入れるととどきます。");
          setState("intro");
          return;
        }

        const delivered = await deliverOwnSleepingPhoto({
          ownPhoto: pendingOwnPhoto,
          recipientCatId: pendingOwnPhoto.catId,
          preferredSourcePhotoId: saved.sourceOwnPhotoId ?? saved.id,
          emptyMessage:
            "とどく候補を追加しましたが、まだ受け取れませんでした。設定のとどく状態を確認してください。",
        });

        if (!delivered) {
          setState("empty");
        }
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
          100% { transform: translateX(4px) scale(1); opacity: 0.64; }
        }
        @keyframes onboardingEnvelopeFloat {
          0%, 100% { transform: translateY(0) rotate(-0.8deg); }
          50% { transform: translateY(-5px) rotate(0.5deg); }
        }
      `}</style>
      <div style={styles.paperBackground} aria-hidden="true" />
      <div style={styles.container}>
        <WordmarkHeader style={styles.brandHeader} />

        {state === "intro" || state === "saving" ? (
          <section style={styles.hero} aria-label="ねてるねこのはじめかた">
            <div style={styles.introArtifact} aria-hidden="true">
              <img
                src="/illustrations/sleeping-cat-empty.png"
                alt=""
                style={styles.introCat}
              />
              <OnboardingEnvelopeArt compact />
            </div>
            <h1 style={styles.title}>
              ねがおを入れると
              <br />
              ねこだよりが届きます
            </h1>
            <p style={styles.lead}>
              自分のねこの写真を1枚入れると、
              <br />
              どこかのねこの寝顔が1枚届きます。
              <br />
              写真は公開されません。
            </p>
            {state === "saving" ? (
              <DeliveryWaiting />
            ) : null}
            <AppButton
              type="button"
              onClick={() => {
                void handleSelectSleepingPhoto();
              }}
              fullWidth
              style={styles.onboardingCta}
              disabled={state === "saving"}
            >
              {state === "saving" ? "ねこだよりを準備しています..." : "ねがおを入れて受け取る"}
            </AppButton>
            <AppButton type="button" variant="quiet" size="md" onClick={handleGoHome}>
              あとで
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "envelope" && deliveredPhoto ? (
          <section style={styles.result} aria-label="ねがおがとどいています">
            <OnboardingEnvelopeArt />
            <h2 style={styles.subTitle}>
              ねこだよりが
              <br />
              届きました
            </h2>
            <button
              type="button"
              onClick={handleOpenEnvelope}
              style={styles.deliveryEnvelopeButton}
            >
              ねこだよりを開く
            </button>
          </section>
        ) : null}

        {state === "revealing" && deliveredPhoto ? (
          <section style={styles.result} aria-label="どこかのねがお">
            <div style={styles.revealingPhotoFrame}>
              <PhotoTile
                src={deliveredPhoto.src}
                imageStyle={styles.revealingPhoto}
              />
            </div>
          </section>
        ) : null}

        {state === "delivered" && deliveredPhoto ? (
          <section style={styles.result} aria-label="とどいたねがお">
            <p style={styles.kicker}>ねこだよりが届きました</p>
            {selectedPhotoSrc ? (
              <div style={styles.deliveredMoment}>
                <PhotoTile
                  src={deliveredPhoto.src}
                  style={styles.deliveredPhotoTile}
                  imageStyle={styles.deliveredPhoto}
                />
                <PhotoTile
                  src={selectedPhotoSrc}
                  muted
                  style={styles.ownPhotoTile}
                  imageStyle={styles.ownPhoto}
                />
              </div>
            ) : (
              <PhotoTile
                src={deliveredPhoto.src}
                style={styles.deliveredPhotoTile}
                imageStyle={styles.deliveredPhoto}
              />
            )}
            <p style={styles.resultText}>
              {isDeliveredPhotoKept
                ? "届いた写真は、ねこだよりに入りました。今日のねがおは、よる8時の便りになります。"
                : "届いた写真を、ねこだよりに入れています。"}
            </p>
            <AppButton
              type="button"
              onClick={
                isDeliveredPhotoKept
                  ? () => router.push("/collection")
                  : undefined
              }
              disabled={!isDeliveredPhotoKept}
              fullWidth
              style={styles.onboardingCta}
            >
              {isDeliveredPhotoKept ? "ねこだよりを見る" : "ねこだよりに入れています..."}
            </AppButton>
            <AppButton type="button" variant="quiet" size="md" onClick={handleGoHome}>
              閉じる
            </AppButton>
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
                : "今日はまだ、届くねこだよりを準備中です。"}
            </p>
            {isTestMode ? (
              <AppButton
                type="button"
                onClick={() => {
                  void handleAddCandidatePhoto();
                }}
                fullWidth
                style={styles.onboardingCta}
                disabled={isCandidateAdding}
              >
                {isCandidateAdding ? "追加しています..." : "とどく候補を追加する"}
              </AppButton>
            ) : null}
            <AppButton type="button" variant="quiet" size="md" onClick={handleGoHome}>
              ねてるねこへ
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "kept" ? (
          <section style={styles.result} aria-label="とっておきました">
            <p style={styles.kicker}>とっておきました</p>
            {completionCopy ? (
              <p style={styles.resultText}>{completionCopy}</p>
            ) : null}
            <h2 style={styles.subTitle}>
              また寝ていたら、
              <br />
              ホームから送れます
            </h2>
            <AppButton
              type="button"
              onClick={handleGoHome}
              fullWidth
              style={styles.onboardingCta}
            >
              ホームへ戻る
            </AppButton>
            <AppButton
              href="/account/create?from=onboarding"
              variant="quiet"
              size="md"
              onClick={markOnboardingAlbumCompletionReady}
            >
              うちのこを登録する
            </AppButton>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function OnboardingEnvelopeArt({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        ...styles.onboardingEnvelopeArt,
        ...(compact ? styles.onboardingEnvelopeArtCompact : {}),
      }}
      aria-hidden="true"
    >
      <span style={styles.onboardingEnvelopeShadow} />
      <img
        src="/illustrations/onboarding-envelope.png"
        alt=""
        style={styles.onboardingEnvelopeImage}
      />
    </span>
  );
}

function DeliveryWaiting() {
  return (
    <div style={styles.deliveryWaiting} aria-live="polite">
      <span style={styles.deliveryWaitingLine}>
        <span style={styles.deliveryWaitingDot} />
      </span>
      <span style={styles.deliveryWaitingText}>
        ねがおを
        <br />
        おあずかりしました
      </span>
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

const UI_FONT = "var(--font-ui)";

const styles = {
  page: {
    position: "relative",
    minHeight: "100dvh",
    overflow: "hidden",
    color: "#2f2a25",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif',
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
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
  brandHeader: {
    position: "fixed",
    top: "calc(42px + env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    paddingTop: 0,
  },
  hero: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "13px",
  },
  introArtifact: {
    position: "relative",
    width: "min(74vw, 260px)",
    height: "154px",
    display: "grid",
    placeItems: "center",
    margin: "-4px 0 10px",
  },
  introCat: {
    position: "absolute",
    zIndex: 2,
    top: "0",
    left: "50%",
    width: "94px",
    height: "94px",
    objectFit: "contain",
    transform: "translateX(-50%)",
    filter:
      "drop-shadow(0 10px 14px rgba(92,70,46,0.08)) saturate(0.94)",
  },
  onboardingEnvelopeArt: {
    position: "relative",
    display: "block",
    width: "min(82vw, 304px)",
    aspectRatio: "1375 / 664",
    margin: "0 auto",
    animation: "onboardingEnvelopeFloat 4.8s ease-in-out infinite",
  },
  onboardingEnvelopeArtCompact: {
    position: "absolute",
    zIndex: 1,
    bottom: "0",
    width: "200px",
    opacity: 0.94,
  },
  onboardingEnvelopeShadow: {
    position: "absolute",
    left: "12%",
    right: "12%",
    bottom: "1px",
    height: "18px",
    borderRadius: "999px",
    background:
      "radial-gradient(ellipse at center, rgba(92,70,46,0.14), transparent 70%)",
    filter: "blur(2px)",
  },
  onboardingEnvelopeImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    filter: "drop-shadow(0 14px 22px rgba(68,50,32,0.08))",
  },
  title: {
    margin: "8px 0 0",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "22px",
    fontWeight: 400,
    lineHeight: 1.56,
    letterSpacing: "0.04em",
  },
  lead: {
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
  deliveryWaiting: {
    display: "grid",
    justifyItems: "center",
    gap: "9px",
    margin: "4px 0 -2px",
    padding: "12px 18px 13px",
    border: "1px solid rgba(144,126,102,0.1)",
    borderRadius: "var(--radius-xl)",
    background: "rgba(255,253,248,0.48)",
    boxShadow: "0 5px 14px rgba(90,76,60,0.035)",
  },
  deliveryWaitingLine: {
    position: "relative",
    width: "112px",
    height: "2px",
    borderRadius: "var(--radius-full)",
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
    borderRadius: "var(--radius-full)",
    background: "rgba(154,134,107,0.7)",
    animation: "onboardingDots 1.1s ease-in-out infinite alternate",
  },
  deliveryWaitingText: {
    color: "#746a5f",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: 0,
  },
  onboardingCta: {
    width: "min(100%, 280px)",
    marginTop: "16px",
  },
  onboardingCtaLink: {
    width: "min(100%, 280px)",
    marginTop: "20px",
  },
  message: {
    margin: "2px 0 0",
    width: "min(100%, 280px)",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,253,248,0.64)",
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.55,
    padding: "10px 12px",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  result: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "17px",
  },
  kicker: {
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.03em",
  },
  subTitle: {
    margin: "6px 0 0",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "22px",
    fontWeight: 400,
    lineHeight: 1.56,
    letterSpacing: "0.04em",
  },
  deliveryEnvelopeButton: {
    width: "min(100%, 260px)",
    minHeight: "54px",
    border: "1px solid color-mix(in srgb, var(--seal) 28%, var(--line) 72%)",
    borderRadius: "var(--radius-full)",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.94), rgba(250,244,235,0.88))",
    color: "var(--seal)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 1px 0 rgba(255,255,255,0.5) inset, 0 16px 30px -24px rgba(90,76,60,0.42)",
    fontFamily: UI_FONT,
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: "0.03em",
    cursor: "pointer",
    animation: "deliveredEnvelope 460ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  revealingPhotoFrame: {
    width: "min(100%, 292px)",
    display: "grid",
    justifyItems: "center",
    animation: "deliveredPhotoIn 780ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  revealingPhoto: {
    width: "min(72vw, 268px)",
    height: "min(72vw, 268px)",
    objectFit: "cover",
    borderRadius: "var(--radius-2xl)",
    boxShadow: "0 18px 44px rgba(90,76,60,0.12)",
  },
  deliveredMoment: {
    position: "relative",
    width: "min(100%, 292px)",
    minHeight: "318px",
    display: "grid",
    justifyItems: "center",
    alignItems: "start",
    margin: "2px 0 0",
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
  deliveredPhotoTile: {
    position: "relative",
    zIndex: 2,
  },
  ownPhotoTile: {
    position: "absolute",
    zIndex: 3,
    right: "2px",
    bottom: "4px",
    transform: "rotate(3.2deg)",
  },
  ownPhoto: {
    width: "92px",
    height: "92px",
    objectFit: "cover",
    borderRadius: "20px",
    opacity: 0.78,
    border: "6px solid rgba(255,253,248,0.82)",
    boxShadow: "0 12px 24px -14px rgba(72,54,35,0.42)",
    animation: "ownPhotoSend 560ms ease-out both",
  },
  deliveredPhoto: {
    width: "min(74vw, 268px)",
    height: "min(74vw, 268px)",
    objectFit: "cover",
    borderRadius: "28px",
    border: "8px solid rgba(255,253,248,0.86)",
    boxShadow: "0 22px 46px -24px rgba(66,48,31,0.5)",
    animation: "deliveredPhotoIn 620ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  photoLabel: {
    color: "#8a8174",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "0.04em",
  },
  savedPhoto: {
    width: "min(100%, 260px)",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "var(--radius-2xl)",
    border: "7px solid rgba(255,253,248,0.82)",
    boxShadow: "0 14px 34px rgba(90,76,60,0.12)",
  },
  resultText: {
    width: "min(100%, 286px)",
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;
