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
  /** Standard: three identity lines. Compact: one name line for library additions. */
  variant?: "standard" | "compact";
};

/**
 * Bottle identity for lists and activity. Standard shows name, provenance, then
 * release facts; compact shows one name line for library additions.
 * Use toBottleListItem for API Bottles or getBottleIdentityProps for partial reads.
 * Both variants take the same full marketed name and own their thumbnail size.
 * Use layout="cell" inside an existing row/selection control. Compact omits
 * provenance, metadata, subtitle, status, and related releases; end remains available.
 */
export function BottleIdentityRow({
  align = "center",
  end,
  hasTasted = false,
  href,
  imageUrl,
  isLibrary = false,
  layout = "row",
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
  return (
    <div
      {...stylex.props(
        styles.row,
        compact && styles.compactRow,
        !compact && align === "start" && styles.startAlignedRow,
        layout === "cell" && styles.cellLayout,
        Boolean(href) && layout === "row" && linkedRowStyles.container,
        Boolean(href) && layout === "row" && linkedRowStyles.onGround,
      )}
    >
      <BottleVisual imageUrl={imageUrl} size={compact ? "xs" : "md"} />
      <div {...stylex.props(styles.copy)}>
        <div
          {...stylex.props(styles.nameLine, compact && styles.compactNameLine)}
        >
          {href ? (
            <AppLink
              href={href}
              onClick={onClick}
              title={name}
              {...stylex.props(
                foundationStyles.rowTitle,
                styles.name,
                compact && styles.compactName,
                linkedRowStyles.primaryLink,
              )}
            >
              <MatchedText query={query} text={name} />
            </AppLink>
          ) : (
            <span
              title={name}
              {...stylex.props(
                foundationStyles.rowTitle,
                styles.name,
                compact && styles.compactName,
              )}
            >
              <MatchedText query={query} text={name} />
            </span>
          )}
          {!compact && isLibrary ? <MemberStatus kind="library" /> : null}
          {!compact && hasTasted ? <MemberStatus kind="tasted" /> : null}
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
      </div>
      {end ? <div {...stylex.props(styles.end)}>{end}</div> : null}
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
  compactRow: {
    minHeight: "44px",
    gap: space.x2,
    paddingTop: space.x1,
    paddingBottom: space.x1,
  },
  compactNameLine: { marginTop: 0 },
  compactName: {
    display: "block",
    overflow: "hidden",
    fontSize: "15px",
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
    marginTop: "2px",
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
  metadata: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: space.x1,
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  subtitle: {
    maxWidth: "100%",
    overflow: "hidden",
    marginTop: "3px",
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
