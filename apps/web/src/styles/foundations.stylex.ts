import * as stylex from "@stylexjs/stylex";
import { colors, fonts } from "./tokens.stylex";

export const foundationStyles = stylex.create({
  document: {
    boxSizing: "border-box",
    margin: 0,
    minHeight: "100dvh",
    colorScheme: "light dark",
    backgroundColor: colors.ground,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
  },
  pageTitle: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "clamp(40px, 5vw, 72px)",
    fontWeight: 700,
    letterSpacing: "-0.05em",
    lineHeight: 0.95,
  },
  sectionHeading: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  rowTitle: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.25,
  },
  body: {
    margin: 0,
    fontFamily: fonts.reading,
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.6,
  },
  interactive: {
    fontFamily: fonts.reading,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.2,
  },
  metadata: {
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.45,
  },
  fieldLabel: {
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: 1.4,
  },
  microLabel: {
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: 1.4,
  },
});
