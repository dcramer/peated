import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { linkedRowStyles } from "./linkedRow.stylex";
import { MemberStatus } from "./memberStatus.stylex";

const COMPACT = "@media (max-width: 639px)";
const bottleIconUrl = "/assets/bottle.svg";

export type BottleVisualSize = "sm" | "md" | "lg";

export type BottleVisualProps = {
  imageUrl?: string | null;
  label?: string;
  size?: BottleVisualSize;
};

/** Shows a supplied bottle image and uses Peated's bottle glyph when no image exists. */
export function BottleVisual({
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
      )}
    >
      {imageUrl ? (
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
  brand?: string;
  brandHref?: string;
  end?: ReactNode;
  hasTasted?: boolean;
  href?: string;
  imageUrl?: string | null;
  isLibrary?: boolean;
  metadata?: readonly string[];
  name: string;
  relatedReleases?: {
    count: number;
    href: string;
  };
};

/** Presents one catalog bottle using Peated's existing identity and member-status meanings. */
export function BottleIdentityRow({
  brand,
  brandHref,
  end,
  hasTasted = false,
  href,
  imageUrl,
  isLibrary = false,
  metadata = [],
  name,
  relatedReleases,
}: BottleIdentityRowProps) {
  return (
    <div
      {...stylex.props(
        styles.row,
        Boolean(href) && linkedRowStyles.container,
        Boolean(href) && linkedRowStyles.onGround,
      )}
    >
      <BottleVisual imageUrl={imageUrl} />
      <div {...stylex.props(styles.copy)}>
        {brand ? (
          brandHref ? (
            <AppLink
              href={brandHref}
              {...stylex.props(
                styles.brand,
                styles.brandLink,
                linkedRowStyles.nestedAction,
              )}
            >
              {brand}
            </AppLink>
          ) : (
            <span {...stylex.props(styles.brand)}>{brand}</span>
          )
        ) : null}
        <div {...stylex.props(styles.nameLine)}>
          {href ? (
            <AppLink
              href={href}
              {...stylex.props(
                styles.name,
                styles.nameLink,
                linkedRowStyles.primaryLink,
              )}
            >
              {name}
            </AppLink>
          ) : (
            <span {...stylex.props(styles.name)}>{name}</span>
          )}
          {isLibrary ? <MemberStatus kind="library" /> : null}
          {hasTasted ? <MemberStatus kind="tasted" /> : null}
        </div>
        {metadata.length ? (
          <div {...stylex.props(styles.metadata)}>
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
  image: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
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
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
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
      ":active": colors.accent,
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
      ":active": colors.accent,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
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
  relatedReleases: {
    marginTop: space.x1,
    outline: "none",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.ink,
    },
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecorationLine: "underline",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  end: {
    position: "relative",
    zIndex: 2,
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
} satisfies Record<BottleVisualSize, stylex.StyleXStyles>;
