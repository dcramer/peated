import * as stylex from "@stylexjs/stylex";

const DARK = "@media (prefers-color-scheme: dark)";

export const colors = stylex.defineVars({
  ground: { default: "#f7f8f5", [DARK]: "#101210" },
  surface: { default: "#ebeee7", [DARK]: "#1b1e1a" },
  inset: { default: "#dce0d6", [DARK]: "#2b2f29" },
  ink: { default: "#161914", [DARK]: "#e8eae3" },
  inkMuted: {
    default: "rgb(22 25 20 / 0.75)",
    [DARK]: "rgb(232 234 227 / 0.75)",
  },
  accent: { default: "#9a5b12", [DARK]: "#d9922f" },
  accentDeep: { default: "#6e400c", [DARK]: "#f0d9b0" },
  accentTint: {
    default: "rgb(154 91 18 / 0.15)",
    [DARK]: "rgb(217 146 47 / 0.15)",
  },
  dataAccent: {
    default: "rgb(154 91 18 / 0.42)",
    [DARK]: "rgb(217 146 47 / 0.42)",
  },
  passportEmpty: {
    default: "rgb(22 25 20 / 0.16)",
    [DARK]: "rgb(232 234 227 / 0.16)",
  },
  bandLow: {
    default: "rgb(22 25 20 / 0.80)",
    [DARK]: "rgb(232 234 227 / 0.80)",
  },
  bandMid: { default: "#6e400c", [DARK]: "#f0d9b0" },
  bandHigh: { default: "#9a5b12", [DARK]: "#d9922f" },
  bandTrack: {
    default: "rgb(22 25 20 / 0.20)",
    [DARK]: "rgb(232 234 227 / 0.22)",
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
  dataRange: {
    default: "rgb(22 25 20 / 0.45)",
    [DARK]: "rgb(232 234 227 / 0.45)",
  },
});

export const lightColorTheme = stylex.createTheme(colors, {
  ground: "#f7f8f5",
  surface: "#ebeee7",
  inset: "#dce0d6",
  ink: "#161914",
  inkMuted: "rgb(22 25 20 / 0.75)",
  accent: "#9a5b12",
  accentDeep: "#6e400c",
  accentTint: "rgb(154 91 18 / 0.15)",
  dataAccent: "rgb(154 91 18 / 0.42)",
  passportEmpty: "rgb(22 25 20 / 0.16)",
  bandLow: "rgb(22 25 20 / 0.80)",
  bandMid: "#6e400c",
  bandHigh: "#9a5b12",
  bandTrack: "rgb(22 25 20 / 0.20)",
  verdictPass: "rgb(22 25 20 / 0.80)",
  verdictTrack: "rgb(22 25 20 / 0.20)",
  hairline: "rgb(22 25 20 / 0.11)",
  sectionRule: "rgb(22 25 20 / 0.16)",
  dataRange: "rgb(22 25 20 / 0.45)",
});

export const darkColorTheme = stylex.createTheme(colors, {
  ground: "#101210",
  surface: "#1b1e1a",
  inset: "#2b2f29",
  ink: "#e8eae3",
  inkMuted: "rgb(232 234 227 / 0.75)",
  accent: "#d9922f",
  accentDeep: "#f0d9b0",
  accentTint: "rgb(217 146 47 / 0.15)",
  dataAccent: "rgb(217 146 47 / 0.42)",
  passportEmpty: "rgb(232 234 227 / 0.16)",
  bandLow: "rgb(232 234 227 / 0.80)",
  bandMid: "#f0d9b0",
  bandHigh: "#d9922f",
  bandTrack: "rgb(232 234 227 / 0.22)",
  verdictPass: "rgb(232 234 227 / 0.80)",
  verdictTrack: "rgb(232 234 227 / 0.22)",
  hairline: "rgb(232 234 227 / 0.11)",
  sectionRule: "rgb(232 234 227 / 0.16)",
  dataRange: "rgb(232 234 227 / 0.45)",
});

export const fonts = stylex.defineVars({
  display: '"Space Grotesk Variable", sans-serif',
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

export const controlMetrics = stylex.defineVars({
  radius: "3px",
  radiusSmall: "2px",
  controlHeightSmall: "34px",
  controlHeight: "40px",
  controlHeightLarge: "48px",
});

export const effects = stylex.defineVars({
  focusRing: {
    default: "inset 0 0 0 2px #9a5b12",
    [DARK]: "inset 0 0 0 2px #d9922f",
  },
  errorRing: {
    default: "inset 0 0 0 2px #6e400c",
    [DARK]: "inset 0 0 0 2px #f0d9b0",
  },
  overlayShadow: {
    default: "0 18px 40px rgb(22 25 20 / 0.16)",
    [DARK]: "0 18px 40px rgb(0 0 0 / 0.55)",
  },
});

export const lightEffectTheme = stylex.createTheme(effects, {
  focusRing: "inset 0 0 0 2px #9a5b12",
  errorRing: "inset 0 0 0 2px #6e400c",
  overlayShadow: "0 18px 40px rgb(22 25 20 / 0.16)",
});

export const darkEffectTheme = stylex.createTheme(effects, {
  focusRing: "inset 0 0 0 2px #d9922f",
  errorRing: "inset 0 0 0 2px #f0d9b0",
  overlayShadow: "0 18px 40px rgb(0 0 0 / 0.55)",
});
