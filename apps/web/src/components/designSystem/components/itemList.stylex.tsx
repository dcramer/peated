import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";

const MOBILE = "@media (max-width: 559px)";

export type ItemListVariant = "plain" | "surface";
export type ItemRowSize = "sm" | "md";

export type ItemListProps = {
  ariaLabel: string;
  children: ReactNode;
  variant?: ItemListVariant;
};

/** Groups aligned records with one shared divider and surface contract. */
export function ItemList({
  ariaLabel,
  children,
  variant = "plain",
}: ItemListProps) {
  return (
    <ul
      aria-label={ariaLabel}
      {...stylex.props(
        styles.list,
        variant === "plain" ? styles.plainList : styles.surfaceList,
      )}
    >
      {children}
    </ul>
  );
}

export type ItemRowProps = {
  action?: ReactNode;
  description?: ReactNode;
  end?: ReactNode;
  href?: string;
  id?: string;
  leading?: ReactNode;
  metadata?: ReactNode;
  size?: ItemRowSize;
  title: ReactNode;
  variant?: ItemListVariant;
};

/** Renders one aligned record with a primary link across the row surface. */
export function ItemRow({
  action,
  description,
  end,
  href,
  id,
  leading,
  metadata,
  size = "md",
  title,
  variant = "plain",
}: ItemRowProps) {
  const hasLinkedContent = Boolean(href);

  return (
    <li id={id} {...stylex.props(styles.row)}>
      <div
        {...stylex.props(
          styles.content,
          size === "sm" && styles.smallContent,
          variant === "surface" && styles.surfaceContent,
          hasLinkedContent &&
            variant === "plain" &&
            styles.plainInteractiveContent,
          hasLinkedContent && linkedRowStyles.container,
          hasLinkedContent &&
            (variant === "plain"
              ? linkedRowStyles.onGround
              : linkedRowStyles.onSurface),
        )}
      >
        {leading ? (
          <div {...stylex.props(styles.leading)}>{leading}</div>
        ) : null}
        <div {...stylex.props(styles.copy)}>
          {href ? (
            <a
              href={href}
              {...stylex.props(
                styles.title,
                size === "sm" && styles.smallTitle,
                linkedRowStyles.primaryLink,
              )}
            >
              {title}
            </a>
          ) : (
            <span
              {...stylex.props(
                styles.title,
                size === "sm" && styles.smallTitle,
              )}
            >
              {title}
            </span>
          )}
          {metadata ? (
            <div
              {...stylex.props(
                styles.metadata,
                size === "sm" && styles.smallMetadata,
              )}
            >
              {metadata}
            </div>
          ) : null}
          {description ? (
            <div {...stylex.props(styles.description)}>{description}</div>
          ) : null}
        </div>
        {end ? <div {...stylex.props(styles.end)}>{end}</div> : null}
        {action ? <div {...stylex.props(styles.action)}>{action}</div> : null}
      </div>
    </li>
  );
}

const styles = stylex.create({
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  plainList: {
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  surfaceList: {
    overflow: "hidden",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  row: {
    minWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  content: {
    boxSizing: "border-box",
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    paddingTop: "14px",
    paddingRight: 0,
    paddingBottom: "14px",
    paddingLeft: 0,
  },
  smallContent: {
    paddingTop: "11px",
    paddingBottom: "11px",
  },
  surfaceContent: {
    paddingRight: "18px",
    paddingLeft: "18px",
  },
  plainInteractiveContent: {
    width: "calc(100% + 24px)",
    marginRight: "-12px",
    marginLeft: "-12px",
    paddingRight: "12px",
    paddingLeft: "12px",
  },
  leading: {
    display: "flex",
    width: "48px",
    minHeight: "56px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    display: "block",
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  smallTitle: {
    fontSize: "14px",
  },
  metadata: {
    marginTop: space.x1,
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  smallMetadata: {
    marginTop: "2px",
  },
  description: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  end: {
    display: "flex",
    minWidth: 0,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    [MOBILE]: {
      maxWidth: "92px",
    },
  },
  action: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexShrink: 0,
  },
});
