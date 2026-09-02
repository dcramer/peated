import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
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
export type BottleIdentityRowSize = Extract<BottleVisualSize, "sm" | "md">;

export type BottleVisualProps = {
  expandable?: boolean;
  imageUrl?: string | null;
  label?: string;
  size?: BottleVisualSize;
};

/** Shows a supplied bottle image and uses Peated's bottle glyph when no image exists. */
export function BottleVisual({
  expandable = false,
  imageUrl,
  label,
  size = "md",
}: BottleVisualProps) {
  return (
    <span
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
      {...stylex.props(
        styles.visual,
        Boolean(imageUrl) && styles.imageVisual,
        visualSizeStyles[size],
        Boolean(imageUrl && expandable && label) && styles.expandableVisual,
      )}
    >
      {imageUrl && expandable && label ? (
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
  size?: BottleIdentityRowSize;
  subtitle?: ReactNode;
};

/** Presents one catalog bottle using Peated's existing identity and member-status meanings. */
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
  size = "md",
  subtitle,
}: BottleIdentityRowProps) {
  return (
    <div
      {...stylex.props(
        styles.row,
        size === "sm" && styles.smallRow,
        align === "start" && styles.startAlignedRow,
        layout === "cell" && styles.cellLayout,
        Boolean(href) && layout === "row" && linkedRowStyles.container,
        Boolean(href) && layout === "row" && linkedRowStyles.onGround,
      )}
    >
      <BottleVisual imageUrl={imageUrl} size={size} />
      <div {...stylex.props(styles.copy)}>
        {brand ? (
          brandHref ? (
            <AppLink
              href={brandHref}
              title={brand}
              {...stylex.props(
                styles.brand,
                styles.brandLink,
                linkedRowStyles.nestedAction,
              )}
            >
              {brand}
            </AppLink>
          ) : (
            <span title={brand} {...stylex.props(styles.brand)}>
              {brand}
            </span>
          )
        ) : null}
        <div {...stylex.props(styles.nameLine)}>
          {href ? (
            <AppLink
              href={href}
              {...stylex.props(
                styles.name,
                size === "sm" && styles.smallName,
                styles.nameLink,
                linkedRowStyles.primaryLink,
              )}
            >
              {name}
            </AppLink>
          ) : (
            <span
              {...stylex.props(styles.name, size === "sm" && styles.smallName)}
            >
              {name}
            </span>
          )}
          {isLibrary ? <MemberStatus kind="library" /> : null}
          {hasTasted ? <MemberStatus kind="tasted" /> : null}
        </div>
        {subtitle ? (
          <div
            title={getTextTitle(subtitle)}
            {...stylex.props(styles.subtitle)}
          >
            {subtitle}
          </div>
        ) : null}
        {metadata.length ? (
          <div
            title={metadata.join(" · ")}
            {...stylex.props(
              styles.metadata,
              size === "sm" && styles.smallMetadata,
            )}
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
    width: { default: "48px", [COMPACT]: "42px" },
    height: { default: "64px", [COMPACT]: "58px" },
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
  smallRow: {
    gap: space.x2,
    paddingTop: "11px",
    paddingBottom: "11px",
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
    fontFamily: fonts.data,
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    lineHeight: 1.3,
    textDecoration: "none",
    textOverflow: "ellipsis",
    textTransform: "uppercase",
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
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
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
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  nameLink: {
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
  },
  smallName: {
    fontSize: "14px",
  },
  metadata: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  smallMetadata: {
    fontSize: "10px",
  },
  subtitle: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: "3px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.3,
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
    },
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
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
