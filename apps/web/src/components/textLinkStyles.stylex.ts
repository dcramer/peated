import * as stylex from "@stylexjs/stylex";

import { colors, effects, fonts } from "../styles/tokens.stylex";

/** Shared text-link interaction styles for TextLink and bare AppLink fallback. */
export const textLinkStyles = stylex.create({
  link: {
    position: "relative",
    zIndex: 2,
    display: "inline-flex",
    width: "fit-content",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.accent,
    },
    fontWeight: 600,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  small: {
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.3,
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
