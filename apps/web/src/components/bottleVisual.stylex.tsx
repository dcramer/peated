import * as stylex from "@stylexjs/stylex";

import {
  bottleThumbnailMetrics,
  colors,
  controlMetrics,
  space,
} from "../styles/tokens.stylex";
import { ImageViewer } from "./imageViewer.stylex";

const COMPACT = "@media (max-width: 639px)";
const bottleIconUrl = "/assets/bottle.svg";

export type BottleVisualSize = "xs" | "sm" | "md" | "lg" | "xl";

export type BottleVisualProps = {
  expandable?: boolean;
  imageUrl?: string | null;
  label?: string;
  size?: BottleVisualSize;
};

/**
 * Shows a bottle image or Peated's bottle glyph when no image exists.
 * BottleIdentityRow chooses its own size. Use this primitive directly only when
 * composing another layout: md for standard rows including sidebars, lg/xl
 * for detail media. Omit label beside visible bottle text; expandable needs a label.
 * Fixed-size frames cap both dimensions so source images cannot enlarge a row.
 * Row images load near the viewport; lg/xl detail images load immediately.
 */
export function BottleVisual({
  expandable = false,
  imageUrl,
  label,
  size = "md",
}: BottleVisualProps) {
  const hasExpandableImage = Boolean(imageUrl && expandable && label);
  const loading = size === "lg" || size === "xl" ? "eager" : "lazy";

  return (
    <span
      aria-hidden={!label ? "true" : undefined}
      aria-label={label && !hasExpandableImage ? label : undefined}
      role={label && !hasExpandableImage ? "img" : undefined}
      {...stylex.props(
        styles.visual,
        Boolean(imageUrl) && styles.imageVisual,
        visualSizeStyles[size],
        hasExpandableImage && styles.expandableVisual,
      )}
    >
      {hasExpandableImage && imageUrl && label ? (
        <ImageViewer alt="" fill label={label} src={imageUrl}>
          <img
            alt=""
            src={imageUrl}
            loading={loading}
            {...stylex.props(styles.image, expandableImagePaddingStyles[size])}
          />
        </ImageViewer>
      ) : imageUrl ? (
        <img
          alt=""
          src={imageUrl}
          loading={loading}
          {...stylex.props(styles.image)}
        />
      ) : (
        <span
          style={{
            maskImage: `url("${bottleIconUrl}")`,
            WebkitMaskImage: `url("${bottleIconUrl}")`,
          }}
          {...stylex.props(styles.fallbackAsset)}
        />
      )}
    </span>
  );
}

const styles = stylex.create({
  visual: {
    boxSizing: "border-box",
    display: "inline-flex",
    minWidth: 0,
    minHeight: 0,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: "transparent",
    color: colors.inkMuted,
  },
  imageVisual: {
    backgroundColor: colors.imageBackground,
    boxShadow: `inset 0 0 0 1px ${colors.hairline}`,
  },
  expandableVisual: {
    padding: 0,
  },
  visualExtraSmall: {
    width: "24px",
    maxWidth: "24px",
    height: "32px",
    maxHeight: "32px",
    padding: "2px",
  },
  visualSmall: {
    width: "32px",
    maxWidth: "32px",
    height: "46px",
    maxHeight: "46px",
    padding: space.x1,
  },
  visualMedium: {
    width: bottleThumbnailMetrics.width,
    maxWidth: bottleThumbnailMetrics.width,
    height: bottleThumbnailMetrics.height,
    maxHeight: bottleThumbnailMetrics.height,
    padding: space.x2,
  },
  visualLarge: {
    width: { default: "132px", [COMPACT]: "80px" },
    maxWidth: { default: "132px", [COMPACT]: "80px" },
    height: { default: "176px", [COMPACT]: "120px" },
    maxHeight: { default: "176px", [COMPACT]: "120px" },
    padding: { default: space.x2, [COMPACT]: space.x1 },
  },
  visualExtraLarge: {
    width: "100%",
    maxWidth: "100%",
    aspectRatio: "4 / 5",
    padding: space.x4,
  },
  image: {
    boxSizing: "border-box",
    display: "block",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    height: "100%",
    maxHeight: "100%",
    minHeight: 0,
    objectFit: "contain",
  },
  expandableImageExtraSmall: {
    padding: "2px",
  },
  expandableImageSmall: {
    padding: space.x1,
  },
  expandableImageMedium: {
    padding: space.x2,
  },
  expandableImageLarge: {
    padding: { default: space.x2, [COMPACT]: space.x1 },
  },
  expandableImageExtraLarge: {
    padding: space.x4,
  },
  fallbackAsset: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    maxHeight: "100%",
    backgroundColor: "currentColor",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  },
});

const visualSizeStyles = {
  xs: styles.visualExtraSmall,
  sm: styles.visualSmall,
  md: styles.visualMedium,
  lg: styles.visualLarge,
  xl: styles.visualExtraLarge,
} satisfies Record<BottleVisualSize, stylex.StyleXStyles>;

const expandableImagePaddingStyles = {
  xs: styles.expandableImageExtraSmall,
  sm: styles.expandableImageSmall,
  md: styles.expandableImageMedium,
  lg: styles.expandableImageLarge,
  xl: styles.expandableImageExtraLarge,
} satisfies Record<BottleVisualSize, stylex.StyleXStyles>;
