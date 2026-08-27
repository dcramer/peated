"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { foundationStyles } from "../src/styles/foundations.stylex";
import {
  colors,
  darkColorTheme,
  darkEffectTheme,
  lightColorTheme,
  lightEffectTheme,
  space,
} from "../src/styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";

type StorybookThemeProps = {
  children: ReactNode;
  theme: "dark" | "light";
};

export function StorybookTheme({ children, theme }: StorybookThemeProps) {
  const portalThemeClassName = stylex.props(
    theme === "light" ? styles.light : styles.dark,
    theme === "light" ? lightColorTheme : darkColorTheme,
    theme === "light" ? lightEffectTheme : darkEffectTheme,
  ).className;

  useEffect(() => {
    const classNames = portalThemeClassName?.split(" ").filter(Boolean) ?? [];
    document.body.classList.add(...classNames);

    return () => document.body.classList.remove(...classNames);
  }, [portalThemeClassName]);

  return (
    <div
      {...stylex.props(
        foundationStyles.document,
        styles.canvas,
        theme === "light" && styles.light,
        theme === "light" && lightColorTheme,
        theme === "light" && lightEffectTheme,
        theme === "dark" && styles.dark,
        theme === "dark" && darkColorTheme,
        theme === "dark" && darkEffectTheme,
      )}
    >
      {children}
    </div>
  );
}

const styles = stylex.create({
  canvas: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "100vh",
    paddingTop: { default: space.x8, [COMPACT]: space.x4 },
    paddingRight: { default: space.x8, [COMPACT]: space.x4 },
    paddingBottom: { default: space.x8, [COMPACT]: space.x4 },
    paddingLeft: { default: space.x8, [COMPACT]: space.x4 },
    backgroundColor: colors.ground,
  },
  light: {
    colorScheme: "light",
  },
  dark: {
    colorScheme: "dark",
  },
});
