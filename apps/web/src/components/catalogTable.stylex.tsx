import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";

// Matches breakpointStyles in foundations, which TastingTable uses to move its
// date into the details line when the Date column hides.
const NARROW = "@media (max-width: 759px)";

export type CatalogTableColumn<Item> = {
  align?: "left" | "center" | "right";
  cell: (item: Item) => ReactNode;
  header: ReactNode;
  interactive?: boolean;
  key: string;
  padding?: "default" | "flush";
  priority?: "primary" | "secondary";
  /** Figure fits a short value such as an ABV or age. */
  width?:
    | "action"
    | "count"
    | "date"
    | "figure"
    | "menu"
    | "rating"
    | "toggleMenu";
};

export type CatalogTableProps<Item> = {
  caption: string;
  columns: readonly CatalogTableColumn<Item>[];
  /**
   * Compact rows use less padding and align cells to their first line, for
   * rows that add a second line under a compact identity.
   */
  density?: "compact" | "standard";
  getKey: (item: Item) => string | number;
  items: readonly Item[];
  linked?: boolean;
};

/** Aligns rich catalog identities, metrics, and row actions under shared headers. */
export function CatalogTable<Item>({
  caption,
  columns,
  density = "standard",
  getKey,
  items,
  linked = false,
}: CatalogTableProps<Item>) {
  // Secondary columns hide on narrow screens, so the first visible one changes.
  const firstNarrowIndex = columns.findIndex(
    (column) => column.priority !== "secondary",
  );
  const lastIndex = columns.length - 1;

  return (
    <div {...stylex.props(styles.frame)}>
      <table {...stylex.props(styles.table)}>
        <caption {...stylex.props(styles.caption)}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                {...stylex.props(
                  foundationStyles.fieldLabel,
                  styles.header,
                  styles.divider,
                  index === firstNarrowIndex && styles.firstNarrowDivider,
                  index === 0 && styles.firstDivider,
                  index === lastIndex && styles.lastDivider,
                  alignStyles[column.align ?? "left"],
                  column.priority === "secondary" && styles.secondary,
                  column.width && widthStyles[column.width],
                  index === lastIndex && styles.lastColumn,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIndex) => (
            <tr
              data-record-key={getKey(item)}
              key={getKey(item)}
              {...stylex.props(
                linked && linkedRowStyles.container,
                linked && linkedRowStyles.onGround,
              )}
            >
              {columns.map((column, index) => (
                <td
                  key={column.key}
                  {...stylex.props(
                    styles.cell,
                    density === "compact" && styles.compactCell,
                    // DESIGN.md: no divider after the last row.
                    rowIndex < items.length - 1 && [
                      styles.divider,
                      index === firstNarrowIndex && styles.firstNarrowDivider,
                      index === 0 && styles.firstDivider,
                      index === lastIndex && styles.lastDivider,
                    ],
                    alignStyles[column.align ?? "left"],
                    column.padding === "flush" && styles.flushCell,
                    column.priority === "secondary" && styles.secondary,
                    column.width && widthStyles[column.width],
                    index === lastIndex && styles.lastColumn,
                    column.width === "count" && [
                      foundationStyles.compactRowTitle,
                      styles.countCell,
                    ],
                    column.interactive && linkedRowStyles.nestedAction,
                  )}
                >
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = stylex.create({
  // Like linked ItemList rows, the frame reaches 12px past the text on each
  // side so a row's hover fill has room around its content. Edge cells pad the
  // text back into line and dividers stop at the text edge.
  frame: {
    width: "calc(100% + 24px)",
    minWidth: 0,
    marginRight: "-12px",
    marginLeft: "-12px",
    overflowX: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  caption: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  header: {
    boxSizing: "border-box",
    paddingTop: space.x2,
    paddingRight: 0,
    paddingBottom: space.x2,
    paddingLeft: space.x3,
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  },
  cell: {
    boxSizing: "border-box",
    minWidth: 0,
    paddingTop: "14px",
    paddingRight: 0,
    paddingBottom: "14px",
    paddingLeft: space.x3,
    verticalAlign: "middle",
  },
  compactCell: {
    paddingTop: space.x2,
    paddingBottom: space.x2,
    verticalAlign: "top",
  },
  lastColumn: {
    paddingRight: space.x3,
  },
  // A 1px line painted at the cell's bottom edge. Cell backgrounds, unlike
  // row borders, can stop short of the bleed on the edge cells.
  divider: {
    backgroundImage: `linear-gradient(${colors.hairline}, ${colors.hairline})`,
    backgroundPosition: "left bottom",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 1px",
  },
  firstDivider: {
    backgroundPosition: "right bottom",
    backgroundSize: "calc(100% - 12px) 1px",
  },
  firstNarrowDivider: {
    backgroundPosition: { default: "left bottom", [NARROW]: "right bottom" },
    backgroundSize: { default: "100% 1px", [NARROW]: "calc(100% - 12px) 1px" },
  },
  lastDivider: {
    backgroundSize: "calc(100% - 12px) 1px",
  },
  flushCell: {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  },
  secondary: {
    [NARROW]: {
      display: "none",
    },
  },
  countWidth: {
    width: "76px",
  },
  countCell: {
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
  actionWidth: {
    width: "104px",
    [NARROW]: {
      width: "92px",
    },
  },
  menuWidth: {
    // 12px on each side of the 44px mobile action target; the right side is
    // the frame's bleed, so the target lines up with the text edge.
    width: "68px",
    paddingRight: space.x3,
    paddingLeft: space.x3,
  },
  toggleMenuWidth: {
    // Two 44px actions with a small gap; narrow tables show only the menu.
    width: "116px",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    [NARROW]: {
      width: "68px",
    },
  },
  dateWidth: {
    width: "112px",
  },
  figureWidth: {
    width: "76px",
  },
  // Rating is always the last column, so 12px of each width is the bleed.
  ratingWidth: {
    width: "196px",
    [NARROW]: {
      width: "116px",
    },
  },
  left: { textAlign: "left" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
});
const alignStyles = {
  left: styles.left,
  center: styles.center,
  right: styles.right,
} as const;
const widthStyles = {
  action: styles.actionWidth,
  count: styles.countWidth,
  date: styles.dateWidth,
  figure: styles.figureWidth,
  menu: styles.menuWidth,
  rating: styles.ratingWidth,
  toggleMenu: styles.toggleMenuWidth,
} as const;
