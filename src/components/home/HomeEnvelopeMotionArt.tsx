"use client";

import { MotionConfig, motion } from "motion/react";
import type { TargetAndTransition } from "motion/react";
import type { CSSProperties } from "react";

import { HOME_ENVELOPE_OPEN_MS } from "./homeEnvelopeMotionConfig";

type HomeEnvelopeMotionArtProps = {
  isOpening: boolean;
  playKey: number;
  style?: CSSProperties;
};

type EnvelopeLayerProps = {
  alt?: string;
  className?: string;
  src: string;
  width: string;
  top: string;
  zIndex: number;
  style?: CSSProperties;
  animate?: TargetAndTransition;
  initial?: TargetAndTransition;
};

const OPEN_SECONDS = HOME_ENVELOPE_OPEN_MS / 1000;
const SETTLE_EASE = [0.18, 0.92, 0.2, 1] as const;
const SOFT_EASE = [0.24, 0.88, 0.32, 1] as const;

const envelopeLayerBase: CSSProperties = {
  position: "absolute",
  left: "50%",
  display: "block",
  pointerEvents: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  transform: "translate(-50%, -50%)",
  transformOrigin: "50% 50%",
};

export function HomeEnvelopeMotionArt({
  isOpening,
  playKey,
  style,
}: HomeEnvelopeMotionArtProps) {
  const timeline = {
    duration: OPEN_SECONDS,
    ease: SOFT_EASE,
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        key={playKey}
        aria-hidden="true"
        className="home-envelope-motion"
        data-envelope-motion-root="true"
        initial={false}
        animate={
          isOpening
            ? {
                scaleX: [1, 1.012, 0.992, 1.01, 1],
                scaleY: [1, 0.978, 1.014, 1, 1],
                y: [0, 3, -3, -1, 0],
              }
            : { scaleX: 1, scaleY: 1, y: 0 }
        }
        transition={{ ...timeline, times: [0, 0.07, 0.22, 0.56, 1] }}
        style={{
          position: "absolute",
          inset: "-44% -10% -14%",
          display: "block",
          pointerEvents: "none",
          transformOrigin: "50% 62%",
          zIndex: 2,
          ...style,
        }}
      >
        <EnvelopeLayer
          className="home-envelope-motion-shadow"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/11-11-envelope-shadow.png"
          width="56%"
          top="86%"
          zIndex={0}
          initial={{ opacity: 0.72, scaleX: 1, scaleY: 1 }}
          animate={
            isOpening
              ? {
                  opacity: [0.72, 0.86, 0.58, 0.68, 0.72],
                  scaleX: [1, 1.08, 0.88, 0.96, 1],
                  scaleY: [1, 0.9, 0.82, 0.9, 1],
                }
              : { opacity: 0.72, scaleX: 1, scaleY: 1 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-inner"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/04-04-back-inner-panel.png"
          width="64%"
          top="45%"
          zIndex={1}
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 0.86, 1, 1],
                  scale: [0.96, 0.96, 1.035, 1, 1],
                  y: [18, 18, 0, 0, 0],
                }
              : { opacity: 0, scale: 0.96, y: 18 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-card"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/10-10-photo-card-placeholder.png"
          width="54%"
          top="68%"
          zIndex={2}
          style={{ filter: "blur(4px)" }}
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 0, 0.62, 1, 0.92],
                  scale: [0.94, 0.94, 0.96, 1.035, 1, 1],
                  y: [20, 20, 2, -82, -102, -96],
                  filter: [
                    "blur(5px)",
                    "blur(5px)",
                    "blur(5px)",
                    "blur(2px)",
                    "blur(0px)",
                    "blur(0px)",
                  ],
                }
              : { opacity: 0, scale: 0.94, y: 20, filter: "blur(5px)" }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-pocket"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/02-02-open-front-pocket.png"
          width="70%"
          top="61%"
          zIndex={3}
          initial={{ opacity: 0, scale: 0.996, y: 6 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 1, 1, 1],
                  scale: [0.996, 0.996, 1.012, 1, 1],
                  y: [6, 6, 0, -5, 0],
                }
              : { opacity: 0, scale: 0.996, y: 6 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-flap"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/03-03-top-flap.png"
          width="68%"
          top="33%"
          zIndex={4}
          style={{ transformOrigin: "50% 100%" }}
          initial={{ opacity: 0, scaleY: 0.22, rotateX: 0, y: 42 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 1, 1, 1],
                  scaleY: [0.22, 0.22, 0.62, 1, 1],
                  rotateX: [0, 0, -32, -114, -104],
                  y: [42, 42, 2, -78, -70],
                }
              : { opacity: 0, scaleY: 0.22, rotateX: 0, y: 42 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-closed"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/01-01-closed-envelope-body.png"
          width="88%"
          top="58%"
          zIndex={5}
          initial={{ opacity: 1, scale: 1 }}
          animate={
            isOpening
              ? {
                  opacity: [1, 1, 0, 0],
                  scale: [1, 1.012, 1.018, 1.018],
                }
              : { opacity: 1, scale: 1 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-glow"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/09-09-inner-glow.png"
          width="62%"
          top="50%"
          zIndex={6}
          style={{ mixBlendMode: "screen" }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 0.3, 0.88, 0.58, 0.42],
                  scale: [0.6, 0.6, 0.74, 1.18, 1.05, 1],
                }
              : { opacity: 0, scale: 0.6 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-wax"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/05-05-wax-seal-intact.png"
          width="18%"
          top="59%"
          zIndex={7}
          initial={{ opacity: 1, scale: 1, rotate: 0 }}
          animate={
            isOpening
              ? {
                  opacity: [1, 1, 1, 0, 0],
                  scale: [1, 1.2, 0.96, 1.04, 1.04],
                  rotate: [0, -2, 2, 0, 0],
                }
              : { opacity: 1, scale: 1, rotate: 0 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-wax-left"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/06-06-wax-seal-left.png"
          width="12%"
          top="59%"
          zIndex={8}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 1, 1, 0.72],
                  x: [0, 0, -8, -19, -22],
                  y: [0, 0, 0, 2, 3],
                  rotate: [0, 0, -4, -9, -11],
                }
              : { opacity: 0, x: 0, y: 0, rotate: 0 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-wax-right"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/07-07-wax-seal-right.png"
          width="12%"
          top="59%"
          zIndex={8}
          initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 1, 1, 0.72],
                  x: [0, 0, 8, 19, 22],
                  y: [0, 0, 0, 2, 3],
                  rotate: [0, 0, 4, 9, 11],
                }
              : { opacity: 0, x: 0, y: 0, rotate: 0 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-crumbs"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/08-08-wax-crumbs.png"
          width="24%"
          top="65%"
          zIndex={9}
          initial={{ opacity: 0, scale: 0.72, y: -14 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 1, 0.7, 0],
                  scale: [0.72, 0.72, 1, 0.96, 0.92],
                  y: [-14, -14, 0, 18, 26],
                }
              : { opacity: 0, scale: 0.72, y: -14 }
          }
        />
        <EnvelopeLayer
          className="home-envelope-motion-motes"
          src="/animations/reference/home-envelope-rive-layers-v2/transparent/12-12-paper-motes.png"
          width="76%"
          top="39%"
          zIndex={10}
          initial={{ opacity: 0, scale: 0.72, y: 0 }}
          animate={
            isOpening
              ? {
                  opacity: [0, 0, 0.82, 0.66, 0],
                  scale: [0.72, 0.72, 0.94, 1.08, 1.16],
                  y: [0, 0, -5, -24, -42],
                }
              : { opacity: 0, scale: 0.72, y: 0 }
          }
        />
      </motion.span>
    </MotionConfig>
  );
}

function EnvelopeLayer({
  alt = "",
  className,
  src,
  width,
  top,
  zIndex,
  style,
  animate,
  initial,
}: EnvelopeLayerProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...envelopeLayerBase,
        width,
        top,
        zIndex,
      }}
    >
      <motion.img
        alt={alt}
        className={className}
        src={src}
        draggable={false}
        initial={initial}
        animate={animate}
        transition={{
          duration: OPEN_SECONDS,
          ease: SETTLE_EASE,
        }}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          ...style,
        }}
      />
    </span>
  );
}
