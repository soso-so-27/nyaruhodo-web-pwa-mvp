import type { CSSProperties } from "react";

type IconProps = {
  size?: number;
  style?: CSSProperties;
};

export type AppIconName =
  | "home"
  | "book"
  | "box"
  | "collection"
  | "cat"
  | "catSilhouette"
  | "paw"
  | "sleep"
  | "hand"
  | "heart"
  | "camera"
  | "photo"
  | "mail"
  | "bell"
  | "clipboard"
  | "settings"
  | "lock"
  | "sparkles"
  | "chevronRight"
  | "close"
  | "eyeOff"
  | "flag"
  | "send"
  | "trash";

const defaultIconStyle: CSSProperties = {
  display: "block",
  flexShrink: 0,
};

function mergeStyle(style?: CSSProperties): CSSProperties {
  return style ? { ...defaultIconStyle, ...style } : defaultIconStyle;
}

export function AppIcon({
  name,
  size = 24,
  style,
}: IconProps & { name: AppIconName }) {
  switch (name) {
    case "home":
      return <HomeIcon size={size} style={style} />;
    case "book":
      return <BookIcon size={size} style={style} />;
    case "box":
      return <BoxIcon size={size} style={style} />;
    case "collection":
      return <CollectionIcon size={size} style={style} />;
    case "cat":
      return <CatIcon size={size} style={style} />;
    case "catSilhouette":
      return <CatSilhouetteIcon size={size} style={style} />;
    case "paw":
      return <PawIcon size={size} style={style} />;
    case "sleep":
      return <SleepIcon size={size} style={style} />;
    case "hand":
      return <HandIcon size={size} style={style} />;
    case "heart":
      return <HeartIcon size={size} style={style} />;
    case "camera":
      return <CameraIcon size={size} style={style} />;
    case "photo":
      return <PhotoIcon size={size} style={style} />;
    case "mail":
      return <MailIcon size={size} style={style} />;
    case "bell":
      return <BellIcon size={size} style={style} />;
    case "clipboard":
      return <ClipboardIcon size={size} style={style} />;
    case "settings":
      return <SettingsIcon size={size} style={style} />;
    case "lock":
      return <LockIcon size={size} style={style} />;
    case "sparkles":
      return <SparklesIcon size={size} style={style} />;
    case "chevronRight":
      return <ChevronRightIcon size={size} style={style} />;
    case "close":
      return <CloseIcon size={size} style={style} />;
    case "eyeOff":
      return <EyeOffIcon size={size} style={style} />;
    case "flag":
      return <FlagIcon size={size} style={style} />;
    case "send":
      return <SendIcon size={size} style={style} />;
    case "trash":
      return <TrashIcon size={size} style={style} />;
    default:
      return null;
  }
}

export function HomeIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="2 1.6 20.5 20.7"
      width={size}
      height={size}
      style={mergeStyle(style)}
      aria-hidden="true"
    >
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

export function BookIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M6.2 5.8h6.1c1 0 1.7.7 1.7 1.7v10.7c0-.8-.7-1.5-1.7-1.5H6.2z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M17.8 5.8h-3.8v12.4c0-.8.7-1.5 1.7-1.5h2.1z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M8.4 9.2h3.2M8.4 12h3.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function CollectionIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={mergeStyle(style)}
      aria-hidden="true"
    >
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

export function BoxIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M4 8.7h16l1.1 9.5a1.5 1.5 0 0 1-1.5 1.7H4.4a1.5 1.5 0 0 1-1.5-1.7L4 8.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.7 4.8h10.6L20 8.7H4l2.7-3.9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.1 13.3h7.8M9.3 16.3h5.4"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CatIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M7.4 9.4 7.1 6.1l2.8 1.7a7.2 7.2 0 0 1 4.2 0l2.8-1.7-.3 3.3a6.2 6.2 0 0 1 1.5 4c0 3.2-2.5 5.6-6.1 5.6s-6.1-2.4-6.1-5.6c0-1.5.5-2.9 1.5-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <path
        d="M9.3 13.1h.1M14.6 13.1h.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M10.3 15.5c.45.45 1 .68 1.7.68s1.25-.23 1.7-.68"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.55"
      />
      <path
        d="M4.5 12.8H7M17 12.8h2.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function CatSilhouetteIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M20 91.8c4.2-2.1 8.9-2.3 13.6-1.2 2.8-7.2 3.9-15.5 3.4-24.6-.4-7.9-4.1-16.8-2.1-25.4 1.1-4.8 5-7.7 9.2-10.3 1.9-4.1 2.4-8.8 1.5-13.7L45.1 8l10.6 8.8c5-.7 10.1.5 14.4 3.7 4.2 3.1 7.4 7.6 9.6 12.4-5.4 3.7-12.3 5.5-19 5-6-.4-10.8 4.5-10.3 10.5 1.2 15.8 7.4 30.1 18.4 42 2.7 2.9.6 7.5-3.4 7.5H19.8c-4.8 0-5.7-3.8.2-6.1Z"
        stroke="currentColor"
        strokeWidth="7.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M44.8 97.6c1.1-18.2 6.2-31.6 15.4-40.4M20.6 91.8h24.8"
        stroke="currentColor"
        strokeWidth="7.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PawIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M12 13.2c3 0 5.2 2.1 5.2 4.4 0 1.7-1.2 2.9-2.9 2.9-.8 0-1.5-.3-2.3-.3s-1.5.3-2.3.3c-1.7 0-2.9-1.2-2.9-2.9 0-2.3 2.2-4.4 5.2-4.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6.8 11.2c1 0 1.8-1 1.8-2.2S7.8 6.8 6.8 6.8 5 7.8 5 9s.8 2.2 1.8 2.2ZM10.3 8.8c1 0 1.8-1.1 1.8-2.4S11.3 4 10.3 4 8.5 5.1 8.5 6.4s.8 2.4 1.8 2.4ZM13.7 8.8c1 0 1.8-1.1 1.8-2.4S14.7 4 13.7 4s-1.8 1.1-1.8 2.4.8 2.4 1.8 2.4ZM17.2 11.2c1 0 1.8-1 1.8-2.2s-.8-2.2-1.8-2.2-1.8 1-1.8 2.2.8 2.2 1.8 2.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SleepIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M16.7 17.9a7 7 0 0 1-6.6-10.8 7 7 0 1 0 8.9 8.9 6.9 6.9 0 0 1-2.3 1.9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.2 5.4h3.2l-3.2 3.3h3.2M13.3 3.5h2.1l-2.1 2.2h2.1"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HandIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path d="M10.5 17V9.2a2 2 0 0 1 4 0V16" />
      <path d="M14.5 15V7.4a2 2 0 0 1 4 0V16" />
      <path d="M18.5 16V9.2a2 2 0 0 1 4 0v8.7" />
      <path d="M10.5 17.2 8.8 15a2 2 0 0 0-3.1 2.4l5.1 7.2c1.5 2.1 3.9 3.2 6.5 3.2h1.2c4.1 0 7.5-3.4 7.5-7.5v-6.8a2 2 0 0 0-4 0" />
    </svg>
  );
}

export function HeartIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path d="M16 26.5S6.2 20.6 6.2 13.2A5.4 5.4 0 0 1 16 10a5.4 5.4 0 0 1 9.8 3.2C25.8 20.6 16 26.5 16 26.5Z" />
    </svg>
  );
}

export function CameraIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M7.3 8.2 8.7 6h6.6l1.4 2.2h2a2.4 2.4 0 0 1 2.4 2.4v6.9a2.4 2.4 0 0 1-2.4 2.4H5.3a2.4 2.4 0 0 1-2.4-2.4v-6.9a2.4 2.4 0 0 1 2.4-2.4h2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="14.2"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PhotoIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2.4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m5.5 16 4.1-4.1a1.4 1.4 0 0 1 2 0l1.3 1.3 1.8-1.8a1.4 1.4 0 0 1 2 0l1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.8" cy="8.9" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function MailIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <rect
        x="3.8"
        y="6"
        width="16.4"
        height="12"
        rx="2.4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m5 8 6.2 4.7a1.4 1.4 0 0 0 1.6 0L19 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path d="M23.5 13.2a7.5 7.5 0 0 0-15 0c0 7.9-3.4 8.2-3.4 10.8h21.8c0-2.6-3.4-2.9-3.4-10.8Z" />
      <path d="M13.2 27h5.6" />
    </svg>
  );
}

export function ClipboardIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M9 5h6M9 11h6M9 15h4M8 3.5h8l1 2H7l1-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 5.5H5.8A1.8 1.8 0 0 0 4 7.3v11.4a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8V7.3a1.8 1.8 0 0 0-1.8-1.8H17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M9.7 4.2a2.35 2.35 0 0 1 4.6 0 2.2 2.2 0 0 0 3.1 1.8 2.35 2.35 0 0 1 2.3 4 2.2 2.2 0 0 0 0 3.6 2.35 2.35 0 0 1-2.3 4 2.2 2.2 0 0 0-3.1 1.8 2.35 2.35 0 0 1-4.6 0 2.2 2.2 0 0 0-3.1-1.8 2.35 2.35 0 0 1-2.3-4 2.2 2.2 0 0 0 0-3.6 2.35 2.35 0 0 1 2.3-4 2.2 2.2 0 0 0 3.1-1.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function LockIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M7 10V8.3a5 5 0 0 1 9.4-2.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 10h11A2.5 2.5 0 0 1 20 12.5v5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-5A2.5 2.5 0 0 1 6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 14v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SparklesIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M12 3.5 13.8 8l4.7 1.8-4.7 1.8L12 16l-1.8-4.4-4.7-1.8L10.2 8 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m18 15 .8 2 .2.2 2 .8-2 .8-.2.2-.8 2-.8-2-.2-.2-2-.8 2-.8.2-.2.8-2ZM5 14l.5 1.2 1.2.5-1.2.5L5 17.5l-.5-1.3-1.2-.5 1.2-.5L5 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRightIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m6 6 12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeOffIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.7 5.1A10.7 10.7 0 0 1 12 5c5.2 0 8.5 4.6 9.4 6.1a1.7 1.7 0 0 1 0 1.8 15.1 15.1 0 0 1-2.5 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 6.8A15 15 0 0 0 2.6 11.1a1.7 1.7 0 0 0 0 1.8C3.5 14.4 6.8 19 12 19a9.8 9.8 0 0 0 3.3-.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 10.2a2.8 2.8 0 0 0 3.6 3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FlagIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M6 21V4.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M6 5h9.4c1 0 1.5 1.1.9 1.9l-1 1.3c-.3.4-.3 1 0 1.4l1 1.3c.6.8.1 1.9-.9 1.9H6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SendIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M20.2 4.3 4.1 11.2c-.9.4-.8 1.7.1 2l6 1.8 1.8 6c.3.9 1.6 1 2 .1l6.9-16.1c.3-.7-.4-1.4-1.1-1.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m10.4 14.6 4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrashIcon({ size = 24, style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={mergeStyle(style)}
      aria-hidden="true"
    >
      <path
        d="M4.5 7h15"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M9.5 7V5.5c0-.8.7-1.5 1.5-1.5h2c.8 0 1.5.7 1.5 1.5V7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m8 10 .6 8.1c.1 1 1 1.9 2 1.9h4.8c1 0 1.9-.8 2-1.9L18 10"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
