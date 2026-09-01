import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../styles/tokens.stylex";
import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";
import { getTextTitle } from "./textTitle";

const COMPACT = "@media (max-width: 639px)";

export type BottleTableRow = Pick<
  BottleIdentityRowProps,
  | "align"
  | "brand"
  | "brandHref"
  | "hasTasted"
  | "href"
  | "imageUrl"
  | "isLibrary"
  | "metadata"
  | "name"
  | "relatedReleases"
  | "subtitle"
> & {
  id: string;
  values: readonly [ReactNode, ...ReactNode[]];
};

export type BottleTableProps = {
  ariaLabel?: string;
  columns: readonly [string, ...string[]];
  rows: readonly [BottleTableRow, ...BottleTableRow[]];
};

/** Lists bottles with one or more compact rating or fact columns. */
export function BottleTable({
  ariaLabel = "Bottles",
  columns,
  rows,
}: BottleTableProps) {
  return (
    <table aria-label={ariaLabel} {...stylex.props(styles.table)}>
      <thead {...stylex.props(styles.tableHead)}>
        <tr {...stylex.props(styles.headerRow)}>
          <th scope="col" {...stylex.props(styles.nameHeader)}>
            Bottle
          </th>
          {columns.map((column, index) => (
            <th
              key={`${column}-${index}`}
              scope="col"
              {...stylex.props(styles.valueHeader)}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            data-record-key={row.id}
            key={row.id}
            {...stylex.props(
              styles.row,
              Boolean(row.href) && linkedRowStyles.container,
              Boolean(row.href) && linkedRowStyles.onGround,
            )}
          >
            <th scope="row" {...stylex.props(styles.nameCell)}>
              <BottleIdentityRow
                align={row.align}
                brand={row.brand}
                brandHref={row.brandHref}
                hasTasted={row.hasTasted}
                href={row.href}
                imageUrl={row.imageUrl}
                isLibrary={row.isLibrary}
                layout="cell"
                metadata={row.metadata}
                name={row.name}
                relatedReleases={row.relatedReleases}
                subtitle={row.subtitle}
              />
            </th>
            {row.values.map((value, index) => (
              <td key={index} {...stylex.props(styles.valueCell)}>
                <span
                  title={columns[index]}
                  {...stylex.props(styles.mobileLabel)}
                >
                  {columns[index]}
                </span>
                <span
                  title={getTextTitle(value ?? "–")}
                  {...stylex.props(styles.value)}
                >
                  {value ?? "–"}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const styles = stylex.create({
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  tableHead: {
    display: {
      default: "table-header-group",
      [COMPACT]: "none",
    },
  },
  headerRow: {},
  nameHeader: {
    paddingTop: space.x2,
    paddingRight: space.x3,
    paddingBottom: space.x2,
    paddingLeft: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textAlign: "left",
    textTransform: "uppercase",
  },
  valueHeader: {
    width: "152px",
    paddingTop: space.x2,
    paddingRight: 0,
    paddingBottom: space.x2,
    paddingLeft: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.04em",
    lineHeight: 1.3,
    textAlign: "center",
    textTransform: "uppercase",
  },
  row: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    [COMPACT]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      columnGap: space.x4,
    },
  },
  nameCell: {
    minWidth: 0,
    padding: 0,
    fontWeight: 400,
    textAlign: "left",
    [COMPACT]: {
      display: "block",
      gridColumn: "1 / -1",
    },
  },
  valueCell: {
    paddingTop: space.x3,
    paddingRight: 0,
    paddingBottom: space.x3,
    paddingLeft: space.x3,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.35,
    textAlign: "right",
    [COMPACT]: {
      display: "flex",
      minWidth: 0,
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.x2,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: space.x3,
      paddingLeft: 0,
      textAlign: "right",
    },
  },
  mobileLabel: {
    display: {
      default: "none",
      [COMPACT]: "inline",
    },
    overflow: "hidden",
    color: colors.inkMuted,
    fontSize: "10px",
    letterSpacing: "0.04em",
    textOverflow: "ellipsis",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  value: {
    display: "inline-flex",
    justifyContent: "flex-end",
  },
});
