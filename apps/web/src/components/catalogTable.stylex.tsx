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

  return (
    <div {...stylex.props(styles.frame)}>
      <table {...stylex.props(styles.table)}>
        <caption {...stylex.props(styles.caption)}>{caption}</caption>
        <thead>
          <tr {...stylex.props(styles.headerRow)}>
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                {...stylex.props(
                  foundationStyles.fieldLabel,
                  styles.header,
                  index === 0 && styles.firstColumn,
                  index === firstNarrowIndex && styles.firstNarrowColumn,
                  alignStyles[column.align ?? "left"],
                  column.priority === "secondary" && styles.secondary,
                  column.width && widthStyles[column.width],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              data-record-key={getKey(item)}
              key={getKey(item)}
              {...stylex.props(
                styles.row,
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
                    index === 0 && styles.firstColumn,
                    index === firstNarrowIndex && styles.firstNarrowColumn,
                    alignStyles[column.align ?? "left"],
                    column.padding === "flush" && styles.flushCell,
                    column.priority === "secondary" && styles.secondary,
                    column.width && widthStyles[column.width],
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
  frame: {
    width: "100%",
    minWidth: 0,
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
  headerRow: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
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
  row: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
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
  firstColumn: {
    paddingLeft: 0,
  },
  firstNarrowColumn: {
    paddingLeft: { default: null, [NARROW]: 0 },
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
    // CatalogTable leaves 12px on each side of the 44px mobile action target.
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
  ratingWidth: {
    width: "184px",
    [NARROW]: {
      width: "104px",
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
