import * as stylex from "@stylexjs/stylex";
import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../../../styles/tokens.stylex";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** A neutral content surface. Feature components own the content inside it. */
export function Card({ children, ...props }: CardProps) {
  return (
    <div {...props} {...stylex.props(styles.card)}>
      {children}
    </div>
  );
}

export type CardLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

/** A whole-card link with the shared hover, pressed, and focus treatment. */
export function CardLink({ children, ...props }: CardLinkProps) {
  return (
    <a {...props} {...stylex.props(styles.card, styles.link)}>
      {children}
    </a>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.grid)}>{children}</div>;
}

const styles = stylex.create({
  card: {
    boxSizing: "border-box",
    minWidth: 0,
    padding: "20px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  link: {
    display: "block",
    color: colors.ink,
    textDecoration: "none",
    outline: "none",
    cursor: "pointer",
    borderColor: {
      default: colors.hairline,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    backgroundColor: {
      default: colors.surface,
      ":hover": colors.surface,
      ":active": colors.inset,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: space.x4,
  },
});
