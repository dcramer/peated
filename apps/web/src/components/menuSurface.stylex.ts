import * as stylex from "@stylexjs/stylex";

import { colors, controlMetrics, effects } from "../styles/tokens.stylex";

/** Draws one complete surface around an open menu and its trigger area. */
export const menuSurfaceStyles = stylex.create({
  surface: {
    overflow: "hidden",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    color: colors.ink,
    boxShadow: effects.overlayShadow,
    "::after": {
      boxSizing: "border-box",
      position: "absolute",
      inset: 0,
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: colors.sectionRule,
      borderRadius: controlMetrics.radius,
      content: '""',
      pointerEvents: "none",
    },
  },
});
