import * as stylex from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";
const COARSE_POINTER = "@media (pointer: coarse)";
const NARROW = "@media (max-width: 759px)";

export const colors = stylex.defineVars({
  ground: { default: "#f7f8f5", [DARK]: "#101210" },
  surface: { default: "#ebeee7", [DARK]: "#1b1e1a" },
  inset: { default: "#dce0d6", [DARK]: "#2b2f29" },
  sunken: { default: "#cbd0c2", [DARK]: "#3a3f37" },
  ink: { default: "#161914", [DARK]: "#e8eae3" },
  inkMuted: {
    default: "rgb(22 25 20 / 0.75)",
    [DARK]: "rgb(232 234 227 / 0.75)",
  },
  accent: { default: "#9a5b12", [DARK]: "#d9922f" },
  accentDeep: { default: "#6e400c", [DARK]: "#e8a752" },
  accentTint: {
    default: "rgb(154 91 18 / 0.15)",
    [DARK]: "rgb(217 146 47 / 0.15)",
  },
  dataAccent: {
    default: "rgb(154 91 18 / 0.42)",
    [DARK]: "rgb(217 146 47 / 0.42)",
  },
  ratingFill: {
    default: "rgb(154 91 18 / 0.75)",
    [DARK]: "rgb(217 146 47 / 0.75)",
  },
  ratingTrack: { default: "#cbd0c2", [DARK]: "#3a3f37" },
  passportEmpty: {
    default: "rgb(22 25 20 / 0.16)",
    [DARK]: "rgb(232 234 227 / 0.16)",
  },
  band1: {
    default: "rgb(22 25 20 / 0.22)",
    [DARK]: "rgb(232 234 227 / 0.22)",
  },
  band2: {
    default: "rgb(22 25 20 / 0.46)",
    [DARK]: "rgb(232 234 227 / 0.46)",
  },
  band3: { default: "#c08a3e", [DARK]: "#96601f" },
  band4: { default: "#9a5b12", [DARK]: "#d9922f" },
  band5: { default: "#6e400c", [DARK]: "#f2c173" },
  bandLow: {
    default: "rgb(22 25 20 / 0.80)",
    [DARK]: "rgb(232 234 227 / 0.80)",
  },
  bandMid: { default: "#6e400c", [DARK]: "#f0d9b0" },
  bandHigh: { default: "#9a5b12", [DARK]: "#d9922f" },
  bandTrack: {
    default: "rgb(22 25 20 / 0.14)",
    [DARK]: "rgb(232 234 227 / 0.16)",
  },
  verdictPass: {
    default: "rgb(22 25 20 / 0.80)",
    [DARK]: "rgb(232 234 227 / 0.80)",
  },
  verdictTrack: {
    default: "rgb(22 25 20 / 0.20)",
    [DARK]: "rgb(232 234 227 / 0.22)",
  },
  hairline: {
    default: "rgb(22 25 20 / 0.11)",
    [DARK]: "rgb(232 234 227 / 0.11)",
  },
  sectionRule: {
    default: "rgb(22 25 20 / 0.16)",
    [DARK]: "rgb(232 234 227 / 0.16)",
  },
  fieldRule: {
    default: "rgb(22 25 20 / 0.28)",
    [DARK]: "rgb(232 234 227 / 0.32)",
  },
  fieldBackground: {
    default: "rgb(255 255 255 / 0.55)",
    [DARK]: "rgb(255 255 255 / 0.04)",
  },
  imageBackground: "#ffffff",
  critical: { default: "#a3231a", [DARK]: "#f0776b" },
  criticalQuiet: {
    default: "rgb(163 35 26 / 0.42)",
    [DARK]: "rgb(240 119 107 / 0.42)",
  },
  dataRange: {
    default: "rgb(22 25 20 / 0.45)",
    [DARK]: "rgb(232 234 227 / 0.45)",
  },
});

export const lightColorTheme = stylex.createTheme(colors, {
  ground: "#f7f8f5",
  surface: "#ebeee7",
  inset: "#dce0d6",
  sunken: "#cbd0c2",
  ink: "#161914",
  inkMuted: "rgb(22 25 20 / 0.75)",
  accent: "#9a5b12",
  accentDeep: "#6e400c",
  accentTint: "rgb(154 91 18 / 0.15)",
  dataAccent: "rgb(154 91 18 / 0.42)",
  ratingFill: "rgb(154 91 18 / 0.75)",
  ratingTrack: "#cbd0c2",
  passportEmpty: "rgb(22 25 20 / 0.16)",
  band1: "rgb(22 25 20 / 0.22)",
  band2: "rgb(22 25 20 / 0.46)",
  band3: "#c08a3e",
  band4: "#9a5b12",
  band5: "#6e400c",
  bandLow: "rgb(22 25 20 / 0.80)",
  bandMid: "#6e400c",
  bandHigh: "#9a5b12",
  bandTrack: "rgb(22 25 20 / 0.14)",
  verdictPass: "rgb(22 25 20 / 0.80)",
  verdictTrack: "rgb(22 25 20 / 0.20)",
  hairline: "rgb(22 25 20 / 0.11)",
  sectionRule: "rgb(22 25 20 / 0.16)",
  fieldRule: "rgb(22 25 20 / 0.28)",
  fieldBackground: "rgb(255 255 255 / 0.55)",
  imageBackground: "#ffffff",
  critical: "#a3231a",
  criticalQuiet: "rgb(163 35 26 / 0.42)",
  dataRange: "rgb(22 25 20 / 0.45)",
});

export const darkColorTheme = stylex.createTheme(colors, {
  ground: "#101210",
  surface: "#1b1e1a",
  inset: "#2b2f29",
  sunken: "#3a3f37",
  ink: "#e8eae3",
  inkMuted: "rgb(232 234 227 / 0.75)",
  accent: "#d9922f",
  accentDeep: "#e8a752",
  accentTint: "rgb(217 146 47 / 0.15)",
  dataAccent: "rgb(217 146 47 / 0.42)",
  ratingFill: "rgb(217 146 47 / 0.75)",
  ratingTrack: "#3a3f37",
  passportEmpty: "rgb(232 234 227 / 0.16)",
  band1: "rgb(232 234 227 / 0.22)",
  band2: "rgb(232 234 227 / 0.46)",
  band3: "#96601f",
  band4: "#d9922f",
  band5: "#f2c173",
  bandLow: "rgb(232 234 227 / 0.80)",
  bandMid: "#f0d9b0",
  bandHigh: "#d9922f",
  bandTrack: "rgb(232 234 227 / 0.16)",
  verdictPass: "rgb(232 234 227 / 0.80)",
  verdictTrack: "rgb(232 234 227 / 0.22)",
  hairline: "rgb(232 234 227 / 0.11)",
  sectionRule: "rgb(232 234 227 / 0.16)",
  fieldRule: "rgb(232 234 227 / 0.32)",
  fieldBackground: "rgb(255 255 255 / 0.04)",
  imageBackground: "#ffffff",
  critical: "#f0776b",
  criticalQuiet: "rgb(240 119 107 / 0.42)",
  dataRange: "rgb(232 234 227 / 0.45)",
});

export const fonts = stylex.defineVars({
  display: '"Hanken Grotesk Variable", sans-serif',
  reading: '"Karla Variable", sans-serif',
  data: '"IBM Plex Mono", monospace',
});

export const space = stylex.defineVars({
  x1: "4px",
  x2: "8px",
  x3: "12px",
  x4: "16px",
  x6: "24px",
  x8: "32px",
  x12: "48px",
});

// BottleVisual and LoadingList share the standard row thumbnail geometry.
export const bottleThumbnailMetrics = stylex.defineVars({
  width: { default: "48px", "@media (max-width: 639px)": "42px" },
  height: { default: "64px", "@media (max-width: 639px)": "58px" },
});

// These tokens own cross-component stacking. Local stacking contexts can use
// localContent and localControl. Page-level surfaces must use the semantic
// layer that matches their runtime role.
export const zIndices = stylex.defineVars({
  base: "0",
  localContent: "1",
  localControl: "2",
  sticky: "100",
  navigation: "200",
  menu: "300",
  menuControl: "301",
  dialog: "400",
  notification: "500",
  fullscreen: "600",
});

export const controlMetrics = stylex.defineVars({
  radius: "3px",
  radiusSmall: "2px",
  controlHeightSmall: {
    default: "34px",
    [COARSE_POINTER]: "44px",
    [NARROW]: "44px",
  },
  controlHeight: {
    default: "40px",
    [COARSE_POINTER]: "44px",
    [NARROW]: "44px",
  },
  controlHeightLarge: "44px",
});

export const effects = stylex.defineVars({
  // Interactive controls use their local hover and pressed treatments.
  // Do not add a separate focus outline around the control.
  focusRing: "none",
  errorRing: {
    default: "inset 0 0 0 2px #a3231a",
    [DARK]: "inset 0 0 0 2px #f0776b",
  },
  overlayShadow: {
    default: "0 18px 40px rgb(22 25 20 / 0.16)",
    [DARK]: "0 18px 40px rgb(0 0 0 / 0.55)",
  },
});

export const lightEffectTheme = stylex.createTheme(effects, {
  focusRing: "none",
  errorRing: "inset 0 0 0 2px #a3231a",
  overlayShadow: "0 18px 40px rgb(22 25 20 / 0.16)",
});

export const darkEffectTheme = stylex.createTheme(effects, {
  focusRing: "none",
  errorRing: "inset 0 0 0 2px #f0776b",
  overlayShadow: "0 18px 40px rgb(0 0 0 / 0.55)",
});
