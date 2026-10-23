import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { space } from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";

/**
 * Places an About article beside its sidebar. On phones the sidebar follows
 * the lead, so key facts come before the long read.
 */
export function EntityAboutLayout({
  lead,
  article,
  rail,
}: {
  lead: ReactNode;
  article: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.grid)}>
      <div {...stylex.props(styles.lead)}>{lead}</div>
      <div {...stylex.props(styles.article)}>{article}</div>
      <aside {...stylex.props(styles.rail)}>{rail}</aside>
    </div>
  );
}

const styles = stylex.create({
  grid: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    gridTemplateAreas: {
      default: '"lead rail" "article rail"',
      [NARROW]: '"lead" "rail" "article"',
    },
    gridTemplateRows: { default: "auto 1fr", [NARROW]: "auto" },
    alignItems: "start",
    columnGap: space.x12,
    rowGap: space.x6,
    paddingTop: space.x4,
  },
  lead: {
    gridArea: "lead",
    minWidth: 0,
  },
  article: {
    gridArea: "article",
    minWidth: 0,
  },
  rail: {
    gridArea: "rail",
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    minWidth: 0,
  },
});
