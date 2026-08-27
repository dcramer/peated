import * as stylex from "@stylexjs/stylex";
import { colors, fonts } from "./tokens.stylex";

export const foundationStyles = stylex.create({
  document: {
    minHeight: "100dvh",
    colorScheme: "light dark",
    backgroundColor: colors.ground,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  pageTitle: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "clamp(36px, 7vw, 44px)",
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1.04,
  },
  sectionHeading: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  rowTitle: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  body: {
    margin: 0,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.55,
  },
  interactive: {
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.2,
  },
  metadata: {
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
    lineHeight: 1.45,
  },
  fieldLabel: {
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  microLabel: {
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
});
