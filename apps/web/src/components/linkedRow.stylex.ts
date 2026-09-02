import * as stylex from "@stylexjs/stylex";

import {
  colors,
  controlMetrics,
  effects,
  zIndices,
} from "../styles/tokens.stylex";

/**
 * Owns the hit area, title interaction, and focus treatment for linked rows.
 * Compose primaryLink after local typography so every row gets the same states.
 * Keep secondary controls above the hit area with nestedAction or TextLink.
 */
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
    color: {
      default: colors.ink,
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
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
    "::after": {
      content: "''",
      position: "absolute",
      zIndex: zIndices.localContent,
      inset: 0,
      borderRadius: controlMetrics.radiusSmall,
    },
  },
  nestedAction: {
    position: "relative",
    zIndex: zIndices.localControl,
  },
});
