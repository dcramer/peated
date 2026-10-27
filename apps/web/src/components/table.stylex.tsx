import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { linkedRowStyles } from "./linkedRow.stylex";
import { LinkPending } from "./linkPending.stylex";

// Matches breakpointStyles in foundations, so rows can move a hidden column's
// value into another cell with narrowOnly, as TastingTable does with its date.
const NARROW = "@media (max-width: 759px)";

export type TableColumn<Item> = {
  align?: "left" | "center" | "right";
  cell: (item: Item) => ReactNode;
  header: ReactNode;
  /** Raises buttons and menus above the row link so they stay clickable. */
  interactive?: boolean;
  key: string;
  /** Secondary columns hide on narrow screens. */
  priority?: "primary" | "secondary";
  /** Use none when the cell content brings its own top and bottom padding. */
  verticalPadding?: "default" | "none";
  /**
   * A fixed width for short values, such as an ABV or age in figure. The
   * fill column takes the remaining space; without one, the first column
   * without a width does. Other columns without a width fit their content
   * and wrap past 8rem.
   */
  width?:
    | "action"
    | "count"
    | "date"
    | "figure"
    | "fill"
    | "menu"
    | "rating"
    | "toggleMenu";
};

export type TableProps<Item> = {
  caption: string;
  columns: readonly TableColumn<Item>[];
  /**
   * Compact rows use less padding and align cells to their first line, for
   * rows that add a second line under a compact identity.
   */
  density?: "compact" | "standard";
  /** Links the row: the first column's content becomes the row's link. */
  getHref?: (item: Item) => string | null | undefined;
  getKey: (item: Item) => string | number;
  items: readonly Item[];
  /**
   * Set when a cell already holds the row's link, such as a linked identity
   * row. Use getHref instead for plain first-column text.
   */
  linked?: boolean;
};

/**
 * Every table: shared headers, aligned cells, row links, and narrow-screen
 * columns. Routes own data, sorting, filtering, and paging.
 */
export function Table<Item>({
  caption,
  columns,
  density = "standard",
  getHref,
  getKey,
  items,
  linked = false,
}: TableProps<Item>) {
  const markedFillIndex = columns.findIndex(
    (column) => column.width === "fill",
  );
  const fillIndex =
    markedFillIndex >= 0
      ? markedFillIndex
      : columns.findIndex((column) => !column.width);
  // Secondary columns hide on narrow screens, so the first visible one changes.
  const firstNarrowIndex = columns.findIndex(
    (column) => column.priority !== "secondary",
  );
  const lastIndex = columns.length - 1;

  function columnStyles(column: TableColumn<Item>, index: number) {
    return [
      alignStyles[column.align ?? "left"],
      column.priority === "secondary" && styles.secondary,
      index === fillIndex ? styles.fill : !column.width && styles.text,
      column.width && column.width !== "fill" && widthStyles[column.width],
      index === lastIndex && styles.lastColumn,
    ];
  }

  function dividerStyles(index: number) {
    return [
      styles.divider,
      index === firstNarrowIndex && styles.firstNarrowDivider,
      index === 0 && styles.firstDivider,
      index === lastIndex && styles.lastDivider,
    ];
  }

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
                  dividerStyles(index),
                  columnStyles(column, index),
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, rowIndex) => {
            const href = getHref?.(item);
            const isLinked = linked || Boolean(href);

            return (
              <tr
                data-record-key={getKey(item)}
                key={getKey(item)}
                {...stylex.props(
                  isLinked && linkedRowStyles.container,
                  isLinked && linkedRowStyles.onGround,
                )}
              >
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.cell,
                      density === "compact" && styles.compactCell,
                      column.verticalPadding === "none" &&
                        styles.noVerticalPadding,
                      // DESIGN.md: no divider after the last row.
                      rowIndex < items.length - 1 && dividerStyles(index),
                      columnStyles(column, index),
                      column.width === "count" && [
                        foundationStyles.compactRowTitle,
                        styles.countCell,
                      ],
                      column.interactive && linkedRowStyles.nestedAction,
                    )}
                  >
                    {index === 0 && href ? (
                      <AppLink
                        href={href}
                        {...stylex.props(
                          styles.rowLink,
                          linkedRowStyles.primaryLink,
                        )}
                      >
                        {column.cell(item)}
                        <LinkPending />
                      </AppLink>
                    ) : (
                      column.cell(item)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
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
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto",
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
    color: colors.ink,
    verticalAlign: "middle",
  },
  compactCell: {
    paddingTop: space.x2,
    paddingBottom: space.x2,
    verticalAlign: "top",
  },
  noVerticalPadding: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  lastColumn: {
    paddingRight: space.x3,
  },
  // Takes the space other columns leave. A zero max width lets long names
  // wrap or cut off instead of widening the table.
  fill: {
    width: "100%",
    minWidth: "12rem",
    maxWidth: 0,
  },
  // Other text columns fit their content, but the fill column would squeeze
  // them to their longest word; short values such as a name stay on one line.
  text: {
    minWidth: "8rem",
  },
  rowLink: {
    fontWeight: 600,
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
  secondary: {
    [NARROW]: {
      display: "none",
    },
  },
  // Fixed widths are also minimums: beside the full-width fill column, the
  // browser would otherwise shrink them to their content.
  countWidth: {
    width: "76px",
    minWidth: "76px",
  },
  countCell: {
    fontVariantNumeric: "tabular-nums",
  },
  actionWidth: {
    width: "104px",
    minWidth: "104px",
    [NARROW]: {
      width: "92px",
      minWidth: "92px",
    },
  },
  menuWidth: {
    // 12px on each side of the 44px mobile action target; the right side is
    // the frame's bleed, so the target lines up with the text edge.
    width: "68px",
    minWidth: "68px",
    paddingRight: space.x3,
    paddingLeft: space.x3,
  },
  toggleMenuWidth: {
    // Two 44px actions with a small gap; narrow tables show only the menu.
    width: "116px",
    minWidth: "116px",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    [NARROW]: {
      width: "68px",
      minWidth: "68px",
    },
  },
  dateWidth: {
    width: "112px",
    minWidth: "112px",
  },
  figureWidth: {
    width: "76px",
    minWidth: "76px",
  },
  // Rating is always the last column, so 12px of each width is the bleed.
  ratingWidth: {
    width: "196px",
    minWidth: "196px",
    [NARROW]: {
      width: "116px",
      minWidth: "116px",
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
