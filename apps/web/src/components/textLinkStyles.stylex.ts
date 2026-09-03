import * as stylex from "@stylexjs/stylex";

import { colors, effects, zIndices } from "../styles/tokens.stylex";

/** Shared text-link interaction styles for TextLink and bare AppLink fallback. */
export const textLinkStyles = stylex.create({
  link: {
    position: "relative",
    zIndex: zIndices.localControl,
    display: "inline-flex",
    width: "fit-content",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.accent,
      ":focus-visible": colors.accent,
    },
    fontWeight: 600,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  muted: {
    color: {
      default: colors.inkMuted,
      ":hover": colors.ink,
      ":active": colors.ink,
    },
    fontWeight: 400,
    textDecorationLine: "underline",
  },
  truncate: {
    minWidth: 0,
    maxWidth: "100%",
  },
  truncateContent: {
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
