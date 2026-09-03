import * as stylex from "@stylexjs/stylex";
import type { MouseEventHandler, ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { linkedRowStyles } from "./linkedRow.stylex";
import { MatchedText } from "./matchedText.stylex";

export type TextIdentityRowProps = {
  end?: ReactNode;
  href?: string;
  layout?: "row" | "cell";
  metadata?: string;
  name: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  query?: string;
  status?: ReactNode;
  variant?: "standard" | "search" | "sidebar";
};

/**
 * Internal text identity layout. Entity, series, and location rows own their
 * domain metadata; callers use those components rather than this layout helper.
 */
export function TextIdentityRow({
  end,
  href,
  layout = "row",
  metadata,
  name,
  onClick,
  query,
  status,
  variant = "standard",
}: TextIdentityRowProps) {
  const title = (
    <>
      <MatchedText query={query} text={name} />
      {status}
    </>
  );
  return (
    <div
      {...stylex.props(
        styles.row,
        variant !== "standard" && styles.compact,
        layout === "cell" && styles.cell,
        Boolean(href) && layout === "row" && linkedRowStyles.container,
        Boolean(href) && layout === "row" && linkedRowStyles.onGround,
      )}
    >
      <div {...stylex.props(styles.copy)}>
        <div
          {...stylex.props(
            foundationStyles.rowTitle,
            variant !== "standard" && foundationStyles.compactRowTitle,
          )}
        >
          {href ? (
            <AppLink
              href={href}
              onClick={onClick}
              title={name}
              {...stylex.props(styles.name, linkedRowStyles.primaryLink)}
            >
              {title}
            </AppLink>
          ) : (
            <span title={name} {...stylex.props(styles.name)}>
              {title}
            </span>
          )}
        </div>
        {metadata ? (
          <div {...stylex.props(foundationStyles.metadata, styles.metadata)}>
            {metadata}
          </div>
        ) : null}
      </div>
      {end ? (
        <div
          {...stylex.props(
            foundationStyles.metadata,
            styles.end,
            linkedRowStyles.nestedAction,
          )}
        >
          {end}
        </div>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  row: {
    boxSizing: "border-box",
    display: "flex",
    width: "calc(100% + 24px)",
    minWidth: 0,
    minHeight: "44px",
    alignItems: "center",
    gap: space.x3,
    marginRight: "-12px",
    marginLeft: "-12px",
    padding: space.x3,
  },
  compact: { paddingTop: space.x2, paddingBottom: space.x2 },
  cell: {
    width: "100%",
    marginRight: 0,
    marginLeft: 0,
    paddingRight: 0,
    paddingLeft: 0,
  },
  copy: { minWidth: 0, flex: 1 },
  name: { color: colors.ink, overflowWrap: "anywhere", textDecoration: "none" },
  metadata: {
    marginTop: space.x1,
    color: colors.inkMuted,
    overflowWrap: "anywhere",
  },
  end: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: space.x3,
    fontVariantNumeric: "tabular-nums",
  },
});
