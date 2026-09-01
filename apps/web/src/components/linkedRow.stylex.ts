import * as stylex from "@stylexjs/stylex";

import { colors, controlMetrics, effects } from "../styles/tokens.stylex";

/** Shared interaction geometry for rows with one primary destination. */
export const linkedRowStyles = stylex.create({
  container: {
    position: "relative",
    isolation: "isolate",
  },
  onGround: {
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.surface,
    },
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  onSurface: {
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.inset,
      ":active": colors.inset,
    },
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  primaryLink: {
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
    "::after": {
      content: "''",
      position: "absolute",
      zIndex: 1,
      inset: 0,
      borderRadius: controlMetrics.radiusSmall,
    },
  },
  nestedAction: {
    position: "relative",
    zIndex: 2,
  },
});
