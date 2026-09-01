import * as stylex from "@stylexjs/stylex";

import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../styles/tokens.stylex";
import { ImageViewer } from "../imageViewer.stylex";

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
        <strong {...stylex.props(styles.title, loading && styles.loadingTitle)}>
          {title}
        </strong>
        <span {...stylex.props(styles.metadata)}>{metadata}</span>
      </span>
    </section>
  );
}

const photoSweep = stylex.keyframes({
  from: { transform: "translateX(-100%)" },
  to: { transform: "translateX(300%)" },
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
    fontFamily: fonts.display,
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  loadingTitle: {
    fontSize: "24px",
    letterSpacing: "-0.03em",
    lineHeight: 1.08,
  },
  metadata: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "12px",
    lineHeight: 1.4,
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
