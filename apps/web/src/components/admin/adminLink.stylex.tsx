"use client";

import * as stylex from "@stylexjs/stylex";
import NextLink from "next/link";
import type { ComponentProps } from "react";

import { colors, controlMetrics, effects } from "../../styles/tokens.stylex";

export default function AdminLink({
  className: _className,
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <NextLink prefetch={false} {...props} {...stylex.props(styles.link)} />
  );
}

const styles = stylex.create({
  link: {
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: "inherit",
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
});
