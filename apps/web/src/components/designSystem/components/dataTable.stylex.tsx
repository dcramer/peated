import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../../../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";

export type DataTableColumn<Item> = {
  align?: "left" | "center" | "right";
  cell: (item: Item) => ReactNode;
  header: ReactNode;
  key: string;
  priority?: "primary" | "secondary";
};

export type DataTableProps<Item> = {
  caption: string;
  columns: readonly DataTableColumn<Item>[];
  getKey: (item: Item) => string | number;
  items: readonly Item[];
};

/** A display-only table. Routes own data, sorting, filtering, and paging. */
export function DataTable<Item>({
  caption,
  columns,
  getKey,
  items,
}: DataTableProps<Item>) {
  return (
    <div {...stylex.props(styles.frame)}>
      <table {...stylex.props(styles.table)}>
        <caption {...stylex.props(styles.caption)}>{caption}</caption>
        <thead>
          <tr {...stylex.props(styles.headerRow)}>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                {...stylex.props(
                  styles.header,
                  alignStyles[column.align ?? "left"],
                  column.priority === "secondary" && styles.secondary,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={getKey(item)} {...stylex.props(styles.row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  {...stylex.props(
                    styles.cell,
                    alignStyles[column.align ?? "left"],
                    column.priority === "secondary" && styles.secondary,
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
    overflowX: "auto",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
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
  headerRow: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  header: {
    paddingTop: space.x2,
    paddingRight: space.x3,
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
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
    },
  },
  cell: {
    paddingTop: "13px",
    paddingRight: space.x3,
    paddingBottom: "13px",
    paddingLeft: space.x3,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
    verticalAlign: "middle",
  },
  secondary: {
    [COMPACT]: {
      display: "none",
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
