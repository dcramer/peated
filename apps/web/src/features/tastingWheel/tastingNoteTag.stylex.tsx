import type { TagCategory } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics } from "../../styles/tokens.stylex";
import { tastingCategoryOutlineStyles } from "./tastingCategoryStyles.stylex";

/** Displays a saved tasting note with its stored category color when known. */
export function TastingNoteTag({
  category,
  children,
}: {
  category?: TagCategory;
  children: ReactNode;
}) {
  return (
    <span
      data-category={category}
      {...stylex.props(
        foundationStyles.interactiveSmall,
        styles.tag,
        category
          ? tastingCategoryOutlineStyles[category]
          : styles.neutralOutline,
      )}
    >
      {children}
    </span>
  );
}

const styles = stylex.create({
  tag: {
    boxSizing: "border-box",
    display: "inline-flex",
    minHeight: "26px",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    paddingTop: "5px",
    paddingRight: "10px",
    paddingBottom: "5px",
    paddingLeft: "10px",
    color: colors.ink,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  neutralOutline: {
    boxShadow: `inset 0 0 0 1px ${colors.sectionRule}`,
    color: colors.inkMuted,
  },
});
