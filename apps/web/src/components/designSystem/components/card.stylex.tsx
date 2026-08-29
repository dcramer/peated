import * as stylex from "@stylexjs/stylex";
import type {
  AnchorHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";

import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../../../styles/tokens.stylex";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  appearance?: "outlined" | "surface";
  children: ReactNode;
  linked?: boolean;
  padding?: "none" | "sm" | "md";
};

/** A neutral content surface. Feature components own the content inside it. */
export function Card({
  appearance = "outlined",
  children,
  className,
  linked = false,
  padding = "md",
  style,
  ...props
}: CardProps) {
  const cardProps = stylex.props(
    styles.card,
    appearance === "outlined" ? styles.outlined : styles.surface,
    padding === "sm" && styles.paddingSmall,
    padding === "md" && styles.paddingMedium,
    linked && styles.linked,
  );

  return (
    <div
      {...props}
      className={joinClassNames(cardProps.className, className)}
      style={mergeStyles(cardProps.style, style)}
    >
      {children}
    </div>
  );
}

export type CardLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  appearance?: "outlined" | "surface";
  children: ReactNode;
  href: string;
  padding?: "none" | "sm" | "md";
};

/** A whole-card link with the shared hover, pressed, and focus treatment. */
export function CardLink({
  appearance = "outlined",
  children,
  className,
  padding = "md",
  style,
  ...props
}: CardLinkProps) {
  const cardProps = stylex.props(
    styles.card,
    appearance === "outlined" ? styles.outlined : styles.surface,
    padding === "sm" && styles.paddingSmall,
    padding === "md" && styles.paddingMedium,
    styles.link,
  );

  return (
    <a
      {...props}
      className={joinClassNames(cardProps.className, className)}
      style={mergeStyles(cardProps.style, style)}
    >
      {children}
    </a>
  );
}

/** The primary destination inside a linked card that also has nested actions. */
export function CardPrimaryLink({
  children,
  className,
  style,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
}) {
  const linkProps = stylex.props(styles.primaryLink);

  return (
    <a
      {...props}
      className={joinClassNames(linkProps.className, className)}
      style={mergeStyles(linkProps.style, style)}
    >
      {children}
    </a>
  );
}

/** Keeps a secondary link independent from a card's primary link. */
export function CardActionLink({
  children,
  className,
  style,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
}) {
  const actionProps = stylex.props(styles.nestedAction);

  return (
    <a
      {...props}
      className={joinClassNames(actionProps.className, className)}
      style={mergeStyles(actionProps.style, style)}
    >
      {children}
    </a>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.grid)}>{children}</div>;
}

function joinClassNames(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(" ") || undefined;
}

function mergeStyles(
  base: CSSProperties | undefined,
  override: CSSProperties | undefined,
) {
  return base || override ? { ...base, ...override } : undefined;
}

const styles = stylex.create({
  card: {
    boxSizing: "border-box",
    minWidth: 0,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  outlined: {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
  },
  surface: {
    borderWidth: 0,
  },
  paddingSmall: {
    padding: space.x4,
  },
  paddingMedium: {
    padding: "20px",
  },
  linked: {
    position: "relative",
    isolation: "isolate",
    cursor: "pointer",
    backgroundColor: {
      default: colors.surface,
      ":hover": colors.inset,
      ":active": colors.accentTint,
    },
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  link: {
    position: "relative",
    display: "block",
    color: colors.ink,
    textDecoration: "none",
    outline: "none",
    cursor: "pointer",
    borderColor: {
      default: colors.hairline,
      ":hover": colors.hairline,
      ":active": colors.hairline,
    },
    backgroundColor: {
      default: colors.surface,
      ":hover": colors.inset,
      ":active": colors.accentTint,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  primaryLink: {
    display: "block",
    minWidth: 0,
    flex: 1,
    outline: "none",
    color: "inherit",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
    "::after": {
      content: "''",
      position: "absolute",
      zIndex: 1,
      inset: 0,
      borderRadius: controlMetrics.radius,
    },
  },
  nestedAction: {
    position: "relative",
    zIndex: 2,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: space.x4,
  },
});
