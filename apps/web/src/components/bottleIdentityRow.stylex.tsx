import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  bottleThumbnailMetrics,
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
  zIndices,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { ImageViewer } from "./imageViewer.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";
import { MemberStatus } from "./memberStatus.stylex";
import { getTextTitle } from "./textTitle";

const COMPACT = "@media (max-width: 639px)";
const bottleIconUrl = "/assets/bottle.svg";

export type BottleVisualSize = "sm" | "md" | "lg" | "xl";

export type BottleVisualProps = {
  expandable?: boolean;
  imageUrl?: string | null;
  label?: string;
  size?: BottleVisualSize;
};

/**
 * Shows a bottle image or Peated's bottle glyph when no image exists.
 * Use the default medium size beside three-line identities, including activity entries.
 */
export function BottleVisual({
  expandable = false,
  imageUrl,
  label,
  size = "md",
}: BottleVisualProps) {
  const hasExpandableImage = Boolean(imageUrl && expandable && label);

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
            {...stylex.props(styles.image, expandableImagePaddingStyles[size])}
          />
        </ImageViewer>
      ) : imageUrl ? (
        <img alt="" src={imageUrl} {...stylex.props(styles.image)} />
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

export type BottleIdentityRowProps = {
  align?: "center" | "start";
  brand?: string;
  brandHref?: string;
  end?: ReactNode;
  hasTasted?: boolean;
  href?: string;
  imageUrl?: string | null;
  isLibrary?: boolean;
  layout?: "cell" | "row";
  metadata?: readonly string[];
  name: string;
  relatedReleases?: {
    count: number;
    href: string;
  };
  subtitle?: ReactNode;
};

/**
 * Owns the standard bottle row and its thumbnail size. Supply a name from
 * formatBottleDisplayName (or toBottleListItem), with brand context if omitted there.
 */
export function BottleIdentityRow({
  align = "center",
  brand,
  brandHref,
  end,
  hasTasted = false,
  href,
  imageUrl,
  isLibrary = false,
  layout = "row",
  metadata = [],
  name,
  relatedReleases,
  subtitle,
}: BottleIdentityRowProps) {
  return (
    <div
      {...stylex.props(
        styles.row,
        align === "start" && styles.startAlignedRow,
        layout === "cell" && styles.cellLayout,
        Boolean(href) && layout === "row" && linkedRowStyles.container,
        Boolean(href) && layout === "row" && linkedRowStyles.onGround,
      )}
    >
      <BottleVisual imageUrl={imageUrl} />
      <div {...stylex.props(styles.copy)}>
        {brand ? (
          brandHref ? (
            <AppLink
              href={brandHref}
              title={brand}
              {...stylex.props(
                foundationStyles.metadata,
                styles.brand,
                styles.brandLink,
                linkedRowStyles.nestedAction,
              )}
            >
              {brand}
            </AppLink>
          ) : (
            <span
              title={brand}
              {...stylex.props(foundationStyles.metadata, styles.brand)}
            >
              {brand}
            </span>
          )
        ) : null}
        <div {...stylex.props(styles.nameLine)}>
          {href ? (
            <AppLink
              href={href}
              {...stylex.props(
                foundationStyles.rowTitle,
                styles.name,
                linkedRowStyles.primaryLink,
              )}
            >
              {name}
            </AppLink>
          ) : (
            <span {...stylex.props(foundationStyles.rowTitle, styles.name)}>
              {name}
            </span>
          )}
          {isLibrary ? <MemberStatus kind="library" /> : null}
          {hasTasted ? <MemberStatus kind="tasted" /> : null}
        </div>
        {subtitle ? (
          <div
            title={getTextTitle(subtitle)}
            {...stylex.props(foundationStyles.metadata, styles.subtitle)}
          >
            {subtitle}
          </div>
        ) : null}
        {metadata.length ? (
          <div
            title={metadata.join(" · ")}
            {...stylex.props(foundationStyles.metadata, styles.metadata)}
          >
            {metadata.map((item, index) => (
              <span key={`${item}-${index}`}>
                {index ? <span aria-hidden="true"> · </span> : null}
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {relatedReleases && relatedReleases.count > 1 ? (
          <AppLink
            href={relatedReleases.href}
            {...stylex.props(
              styles.relatedReleases,
              linkedRowStyles.nestedAction,
            )}
          >
            {relatedReleases.count.toLocaleString("en-US")} related releases
          </AppLink>
        ) : null}
      </div>
      {end ? <div {...stylex.props(styles.end)}>{end}</div> : null}
    </div>
  );
}

const styles = stylex.create({
  visual: {
    boxSizing: "border-box",
    display: "inline-flex",
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
  visualSmall: {
    width: "32px",
    height: "46px",
    padding: space.x1,
  },
  visualMedium: {
    width: bottleThumbnailMetrics.width,
    height: bottleThumbnailMetrics.height,
    padding: space.x2,
  },
  visualLarge: {
    width: { default: "132px", [COMPACT]: "80px" },
    height: { default: "176px", [COMPACT]: "120px" },
    padding: { default: space.x2, [COMPACT]: space.x1 },
  },
  visualExtraLarge: {
    width: "100%",
    aspectRatio: "4 / 5",
    padding: space.x4,
  },
  image: {
    boxSizing: "border-box",
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
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
    height: "100%",
    backgroundColor: "currentColor",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  },
  row: {
    boxSizing: "border-box",
    display: "flex",
    width: "calc(100% + 24px)",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    marginRight: "-12px",
    marginLeft: "-12px",
    paddingTop: space.x3,
    paddingRight: "12px",
    paddingBottom: space.x3,
    paddingLeft: "12px",
  },
  startAlignedRow: {
    alignItems: "flex-start",
  },
  cellLayout: {
    width: "100%",
    marginRight: 0,
    marginLeft: 0,
    paddingRight: space.x3,
    paddingLeft: 0,
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  brand: {
    maxWidth: "100%",
    overflow: "hidden",
    outline: "none",
    color: colors.inkMuted,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  brandLink: {
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
      ":focus-visible": colors.accentDeep,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
  },
  nameLine: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    marginTop: "2px",
  },
  name: {
    outline: "none",
    overflowWrap: "anywhere",
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  metadata: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: space.x1,
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  subtitle: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: "3px",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  relatedReleases: {
    marginTop: space.x1,
    outline: "none",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.accent,
      ":focus-visible": colors.accent,
    },
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  end: {
    position: "relative",
    zIndex: zIndices.localControl,
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
  },
});

const visualSizeStyles = {
  sm: styles.visualSmall,
  md: styles.visualMedium,
  lg: styles.visualLarge,
  xl: styles.visualExtraLarge,
} satisfies Record<BottleVisualSize, stylex.StyleXStyles>;

const expandableImagePaddingStyles = {
  sm: styles.expandableImageSmall,
  md: styles.expandableImageMedium,
  lg: styles.expandableImageLarge,
  xl: styles.expandableImageExtraLarge,
} satisfies Record<BottleVisualSize, stylex.StyleXStyles>;
