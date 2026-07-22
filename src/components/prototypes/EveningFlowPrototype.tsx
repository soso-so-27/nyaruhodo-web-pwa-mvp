"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  EveningDeliveryFourChoice,
  type EveningDeliveryChoiceUiResult,
} from "../home/HomeInput";
import type { EveningHomeState } from "../../lib/home/eveningDelivery";
import type {
  ExchangePhoto,
  ExchangePhotoReportReason,
} from "../../lib/home/sleepingPhotos";
import styles from "./EveningFlowPrototype.module.css";

type PrototypeStage = "ready" | "waiting" | "arrived" | "choosing" | "done";
type PrototypeResolution =
  | { kind: "kept"; photo: ExchangePhoto }
  | { kind: "skipped" }
  | null;

const DELIVERED_AT = Date.parse("2026-07-22T11:00:00.000Z");

const CANDIDATES: ExchangePhoto[] = [
  ["evening-preview-box", "/sample-cats/pose-box.webp"],
  ["evening-preview-loaf", "/sample-cats/pose-loaf.webp"],
  ["evening-preview-stretch", "/sample-cats/pose-stretch.webp"],
  ["evening-preview-belly", "/sample-cats/pose-belly.webp"],
].map(([id, src], index) => ({
  id,
  sourcePhotoId: `${id}-source`,
  src,
  title: "どこかのおうちのねこ",
  subtitle: "",
  triggerLabel: "sleeping",
  theme: "sleeping",
  deliveredAt: DELIVERED_AT + index,
}));

export function EveningFlowPrototype() {
  const [stage, setStage] = useState<PrototypeStage>("ready");
  const [ownPhotoSrc, setOwnPhotoSrc] = useState(
    "/sample-cats/mugi-portrait.webp",
  );
  const [hasOwnPhotoOverride, setHasOwnPhotoOverride] = useState(false);
  const [draftPhotoId, setDraftPhotoId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<PrototypeResolution>(null);
  const resolutionRef = useRef<PrototypeResolution>(null);

  const deliveryState = useMemo<
    Extract<EveningHomeState, { kind: "delivered" }>
  >(
    () => ({
      kind: "delivered",
      dateKey: "2026-07-22",
      targetPhoto: null,
      deliveredPhoto: CANDIDATES[0],
      deliveredPhotos: CANDIDATES,
      draftSelectedPhotoId: draftPhotoId ?? undefined,
      deliveryBundleId: "evening-preview-bundle",
      experienceVersion: "evening_choice_v1",
      assignedVariant: "four_choice_v1",
      servedVariant: "four_choice_v1",
      requestedCount: 4,
      servedCount: 4,
      fallbackReason: null,
    }),
    [draftPhotoId],
  );

  function handleOwnPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        return;
      }
      setOwnPhotoSrc(reader.result);
      setHasOwnPhotoOverride(true);
    };
    reader.readAsDataURL(file);
  }

  function setPrototypeResolution(next: PrototypeResolution) {
    resolutionRef.current = next;
    setResolution(next);
  }

  async function choosePhoto(
    photo: ExchangePhoto,
  ): Promise<EveningDeliveryChoiceUiResult> {
    const next = { kind: "kept" as const, photo };
    setPrototypeResolution(next);
    return { ...next, conflict: false };
  }

  async function skipChoice(): Promise<EveningDeliveryChoiceUiResult> {
    setPrototypeResolution({ kind: "skipped" });
    return { kind: "skipped", conflict: false };
  }

  function closeChoice() {
    setStage(resolutionRef.current ? "done" : "arrived");
  }

  function restart() {
    setStage("ready");
    setDraftPhotoId(null);
    setPrototypeResolution(null);
  }

  return (
    <main className={styles.page} data-testid="evening-flow-preview">
      <header className={styles.header}>
        <span className={styles.badge}>確認専用・本番保存なし</span>
        <h1>よる8時を、いま試す</h1>
        <p>写真を選んで、4枚から1枚を保存するところまで実機で確認できます。</p>
      </header>

      <section className={styles.phone} aria-live="polite">
        {stage === "ready" ? (
          <div className={styles.screen} data-testid="evening-preview-ready">
            <p className={styles.eyebrow}>今夜送るねがお</p>
            <div className={styles.ownPhotoFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ownPhotoSrc} alt="今夜送るねがお" />
            </div>
            <label className={styles.fileButton}>
              {hasOwnPhotoOverride ? "写真を変える" : "自分の写真で試す"}
              <input
                type="file"
                accept="image/*"
                onChange={handleOwnPhoto}
              />
            </label>
            <button
              type="button"
              className={styles.primaryButton}
              data-testid="evening-preview-send"
              onClick={() => setStage("waiting")}
            >
              この写真で試す
            </button>
          </div>
        ) : null}

        {stage === "waiting" ? (
          <div className={styles.screen} data-testid="evening-preview-waiting">
            <p className={styles.eyebrow}>送信できました</p>
            <div className={styles.sentPhoto}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ownPhotoSrc} alt="送ったねがお" />
              <span>送った</span>
            </div>
            <div className={styles.waitingCard}>
              <span className={styles.moon} aria-hidden="true">☾</span>
              <strong>よる8時を待っています</strong>
              <small>確認では、待たずに先へ進めます。</small>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              data-testid="evening-preview-advance"
              onClick={() => setStage("arrived")}
            >
              今すぐ、よる8時に進める
            </button>
          </div>
        ) : null}

        {stage === "arrived" ? (
          <div className={styles.screen} data-testid="evening-preview-arrived">
            <p className={styles.eyebrow}>よる8時</p>
            <button
              type="button"
              className={styles.letter}
              data-testid="evening-preview-open"
              onClick={() => setStage("choosing")}
            >
              <span className={styles.letterFlap} aria-hidden="true" />
              <span className={styles.letterSeal} aria-hidden="true">猫</span>
              <strong>ねこだより、とどいた</strong>
              <small>ひらく</small>
            </button>
            {draftPhotoId ? (
              <p className={styles.draftNote}>さっき選んだ1枚から再開します。</p>
            ) : (
              <p className={styles.draftNote}>今夜とどいた4枚のねこだよりを見てみましょう。</p>
            )}
          </div>
        ) : null}

        {stage === "done" ? (
          <div className={styles.screen} data-testid="evening-preview-done">
            {resolution?.kind === "kept" ? (
              <>
                <p className={styles.eyebrow}>確認完了</p>
                <div className={styles.keptPhoto}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolution.photo.src} alt="保存した猫" />
                </div>
                <h2>1枚を「とどいた」に保存しました</h2>
              </>
            ) : (
              <>
                <p className={styles.eyebrow}>確認完了</p>
                <div className={styles.emptyStamp} aria-hidden="true">✓</div>
                <h2>今回は保存しませんでした</h2>
              </>
            )}
            <p className={styles.safeNote}>確認用のため、本番データは変わっていません。</p>
            <button
              type="button"
              className={styles.primaryButton}
              data-testid="evening-preview-restart"
              onClick={restart}
            >
              もう一度試す
            </button>
          </div>
        ) : null}
      </section>

      <p className={styles.footerNote}>
        このページはローカルとPreviewだけで表示され、本番ではひらけません。
      </p>

      {stage === "choosing" ? (
        <EveningDeliveryFourChoice
          state={deliveryState}
          initialDecodeStatus="ready"
          onChoose={choosePhoto}
          onDraftChange={(photoId) => {
            setDraftPhotoId(photoId);
            return true;
          }}
          onSkip={skipChoice}
          onReport={(
            _photo: ExchangePhoto,
            _reason: ExchangePhotoReportReason,
          ) => undefined}
          onStorageDataUrl={() => undefined}
          onClose={closeChoice}
          analyticsEnabled={false}
        />
      ) : null}
    </main>
  );
}
