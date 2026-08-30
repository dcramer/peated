import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { linkedRowStyles } from "./linkedRow.stylex";

const MOBILE = "@media (max-width: 559px)";

export type ItemListVariant = "plain" | "surface";
export type ItemRowSize = "sm" | "md";

export type ItemListProps = {
  ariaLabel: string;
  children: ReactNode;
  showTopDivider?: boolean;
  variant?: ItemListVariant;
};

/** Groups aligned records with one shared divider and surface contract. */
export function ItemList({
  ariaLabel,
  children,
  showTopDivider = true,
  variant = "plain",
}: ItemListProps) {
  return (
    <ul
      aria-label={ariaLabel}
      {...stylex.props(
        styles.list,
        variant === "plain" && styles.plainList,
        variant === "plain" && !showTopDivider && styles.withoutTopDivider,
        variant === "surface" && styles.surfaceList,
      )}
    >
      {children}
    </ul>
  );
}

export type ItemListItemProps = {
  children: ReactNode;
  id?: string;
};

/** Owns the divider for one custom row inside an ItemList. */
export function ItemListItem({ children, id }: ItemListItemProps) {
  return (
    <li id={id} {...stylex.props(styles.row)}>
      {children}
    </li>
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
  metadataWrap?: boolean;
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
  metadataWrap = false,
  size = "md",
  title,
  variant = "plain",
}: ItemRowProps) {
  const hasLinkedContent = Boolean(href);

  return (
    <ItemListItem id={id}>
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
            <AppLink
              href={href}
              {...stylex.props(
                styles.title,
                size === "sm" && styles.smallTitle,
                linkedRowStyles.primaryLink,
              )}
            >
              {title}
            </AppLink>
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
                metadataWrap && styles.wrappedMetadata,
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
    </ItemListItem>
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
  withoutTopDivider: {
    borderTopWidth: 0,
  },
  surfaceList: {
    overflow: "visible",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    borderRadius: 0,
    backgroundColor: "transparent",
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
    paddingRight: 0,
    paddingLeft: 0,
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
    width: "32px",
    minHeight: "48px",
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
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
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
    fontSize: "16px",
  },
  metadata: {
    marginTop: "3px",
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  smallMetadata: {
    marginTop: "2px",
  },
  wrappedMetadata: {
    overflow: "visible",
    textOverflow: "clip",
    whiteSpace: "normal",
  },
  description: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.55,
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
