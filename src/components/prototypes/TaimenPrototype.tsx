"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { color, radius, shadow, spacing, typography } from "../ui/designTokens";

type PrototypeMode = "a" | "b" | "c";
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
    id: "a",
    label: "案A",
    caption: "対等並置",
  },
  {
    id: "b",
    label: "案B",
    caption: "むぎ主役+手紙",
  },
  {
    id: "c",
    label: "案C",
    caption: "1枚ずつめくる",
  },
];

const patterns: Array<{ id: PhotoPattern; label: string }> = [
  { id: "mixed", label: "縦横まぜ" },
  { id: "portrait", label: "縦長どうし" },
  { id: "landscape", label: "横長どうし" },
];

export function TaimenPrototype() {
  const [mode, setMode] = useState<PrototypeMode>("b");
  const [pattern, setPattern] = useState<PhotoPattern>("mixed");
  const [ownOverride, setOwnOverride] = useState<string | null>(null);
  const [deliveredOverride, setDeliveredOverride] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
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
        <span style={styles.kicker}>taimen prototype</span>
        <h1 style={styles.title}>対面表示の3案</h1>
        <p style={styles.lead}>
          同じ2枚で、並置・主従・めくりを見比べます。実機では下の入力から、むぎの実写真に差し替えられます。
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
        {mode === "a" ? <EqualPair photos={photos} /> : null}
        {mode === "b" ? <MainAndLetter photos={photos} /> : null}
        {mode === "c" ? (
          <PagedPair
            photos={photos}
            pageIndex={pageIndex}
            onPageChange={(next) => setPageIndex(next)}
          />
        ) : null}
      </section>

      <section style={styles.notes}>
        <PrototypeNote
          title="見る観点"
          body="むぎをもっと見たくなるか、届いた感じが残るか、従側の寝顔が読めるかを見ます。"
        />
        <PrototypeNote
          title="比率"
          body="Aは1:1 cover、Bは主役を大きく・手紙側はcontain寄り、Cは全画面containです。"
        />
      </section>
    </main>
  );
}

function EqualPair({
  photos,
}: {
  photos: { own: PrototypePhoto; delivered: PrototypePhoto };
}) {
  return (
    <div style={styles.equalWrap} data-testid="taimen-mode-a">
      <SquarePhoto photo={photos.own} fit="cover" />
      <span style={styles.pairDots} aria-hidden="true">
        ...
      </span>
      <SquarePhoto photo={photos.delivered} fit="cover" />
    </div>
  );
}

function MainAndLetter({
  photos,
}: {
  photos: { own: PrototypePhoto; delivered: PrototypePhoto };
}) {
  return (
    <div style={styles.mainLetterWrap} data-testid="taimen-mode-b">
      <div style={styles.heroPhoto}>
        <img src={photos.own.src} alt={photos.own.label} style={styles.heroImage} />
      </div>
      <div style={styles.letterCard} aria-label="届いた手紙">
        <div style={styles.postmark}>1年前のきょう</div>
        <div style={styles.letterWindow}>
          <img
            src={photos.delivered.src}
            alt={photos.delivered.label}
            style={styles.letterImage}
          />
        </div>
        <div style={styles.letterCaption}>どこかのこから</div>
      </div>
      <p style={styles.mainLetterCaption}>
        むぎの今日に、ちいさな手紙が添わっています。
      </p>
    </div>
  );
}

function PagedPair({
  photos,
  pageIndex,
  onPageChange,
}: {
  photos: { own: PrototypePhoto; delivered: PrototypePhoto };
  pageIndex: number;
  onPageChange: (index: number) => void;
}) {
  const active = pageIndex === 0 ? photos.own : photos.delivered;
  return (
    <div style={styles.pagedWrap} data-testid="taimen-mode-c">
      <div style={styles.pagedPhoto}>
        <img src={active.src} alt={active.label} style={styles.pagedImage} />
      </div>
      <div style={styles.pageTabs}>
        <AppButton
          type="button"
          size="sm"
          variant={pageIndex === 0 ? "primary" : "quiet"}
          onClick={() => onPageChange(0)}
        >
          むぎ
        </AppButton>
        <AppButton
          type="button"
          size="sm"
          variant={pageIndex === 1 ? "primary" : "quiet"}
          onClick={() => onPageChange(1)}
        >
          手紙
        </AppButton>
      </div>
      <p style={styles.pagedCaption}>
        {pageIndex === 0 ? "まず、きょうのむぎ。" : "めくると、届いたねがお。"}
      </p>
    </div>
  );
}

function SquarePhoto({ photo, fit }: { photo: PrototypePhoto; fit: "cover" | "contain" }) {
  return (
    <figure style={styles.squareFigure}>
      <span style={styles.squareFrame}>
        <img
          src={photo.src}
          alt={photo.label}
          style={{ ...styles.squareImage, objectFit: fit }}
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
    minHeight: 600,
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
  equalWrap: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  pairDots: {
    color: color.textFaint,
    fontFamily: typography.fontDisplay,
    letterSpacing: "0.18em",
  },
  squareFigure: {
    margin: 0,
    display: "grid",
    gap: spacing.md,
    justifyItems: "center",
  },
  squareFrame: {
    ...photoFrameBase,
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: radius.lg,
  },
  squareImage: {
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
  mainLetterWrap: {
    position: "relative",
    display: "grid",
    justifyItems: "center",
    paddingTop: spacing.lg,
    minHeight: 460,
  },
  heroPhoto: {
    ...photoFrameBase,
    width: "82%",
    aspectRatio: "3 / 4",
    borderRadius: radius.xl,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  letterCard: {
    position: "absolute",
    right: 0,
    bottom: 64,
    width: 150,
    padding: spacing.md,
    transform: "rotate(-3deg)",
    borderRadius: radius.lg,
    background: color.surfaceSoft,
    boxShadow: shadow.e1,
    display: "grid",
    gap: spacing.sm,
  },
  postmark: {
    justifySelf: "end",
    color: color.textFaint,
    fontSize: 12,
    letterSpacing: "0.08em",
  },
  letterWindow: {
    overflow: "hidden",
    aspectRatio: "4 / 3",
    borderRadius: radius.md,
    background: color.paper,
    border: `1px solid ${color.border}`,
  },
  letterImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  letterCaption: {
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 13,
    letterSpacing: "0.08em",
    textAlign: "center",
  },
  mainLetterCaption: {
    alignSelf: "end",
    margin: 0,
    maxWidth: 280,
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 13,
    letterSpacing: "0.08em",
    lineHeight: 1.7,
    textAlign: "center",
  },
  pagedWrap: {
    display: "grid",
    gap: spacing.lg,
    justifyItems: "center",
  },
  pagedPhoto: {
    ...photoFrameBase,
    width: "100%",
    height: 420,
    borderRadius: radius.xl,
  },
  pagedImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  pageTabs: {
    display: "flex",
    gap: spacing.sm,
  },
  pagedCaption: {
    margin: 0,
    color: color.textMuted,
    fontFamily: typography.fontDisplay,
    fontSize: 13,
    letterSpacing: "0.08em",
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
