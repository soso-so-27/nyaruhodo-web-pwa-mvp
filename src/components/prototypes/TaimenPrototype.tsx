"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { color, radius, shadow, spacing, typography } from "../ui/designTokens";

type PrototypeMode = "b1" | "b2";
type PhotoPattern = "mixed" | "portrait" | "landscape";
type PrototypePhoto = {
  src: string;
  label: string;
  tone: string;
};

const defaultPhotos: Record<PhotoPattern, { own: PrototypePhoto; delivered: PrototypePhoto }> = {
  mixed: {
    own: {
      src: "/sample-cats/mugi-portrait.png",
      label: "むぎ",
      tone: "縦長寄り",
    },
    delivered: {
      src: "/sample-cats/pose-stretch.png",
      label: "どこかのこ",
      tone: "横長寄り",
    },
  },
  portrait: {
    own: {
      src: "/sample-cats/mugi-hero.png",
      label: "むぎ",
      tone: "縦長",
    },
    delivered: {
      src: "/sample-cats/orange_tabby.png",
      label: "どこかのこ",
      tone: "縦長",
    },
  },
  landscape: {
    own: {
      src: "/sample-cats/pose-loaf.png",
      label: "むぎ",
      tone: "横長",
    },
    delivered: {
      src: "/sample-cats/pose-box.png",
      label: "どこかのこ",
      tone: "横長",
    },
  },
};

const modes: Array<{ id: PrototypeMode; label: string; caption: string }> = [
  {
    id: "b1",
    label: "改1",
    caption: "便箋として下に敷く",
  },
  {
    id: "b2",
    label: "改2",
    caption: "切手として隅に貼る",
  },
];

const patterns: Array<{ id: PhotoPattern; label: string }> = [
  { id: "mixed", label: "縦横まぜ" },
  { id: "portrait", label: "縦長どうし" },
  { id: "landscape", label: "横長どうし" },
];

export function TaimenPrototype() {
  const [mode, setMode] = useState<PrototypeMode>("b1");
  const [pattern, setPattern] = useState<PhotoPattern>("mixed");
  const [ownOverride, setOwnOverride] = useState<string | null>(null);
  const [deliveredOverride, setDeliveredOverride] = useState<string | null>(null);
  const photos = useMemo(() => {
    const base = defaultPhotos[pattern];
    return {
      own: { ...base.own, src: ownOverride ?? base.own.src },
      delivered: {
        ...base.delivered,
        src: deliveredOverride ?? base.delivered.src,
      },
    };
  }, [deliveredOverride, ownOverride, pattern]);

  const handleFile = (target: "own" | "delivered", file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : null;
      if (target === "own") {
        setOwnOverride(value);
      } else {
        setDeliveredOverride(value);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <span style={styles.kicker}>taimen b refine</span>
        <h1 style={styles.title}>対面表示 Bリファイン</h1>
        <p style={styles.lead}>
          むぎを主役にしたまま、届いた寝顔を「便箋」か「切手」として添える静止比較です。実機では下の入力から、むぎの実写真に差し替えられます。
        </p>
      </section>

      <AppCard variant="outlined" padding="standard" style={styles.controls}>
        <div style={styles.controlGroup} aria-label="案を選ぶ">
          {modes.map((item) => (
            <AppButton
              key={item.id}
              type="button"
              variant={mode === item.id ? "primary" : "quiet"}
              size="sm"
              selected={mode === item.id}
              data-testid={`taimen-mode-button-${item.id}`}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </AppButton>
          ))}
        </div>
        <div style={styles.controlGroup} aria-label="写真比率を選ぶ">
          {patterns.map((item) => (
            <AppButton
              key={item.id}
              type="button"
              variant={pattern === item.id ? "secondary" : "quiet"}
              size="sm"
              selected={pattern === item.id}
              data-testid={`taimen-pattern-button-${item.id}`}
              onClick={() => setPattern(item.id)}
            >
              {item.label}
            </AppButton>
          ))}
        </div>
        <div style={styles.fileGrid}>
          <label style={styles.fileInput}>
            <span>むぎ写真</span>
            <span style={styles.fileButton}>写真を選ぶ</span>
            <span style={styles.fileState}>
              {ownOverride ? "差し替え済み" : "サンプル表示中"}
            </span>
            <input
              type="file"
              accept="image/*"
              style={styles.hiddenFileInput}
              onChange={(event) => handleFile("own", event.target.files?.[0] ?? null)}
            />
          </label>
          <label style={styles.fileInput}>
            <span>届いた写真</span>
            <span style={styles.fileButton}>写真を選ぶ</span>
            <span style={styles.fileState}>
              {deliveredOverride ? "差し替え済み" : "サンプル表示中"}
            </span>
            <input
              type="file"
              accept="image/*"
              style={styles.hiddenFileInput}
              onChange={(event) =>
                handleFile("delivered", event.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
      </AppCard>

      <section style={styles.phoneFrame} data-testid="taimen-prototype-frame">
        <div style={styles.phoneHeader}>
          <span style={styles.dateText}>きょうの 2まい</span>
          <span style={styles.modeText}>
            {modes.find((item) => item.id === mode)?.caption}
          </span>
        </div>
        {mode === "b1" ? <LetterBelow photos={photos} /> : null}
        {mode === "b2" ? <StampCorner photos={photos} /> : null}
      </section>

      <section style={styles.notes}>
        <PrototypeNote
          title="改1"
          body="むぎ写真の下に便箋を置き、届いた寝顔を読める大きさで添えます。2匹を両方見る寄りです。"
        />
        <PrototypeNote
          title="改2"
          body="むぎ写真を絵葉書の主役にし、届いた寝顔は切手のしるしとして隅に置きます。"
        />
      </section>
    </main>
  );
}

function LetterBelow({
  photos,
}: {
  photos: { own: PrototypePhoto; delivered: PrototypePhoto };
}) {
  return (
    <div style={styles.letterBelowWrap} data-testid="taimen-mode-b1">
      <HeroPhoto photo={photos.own} aspect="3 / 4" fit="cover" />
      <div style={styles.stationeryCard} aria-label="届いた便箋">
        <div style={styles.stationeryPhotoFrame}>
          <img
            src={photos.delivered.src}
            alt={photos.delivered.label}
            style={styles.stationeryPhoto}
          />
        </div>
        <div style={styles.stationeryText}>
          <span>どこかのこから</span>
        </div>
      </div>
      <p style={styles.variantCaption}>
        むぎの下に、届いた手紙をそっと置きます。
      </p>
    </div>
  );
}

function StampCorner({
  photos,
}: {
  photos: { own: PrototypePhoto; delivered: PrototypePhoto };
}) {
  return (
    <div style={styles.stampWrap} data-testid="taimen-mode-b2">
      <div style={styles.postcardPhoto}>
        <img src={photos.own.src} alt={photos.own.label} style={styles.postcardImage} />
        <div style={styles.stampCard} aria-label="届いた切手">
          <span style={styles.stampPerforation} aria-hidden="true" />
          <img
            src={photos.delivered.src}
            alt={photos.delivered.label}
            style={styles.stampImage}
          />
        </div>
      </div>
      <p style={styles.variantCaption}>
        むぎの絵葉書に、届いた寝顔の切手を貼ります。
      </p>
    </div>
  );
}

function HeroPhoto({
  photo,
  aspect,
  fit,
}: {
  photo: PrototypePhoto;
  aspect: string;
  fit: "cover" | "contain";
}) {
  return (
    <figure style={styles.heroFigure}>
      <span style={{ ...styles.heroFrame, aspectRatio: aspect }}>
        <img
          src={photo.src}
          alt={photo.label}
          style={{ ...styles.heroImage, objectFit: fit }}
        />
      </span>
      <figcaption style={styles.photoLabel}>{photo.label}</figcaption>
    </figure>
  );
}

function PrototypeNote({ title, body }: { title: string; body: string }) {
  return (
    <AppCard variant="inset" padding="standard" style={styles.note}>
      <h2 style={styles.noteTitle}>{title}</h2>
      <p style={styles.noteBody}>{body}</p>
    </AppCard>
  );
}

const photoFrameBase = {
  display: "block",
  overflow: "hidden",
  border: `8px solid ${color.paper}`,
  background: color.paper,
  boxShadow: shadow.e1,
} satisfies CSSProperties;

const styles = {
  page: {
    minHeight: "100dvh",
    padding: `${spacing.xxl}px ${spacing.xl}px ${spacing.xxl}px`,
    background: "var(--bg-gradient)",
    color: color.text,
    fontFamily: typography.fontUi,
  },
  header: {
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: spacing.md,
    textAlign: "center",
  },
  kicker: {
    color: color.textFaint,
    fontSize: 12,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: color.text,
    fontFamily: typography.fontDisplay,
    fontSize: 24,
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.5,
  },
  lead: {
    margin: 0,
    color: color.textMuted,
    fontSize: 13,
    lineHeight: 1.7,
  },
  controls: {
    width: "min(100%, 720px)",
    margin: `${spacing.xl}px auto 0`,
    display: "grid",
    gap: spacing.lg,
  },
  controlGroup: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
  fileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: spacing.md,
  },
  fileInput: {
    position: "relative",
    display: "grid",
    gap: spacing.sm,
    color: color.textMuted,
    fontSize: 13,
  },
  fileButton: {
    display: "inline-flex",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${color.border}`,
    borderRadius: radius.pill,
    background: "color-mix(in srgb, var(--paper) 78%, transparent)",
    color: color.text,
    fontFamily: typography.fontUi,
    letterSpacing: "0.12em",
    cursor: "pointer",
  },
  fileState: {
    color: color.textFaint,
    fontSize: 12,
    lineHeight: 1.5,
  },
  hiddenFileInput: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
  phoneFrame: {
    width: "min(100%, 390px)",
    minHeight: 680,
    margin: `${spacing.xl}px auto 0`,
    padding: `${spacing.xl}px ${spacing.lg}px`,
    borderRadius: radius.xxl24,
    background: "linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%)",
    boxShadow: shadow.e2,
    display: "grid",
    alignContent: "start",
    gap: spacing.xl,
  },
  phoneHeader: {
    display: "grid",
    justifyItems: "center",
    gap: spacing.xs,
    minHeight: 64,
  },
  dateText: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    letterSpacing: "0.12em",
    color: color.text,
  },
  modeText: {
    fontSize: 12,
    letterSpacing: "0.12em",
    color: color.textFaint,
  },
  letterBelowWrap: {
    display: "grid",
    justifyItems: "center",
    gap: spacing.lg,
  },
  heroFigure: {
    width: "82%",
    margin: 0,
    display: "grid",
    gap: spacing.md,
    justifyItems: "center",
  },
  heroFrame: {
    ...photoFrameBase,
    width: "100%",
    borderRadius: radius.xl,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  photoLabel: {
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 13,
    letterSpacing: "0.1em",
  },
  stationeryCard: {
    width: "82%",
    padding: spacing.lg,
    borderRadius: radius.xl,
    background: color.surfaceSoft,
    boxShadow: shadow.e1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: spacing.md,
  },
  stationeryPhotoFrame: {
    overflow: "hidden",
    aspectRatio: "4 / 3",
    borderRadius: radius.lg,
    background: color.paper,
    border: `1px solid ${color.border}`,
  },
  stationeryPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  stationeryText: {
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 13,
    letterSpacing: "0.08em",
    textAlign: "center",
  },
  stampWrap: {
    display: "grid",
    justifyItems: "center",
    gap: spacing.xl,
    paddingTop: spacing.sm,
  },
  postcardPhoto: {
    ...photoFrameBase,
    position: "relative",
    width: "88%",
    aspectRatio: "3 / 4",
    borderRadius: radius.xl,
  },
  postcardImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  stampCard: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 88,
    aspectRatio: "1 / 1",
    padding: 6,
    transform: "rotate(4deg)",
    borderRadius: radius.md,
    background: color.surfaceSoft,
    boxShadow: shadow.e1,
  },
  stampPerforation: {
    position: "absolute",
    inset: 5,
    border: `1px dashed ${color.border}`,
    borderRadius: radius.sm,
    pointerEvents: "none",
  },
  stampImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    borderRadius: radius.sm,
  },
  variantCaption: {
    margin: 0,
    maxWidth: 280,
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 13,
    letterSpacing: "0.08em",
    lineHeight: 1.7,
    textAlign: "center",
  },
  notes: {
    width: "min(100%, 720px)",
    margin: `${spacing.xl}px auto 0`,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: spacing.md,
  },
  note: {
    display: "grid",
    gap: spacing.sm,
  },
  noteTitle: {
    margin: 0,
    color: color.text,
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: 400,
    letterSpacing: "0.08em",
  },
  noteBody: {
    margin: 0,
    color: color.textMuted,
    fontSize: 13,
    lineHeight: 1.7,
  },
} satisfies Record<string, CSSProperties>;
