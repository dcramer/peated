import * as stylex from "@stylexjs/stylex";

import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

const PHONE = "@media (max-width: 480px)";

export type RecordIdProps = {
  detail?: string;
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

export function SpecStrip({ cells }: { cells: SpecStripCells }) {
  return (
    <dl
      {...stylex.props(styles.specStrip, specStripColumnStyles[cells.length])}
    >
      {cells.map((cell, index) => (
        <div
          data-spec-cell={index + 1}
          key={`${cell.label}-${index}`}
          {...stylex.props(styles.specCell)}
        >
          <dt {...stylex.props(styles.specLabel)}>{cell.label}</dt>
          <dd {...stylex.props(styles.specValue)}>
            {cell.value === null || cell.value === undefined ? "–" : cell.value}
          </dd>
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
    columnGap: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
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
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  specStrip: {
    display: "grid",
    width: "100%",
    minWidth: 0,
    gap: "6px",
    margin: 0,
    padding: 0,
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
    paddingTop: "9px",
    paddingRight: "13px",
    paddingBottom: "9px",
    paddingLeft: "13px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  specLabel: {
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  specValue: {
    overflow: "hidden",
    margin: 0,
    marginTop: "2px",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
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
