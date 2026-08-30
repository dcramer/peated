import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";
const PHONE = "@media (max-width: 480px)";

export type RecordIdProps = {
  detail?: ReactNode;
  id: string;
};

export function RecordId({ detail, id }: RecordIdProps) {
  return (
    <div {...stylex.props(styles.idStamp)}>
      <span {...stylex.props(styles.idLabel)}>Peated ID</span>
      <span {...stylex.props(styles.idValue)}>{id}</span>
      <span aria-hidden="true" {...stylex.props(styles.idRule)} />
      {detail ? <span {...stylex.props(styles.idDetail)}>{detail}</span> : null}
    </div>
  );
}

export type SpecStripCell = {
  label: string;
  value?: number | string | null;
};

export type SpecStripCells =
  | readonly [SpecStripCell]
  | readonly [SpecStripCell, SpecStripCell]
  | readonly [SpecStripCell, SpecStripCell, SpecStripCell]
  | readonly [SpecStripCell, SpecStripCell, SpecStripCell, SpecStripCell];

function hasSpecStripValue(cell: SpecStripCell) {
  return cell.value !== null && cell.value !== undefined && cell.value !== "";
}

export function hasVisibleSpecStripCells(cells: SpecStripCells) {
  return cells.some(hasSpecStripValue);
}

export function SpecStrip({ cells }: { cells: SpecStripCells }) {
  const visibleCells = cells.filter(hasSpecStripValue);

  if (!visibleCells.length) return null;

  return (
    <dl
      {...stylex.props(
        styles.specStrip,
        getSpecStripColumnStyle(visibleCells.length),
      )}
    >
      {visibleCells.map((cell, index) => (
        <div
          data-spec-cell={index + 1}
          key={`${cell.label}-${index}`}
          {...stylex.props(
            styles.specCell,
            visibleCells.length >= 3 &&
              index % 2 === 0 &&
              styles.specCellPhoneOdd,
            visibleCells.length >= 3 &&
              index % 2 === 1 &&
              styles.specCellPhoneEven,
          )}
        >
          <dt {...stylex.props(styles.specLabel)}>{cell.label}</dt>
          <dd {...stylex.props(styles.specValue)}>{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const styles = stylex.create({
  idStamp: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    flexWrap: { default: "nowrap", [COMPACT]: "wrap" },
    columnGap: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    letterSpacing: 0,
    lineHeight: 1.4,
  },
  idLabel: {
    flexShrink: 0,
  },
  idValue: {
    flexShrink: 0,
    color: colors.accentDeep,
  },
  idRule: {
    minWidth: space.x3,
    height: "1px",
    flex: 1,
    backgroundColor: colors.hairline,
  },
  idDetail: {
    minWidth: 0,
    width: { default: "auto", [COMPACT]: "100%" },
    overflow: { default: "hidden", [COMPACT]: "visible" },
    textOverflow: { default: "ellipsis", [COMPACT]: "clip" },
    whiteSpace: { default: "nowrap", [COMPACT]: "normal" },
  },
  specStrip: {
    display: "grid",
    width: "100%",
    minWidth: 0,
    gap: "6px",
    margin: 0,
    paddingTop: "20px",
    paddingBottom: "20px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  specStripOne: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  specStripTwo: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  specStripThree: {
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      [PHONE]: "repeat(2, minmax(0, 1fr))",
    },
  },
  specStripFour: {
    gridTemplateColumns: {
      default: "repeat(4, minmax(0, 1fr))",
      [PHONE]: "repeat(2, minmax(0, 1fr))",
    },
  },
  specCell: {
    boxSizing: "border-box",
    minWidth: 0,
    flex: "1 1 0",
    display: "flex",
    flexDirection: "column",
    paddingRight: space.x6,
    paddingLeft: space.x6,
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
    ":first-child": { paddingLeft: 0, borderLeftWidth: 0 },
  },
  specCellPhoneOdd: {
    paddingLeft: { default: null, [PHONE]: 0 },
    borderLeftWidth: { default: null, [PHONE]: 0 },
  },
  specCellPhoneEven: {
    paddingLeft: { default: null, [PHONE]: space.x6 },
    borderLeftWidth: { default: null, [PHONE]: "1px" },
  },
  specLabel: {
    order: 2,
    marginTop: "6px",
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    letterSpacing: 0,
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  specValue: {
    order: 1,
    overflow: "hidden",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "28px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const specStripColumnStyles = {
  1: styles.specStripOne,
  2: styles.specStripTwo,
  3: styles.specStripThree,
  4: styles.specStripFour,
} satisfies Record<SpecStripCells["length"], stylex.StyleXStyles>;

function getSpecStripColumnStyle(cellCount: number) {
  if (cellCount === 1) return specStripColumnStyles[1];
  if (cellCount === 2) return specStripColumnStyles[2];
  if (cellCount === 3) return specStripColumnStyles[3];
  return specStripColumnStyles[4];
}
