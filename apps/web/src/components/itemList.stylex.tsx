import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { foundationStyles } from "../styles/foundations.stylex";

import { colors, effects, space, zIndices } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { linkedRowStyles } from "./linkedRow.stylex";
import { getTextTitle } from "./textTitle";

const MOBILE = "@media (max-width: 559px)";

export type ItemRowSize = "sm" | "md";

export type ItemListProps = {
  ariaLabel: string;
  children: ReactNode;
};

/** Groups aligned items with one shared row-divider contract. */
export function ItemList({ ariaLabel, children }: ItemListProps) {
  return (
    <ul aria-label={ariaLabel} {...stylex.props(styles.list)}>
      {children}
    </ul>
  );
}

export type ItemListItemProps = {
  children: ReactNode;
  id?: string;
};

/**
 * Owns the divider for a custom row. Prefer ItemRow when its slots fit;
 * custom linked rows must compose linkedRowStyles for their container and link.
 */
export function ItemListItem({ children, id }: ItemListItemProps) {
  return (
    <li id={id} {...stylex.props(styles.row)}>
      {children}
    </li>
  );
}

export type ItemRowProps = {
  action?: ReactNode;
  align?: "center" | "start";
  description?: ReactNode;
  end?: ReactNode;
  href?: string;
  id?: string;
  leading?: ReactNode;
  metadata?: ReactNode;
  metadataWrap?: boolean;
  size?: ItemRowSize;
  subtitle?: ReactNode;
  title: ReactNode;
};

/** Renders one aligned item with a primary link across the complete row. */
export function ItemRow({
  action,
  align = "center",
  description,
  end,
  href,
  id,
  leading,
  metadata,
  metadataWrap = false,
  size = "md",
  subtitle,
  title,
}: ItemRowProps) {
  const hasLinkedContent = Boolean(href);

  return (
    <ItemListItem id={id}>
      <div
        {...stylex.props(
          styles.content,
          size === "sm" && styles.smallContent,
          align === "start" && styles.startAlignedContent,
          hasLinkedContent && styles.interactiveContent,
          hasLinkedContent && linkedRowStyles.container,
          hasLinkedContent && linkedRowStyles.onGround,
        )}
      >
        {leading ? (
          <div {...stylex.props(styles.leading)}>{leading}</div>
        ) : null}
        <div {...stylex.props(styles.copy)}>
          {href ? (
            <AppLink
              href={href}
              title={getTextTitle(title)}
              {...stylex.props(
                foundationStyles.rowTitle,
                styles.title,
                size === "sm" && foundationStyles.compactRowTitle,
                linkedRowStyles.primaryLink,
              )}
            >
              {title}
            </AppLink>
          ) : (
            <span
              title={getTextTitle(title)}
              {...stylex.props(
                foundationStyles.rowTitle,
                styles.title,
                size === "sm" && foundationStyles.compactRowTitle,
              )}
            >
              {title}
            </span>
          )}
          {subtitle ? (
            <div
              title={getTextTitle(subtitle)}
              {...stylex.props(foundationStyles.metadata, styles.subtitle)}
            >
              {subtitle}
            </div>
          ) : null}
          {metadata ? (
            <div
              title={getTextTitle(metadata)}
              {...stylex.props(
                foundationStyles.metadata,
                styles.metadata,
                size === "sm" && styles.smallMetadata,
                metadataWrap && styles.wrappedMetadata,
              )}
            >
              {metadata}
            </div>
          ) : null}
          {description ? (
            <div {...stylex.props(foundationStyles.body, styles.description)}>
              {description}
            </div>
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
  startAlignedContent: {
    alignItems: "flex-start",
  },
  interactiveContent: {
    width: "calc(100% + 24px)",
    marginRight: "-12px",
    marginLeft: "-12px",
    paddingRight: "12px",
    paddingLeft: "12px",
  },
  leading: {
    display: "flex",
    width: "auto",
    minWidth: "32px",
    minHeight: "48px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  subtitle: {
    marginTop: "3px",
    maxWidth: "100%",
    overflow: "hidden",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  title: {
    display: "block",
    overflow: "hidden",
    color: colors.ink,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },

  metadata: {
    marginTop: "3px",
    overflow: "hidden",
    color: colors.inkMuted,
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
    zIndex: zIndices.localControl,
    display: "flex",
    flexShrink: 0,
  },
});
