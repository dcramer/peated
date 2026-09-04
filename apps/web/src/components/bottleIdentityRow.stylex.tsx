import * as stylex from "@stylexjs/stylex";
import type { MouseEventHandler, ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, effects, space, zIndices } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { BottleVisual } from "./bottleVisual.stylex";
import Join from "./join";
import { linkedRowStyles } from "./linkedRow.stylex";
import { MatchedText } from "./matchedText.stylex";
import { MemberStatus } from "./memberStatus.stylex";
import { TextLink } from "./textLink.stylex";
import { getTextTitle } from "./textTitle";

export type BottleIdentityRowProps = {
  /** Aligns standard row content; compact rows always center their single line. */
  align?: "center" | "start";
  end?: ReactNode;
  hasTasted?: boolean;
  href?: string;
  imageUrl?: string | null;
  isLibrary?: boolean;
  layout?: "cell" | "row";
  /** Links only the bottle title when the surrounding card is also clickable. */
  linkArea?: "row" | "title";
  metadata?: readonly string[];
  name: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  query?: string;
  provenance?: readonly { name: string; href?: string }[];
  relatedReleases?: {
    count: number;
    href: string;
  };
  subtitle?: ReactNode;
  /** Sidebar uses a small thumbnail, a two-line name, and a footer for trailing content. */
  variant?: "standard" | "search" | "sidebar" | "compact";
};

/**
 * Bottle identity for lists and activity. Standard shows name, provenance, then
 * release facts; search tightens the title and spacing for typeahead results;
 * sidebar uses compact titles and small thumbnails; compact shows one name line
 * for library additions. Sidebar names use two lines with the full name in title.
 * Search places trailing ratings or actions below the identity on narrow screens.
 * Use toBottleListItem for API Bottles or getBottleIdentityProps for partial reads.
 * All variants take the same full marketed name and own their thumbnail size.
 * The name line owns title typography so surrounding body leading cannot shift it.
 * Use layout="cell" inside an existing row/selection control. Linked cells keep
 * their link inside the bottle identity. Use linkArea="title" when the
 * surrounding card is also clickable. Compact omits provenance, metadata,
 * subtitle, status, and related releases; end remains available.
 */
export function BottleIdentityRow({
  align = "center",
  end,
  hasTasted = false,
  href,
  imageUrl,
  isLibrary = false,
  layout = "row",
  linkArea = "row",
  metadata = [],
  name,
  onClick,
  query,
  provenance = [],
  relatedReleases,
  subtitle,
  variant = "standard",
}: BottleIdentityRowProps) {
  const compact = variant === "compact";
  const sidebar = variant === "sidebar";
  const compactTitle = variant !== "standard";
  const trailingContent = end ? (
    <div
      {...stylex.props(
        styles.end,
        sidebar && styles.sidebarEnd,
        variant === "search" && styles.searchEnd,
      )}
    >
      {end}
    </div>
  ) : null;
  return (
    <div
      {...stylex.props(
        styles.row,
        variant === "search" && styles.searchRow,
        sidebar && styles.sidebarRow,
        compact && styles.compactRow,
        !compact && align === "start" && styles.startAlignedRow,
        layout === "cell" && styles.cellLayout,
        Boolean(href) && linkArea === "row" && linkedRowStyles.container,
        Boolean(href) &&
          linkArea === "row" &&
          layout === "row" &&
          linkedRowStyles.onGround,
      )}
    >
      <BottleVisual
        imageUrl={imageUrl}
        size={compact ? "xs" : sidebar ? "sm" : "md"}
      />
      <div {...stylex.props(styles.copy)}>
        <div
          {...stylex.props(
            foundationStyles.rowTitle,
            compactTitle && foundationStyles.compactRowTitle,
            styles.nameLine,
          )}
        >
          {href ? (
            <AppLink
              href={href}
              onClick={onClick}
              title={name}
              {...stylex.props(
                styles.name,
                sidebar && styles.sidebarName,
                compact && styles.compactName,
                linkArea === "row"
                  ? linkedRowStyles.primaryLink
                  : styles.titleLink,
              )}
            >
              <MatchedText query={query} text={name} />
            </AppLink>
          ) : (
            <span
              title={name}
              {...stylex.props(
                styles.name,
                sidebar && styles.sidebarName,
                compact && styles.compactName,
              )}
            >
              <MatchedText query={query} text={name} />
            </span>
          )}
          {!compact && !sidebar && isLibrary ? (
            <MemberStatus kind="library" />
          ) : null}
          {!compact && !sidebar && hasTasted ? (
            <MemberStatus kind="tasted" />
          ) : null}
        </div>
        {!compact && provenance.length ? (
          <div {...stylex.props(foundationStyles.metadata, styles.subtitle)}>
            <Join divider=" · ">
              {provenance.map((item, index) =>
                item.href ? (
                  <TextLink href={item.href} key={index} size="inherit">
                    {item.name}
                  </TextLink>
                ) : (
                  <span key={index}>{item.name}</span>
                ),
              )}
            </Join>
          </div>
        ) : null}
        {!compact && subtitle ? (
          <div
            title={getTextTitle(subtitle)}
            {...stylex.props(foundationStyles.metadata, styles.subtitle)}
          >
            {subtitle}
          </div>
        ) : null}
        {!compact && metadata.length ? (
          <div
            title={metadata.join(" · ")}
            {...stylex.props(foundationStyles.metadata, styles.metadata)}
          >
            {metadata.map((item, index) => (
              <span key={`${item}-${index}`}>
                {index ? <span aria-hidden="true"> · </span> : null}
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {!compact && relatedReleases && relatedReleases.count > 1 ? (
          <AppLink
            href={relatedReleases.href}
            {...stylex.props(
              foundationStyles.interactiveSmall,
              styles.relatedReleases,
              linkedRowStyles.nestedAction,
            )}
          >
            {relatedReleases.count.toLocaleString("en-US")} related releases
          </AppLink>
        ) : null}
        {sidebar ? trailingContent : null}
      </div>
      {!sidebar ? trailingContent : null}
    </div>
  );
}

const styles = stylex.create({
  row: {
    boxSizing: "border-box",
    display: "flex",
    width: "calc(100% + 24px)",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    marginRight: "-12px",
    marginLeft: "-12px",
    paddingTop: space.x3,
    paddingRight: "12px",
    paddingBottom: space.x3,
    paddingLeft: "12px",
  },
  startAlignedRow: {
    alignItems: "flex-start",
  },
  searchRow: {
    paddingTop: space.x2,
    paddingBottom: space.x2,
    "@media (max-width: 559px)": {
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr)",
      rowGap: space.x1,
    },
  },
  searchEnd: {
    "@media (max-width: 559px)": {
      gridColumn: "2",
      justifyContent: "flex-start",
    },
  },
  sidebarRow: {
    alignItems: "flex-start",
    paddingTop: space.x2,
    paddingBottom: space.x2,
  },
  sidebarName: {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
  },
  sidebarEnd: {
    maxWidth: "100%",
    marginTop: space.x1,
    justifyContent: "flex-start",
  },
  compactRow: {
    minHeight: "44px",
    gap: space.x2,
    paddingTop: space.x1,
    paddingBottom: space.x1,
  },
  compactName: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cellLayout: {
    width: "100%",
    marginRight: 0,
    marginLeft: 0,
    paddingRight: space.x3,
    paddingLeft: 0,
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  nameLine: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  name: {
    outline: "none",
    overflowWrap: "anywhere",
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  titleLink: {
    position: "relative",
    zIndex: zIndices.localControl,
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
      ":focus-visible": colors.accentDeep,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
  },
  metadata: {
    maxWidth: "100%",
    overflow: "hidden",
    // BottleIdentityRow uses 2px gaps to fit three lines beside its 64px thumbnail.
    marginTop: "2px",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  subtitle: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: "2px",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  relatedReleases: {
    marginTop: space.x1,
    outline: "none",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.accent,
      ":focus-visible": colors.accent,
    },
    fontWeight: 600,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  end: {
    position: "relative",
    zIndex: zIndices.localControl,
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
  },
});
