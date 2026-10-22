"use client";

import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";
import { ImageViewer } from "../imageViewer.stylex";

export type PhotoPreviewProps = {
  loading?: boolean;
  metadata?: string;
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
      aria-label="Bottle label photo"
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
        {/* While loading, the title names the current step and is the live
            status, so it must stay readable without the shimmer. */}
        <strong
          role={loading ? "status" : undefined}
          {...stylex.props(
            foundationStyles.compactRowTitle,
            styles.title,
            loading && foundationStyles.sectionHeading,
          )}
        >
          {loading ? (
            <span {...stylex.props(styles.loadingTitle)}>{title}</span>
          ) : (
            title
          )}
        </strong>
        {metadata ? (
          <span {...stylex.props(foundationStyles.metadata, styles.metadata)}>
            {metadata}
          </span>
        ) : null}
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
  loadingTitle: {
    display: "inline-block",
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
