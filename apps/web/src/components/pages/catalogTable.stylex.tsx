import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../../styles/tokens.stylex";
import { linkedRowStyles } from "../linkedRow.stylex";

const COMPACT = "@media (max-width: 639px)";

export type CatalogTableColumn<Item> = {
  align?: "left" | "center" | "right";
  cell: (item: Item) => ReactNode;
  header: ReactNode;
  interactive?: boolean;
  key: string;
  padding?: "default" | "flush";
  priority?: "primary" | "secondary";
  width?: "action" | "count" | "rating";
};

export type CatalogTableProps<Item> = {
  caption: string;
  columns: readonly CatalogTableColumn<Item>[];
  getKey: (item: Item) => string | number;
  items: readonly Item[];
  linked?: boolean;
};

/** Aligns rich catalog identities, metrics, and row actions under shared headers. */
export function CatalogTable<Item>({
  caption,
  columns,
  getKey,
  items,
  linked = false,
}: CatalogTableProps<Item>) {
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
                  styles.header,
                  index === 0 && styles.firstColumn,
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
                    index === 0 && styles.firstColumn,
                    alignStyles[column.align ?? "left"],
                    column.padding === "flush" && styles.flushCell,
                    column.priority === "secondary" && styles.secondary,
                    column.width && widthStyles[column.width],
                    column.width === "count" && styles.countCell,
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
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
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
  firstColumn: {
    paddingLeft: 0,
  },
  flushCell: {
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  },
  secondary: {
    [COMPACT]: {
      display: "none",
    },
  },
  countWidth: {
    width: "76px",
  },
  countCell: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1,
  },
  actionWidth: {
    width: "104px",
    [COMPACT]: {
      width: "92px",
    },
  },
  ratingWidth: {
    width: "184px",
    [COMPACT]: {
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
  rating: styles.ratingWidth,
} as const;
