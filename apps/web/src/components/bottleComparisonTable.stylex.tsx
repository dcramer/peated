import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId } from "react";

import { colors, fonts, space } from "../styles/tokens.stylex";
import {
  BottleIdentityRow,
  type BottleIdentityRowProps,
} from "./bottleIdentityRow.stylex";
import { linkedRowStyles } from "./linkedRow.stylex";
import { getTextTitle } from "./textTitle";

const COMPACT = "@media (max-width: 639px)";

export type BottleComparisonRow = Pick<
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

export type BottleComparisonTableProps = {
  ariaLabel?: string;
  columns: readonly [string, ...string[]];
  detail?: string;
  heading?: string;
  rows: readonly [BottleComparisonRow, ...BottleComparisonRow[]];
};

/** Compares bottles across one or more compact rating or fact columns. */
export function BottleComparisonTable({
  ariaLabel = "Bottle comparison",
  columns,
  detail,
  heading,
  rows,
}: BottleComparisonTableProps) {
  const headingId = useId();

  return (
    <section
      aria-label={heading ? undefined : ariaLabel}
      aria-labelledby={heading ? headingId : undefined}
    >
      {heading ? (
        <div {...stylex.props(styles.heading)}>
          <div>
            <h2 id={headingId} {...stylex.props(styles.title)}>
              {heading}
            </h2>
            {detail ? <p {...stylex.props(styles.detail)}>{detail}</p> : null}
          </div>
        </div>
      ) : null}
      <table {...stylex.props(styles.table)}>
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
    </section>
  );
}

const styles = stylex.create({
  heading: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  detail: {
    margin: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
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
    textAlign: "right",
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
      paddingTop: "14px",
      paddingBottom: "14px",
    },
  },
  nameCell: {
    minWidth: 0,
    paddingTop: "14px",
    paddingRight: space.x3,
    paddingBottom: "14px",
    paddingLeft: 0,
    fontWeight: 400,
    textAlign: "left",
    [COMPACT]: {
      display: "block",
      gridColumn: "1 / -1",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: space.x3,
    },
  },
  valueCell: {
    paddingTop: "14px",
    paddingRight: 0,
    paddingBottom: "14px",
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
      padding: 0,
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
