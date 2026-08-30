import * as stylex from "@stylexjs/stylex";
import type { AnchorHTMLAttributes } from "react";

import { colors, effects, fonts } from "../../../styles/tokens.stylex";

export type TextLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "className" | "style"
> & {
  href: string;
  size?: "inherit" | "sm";
};

/** Uses the shared inline-link interaction treatment. */
export function TextLink({
  children,
  href,
  size = "sm",
  ...props
}: TextLinkProps) {
  return (
    <a
      href={href}
      {...props}
      {...stylex.props(styles.link, size === "sm" && styles.small)}
    >
      {children}
    </a>
  );
}

const styles = stylex.create({
  link: {
    position: "relative",
    zIndex: 2,
    display: "inline-flex",
    width: "fit-content",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.ink,
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
});
