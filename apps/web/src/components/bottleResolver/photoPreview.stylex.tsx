"use client";

import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { useMediaQuery } from "usehooks-ts";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";
import { ImageViewer } from "../imageViewer.stylex";

const loadingMessages = [
  "Searching casks",
  "Holding it up to the light",
  "Letting the label breathe",
  "Checking the dusty shelf",
  "Asking the tasting room",
  "Comparing the fine print",
];

function LoadingTitle({ label }: { label: string }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", {
    initializeWithValue: false,
  });

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % loadingMessages.length);
    }, 2700);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <>
      <span {...stylex.props(styles.visuallyHidden)}>{label}</span>
      <span aria-hidden="true" {...stylex.props(styles.loadingMessages)}>
        {/* PhotoPreview keeps playful copy out of live announcements and reserves its full height. */}
        {loadingMessages.map((message, index) => (
          <span
            key={message}
            {...stylex.props(
              styles.loadingMessage,
              index === messageIndex && styles.visibleMessage,
            )}
          >
            {reducedMotion ? label : message}
          </span>
        ))}
      </span>
    </>
  );
}

export type PhotoPreviewProps = {
  loading?: boolean;
  metadata: string;
  src: string;
  title: string;
};

/** Keeps the submitted label photo visible while Peated reads or explains it. */
export function PhotoPreview({
  loading = false,
  metadata,
  src,
  title,
}: PhotoPreviewProps) {
  return (
    <section
      aria-busy={loading || undefined}
      aria-label="Bottle label photo"
      aria-live={loading ? "polite" : undefined}
      {...stylex.props(styles.preview, loading && styles.loadingPreview)}
    >
      <span
        {...stylex.props(
          styles.imageFrame,
          loading && styles.loadingImageFrame,
        )}
      >
        <ImageViewer
          alt="Uploaded bottle label"
          fill
          label="uploaded bottle label"
          src={src}
        >
          <img
            alt="Uploaded bottle label"
            src={src}
            {...stylex.props(styles.image, loading && styles.loadingImage)}
          />
        </ImageViewer>
        {loading ? (
          <span aria-hidden="true" {...stylex.props(styles.progress)}>
            <span {...stylex.props(styles.progressSweep)} />
          </span>
        ) : null}
      </span>
      <span {...stylex.props(styles.copy, loading && styles.loadingCopy)}>
        <strong
          {...stylex.props(
            foundationStyles.compactRowTitle,
            styles.title,
            loading && foundationStyles.sectionHeading,
          )}
        >
          {loading ? <LoadingTitle label={title} /> : title}
        </strong>
        <span {...stylex.props(foundationStyles.metadata, styles.metadata)}>
          {metadata}
        </span>
      </span>
    </section>
  );
}

const photoSweep = stylex.keyframes({
  from: { transform: "translateX(-100%)" },
  to: { transform: "translateX(300%)" },
});

const textShimmer = stylex.keyframes({
  from: { backgroundPosition: "200% 0" },
  to: { backgroundPosition: "-200% 0" },
});

const styles = stylex.create({
  preview: {
    boxSizing: "border-box",
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    alignItems: "center",
    gap: space.x3,
    padding: 0,
    backgroundColor: "transparent",
  },
  loadingPreview: {
    display: "flex",
    alignItems: "stretch",
    flexDirection: "column",
    gap: 0,
    padding: 0,
    overflow: "visible",
    backgroundColor: "transparent",
  },
  imageFrame: {
    boxSizing: "border-box",
    position: "relative",
    display: "grid",
    width: "72px",
    height: "88px",
    flex: "0 0 auto",
    placeItems: "center",
    overflow: "hidden",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.imageBackground,
    "@media (max-width: 559px)": {
      width: "64px",
      height: "80px",
    },
  },
  loadingImageFrame: {
    width: "100%",
    height: "min(52vw, 360px)",
    minHeight: "260px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.imageBackground,
    "@media (max-width: 559px)": {
      width: "100%",
      height: "260px",
      minHeight: "260px",
    },
  },
  image: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  loadingImage: {
    objectFit: "contain",
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    rowGap: space.x2,
  },
  loadingCopy: {
    paddingTop: space.x4,
  },
  title: {
    color: colors.ink,
  },
  loadingMessages: {
    display: "grid",
  },
  loadingMessage: {
    gridArea: "1 / 1",
    visibility: "hidden",
    width: "fit-content",
    maxWidth: "100%",
    color: "transparent",
    backgroundImage: `linear-gradient(90deg, ${colors.ink} 35%, ${colors.accent} 50%, ${colors.ink} 65%)`,
    backgroundSize: "200% 100%",
    backgroundClip: "text",
    animationName: textShimmer,
    animationDuration: "2.4s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
      backgroundImage: "none",
      color: colors.ink,
    },
    "@media (forced-colors: active)": {
      backgroundImage: "none",
      color: "CanvasText",
    },
  },
  visibleMessage: {
    visibility: "visible",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  metadata: {
    color: colors.inkMuted,
  },
  progress: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "2px",
    overflow: "hidden",
    backgroundColor: colors.hairline,
  },
  progressSweep: {
    display: "block",
    width: "33%",
    height: "100%",
    backgroundColor: colors.accent,
    animationName: {
      default: photoSweep,
      "@media (prefers-reduced-motion: reduce)": "none",
    },
    animationDuration: "1.15s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  },
});
