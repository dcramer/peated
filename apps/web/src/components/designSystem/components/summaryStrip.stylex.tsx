import * as stylex from "@stylexjs/stylex";

import { colors, controlMetrics, fonts } from "../../../styles/tokens.stylex";

export type SummaryStripCell = {
  detail?: string;
  label: string;
  value: number | string;
};

export type SummaryStripCells =
  | readonly [SummaryStripCell, SummaryStripCell, SummaryStripCell]
  | readonly [
      SummaryStripCell,
      SummaryStripCell,
      SummaryStripCell,
      SummaryStripCell,
    ]
  | readonly [
      SummaryStripCell,
      SummaryStripCell,
      SummaryStripCell,
      SummaryStripCell,
      SummaryStripCell,
    ];

/** Shows three to five page-level facts without turning them into rankings. */
export function SummaryStrip({ cells }: { cells: SummaryStripCells }) {
  return (
    <dl {...stylex.props(styles.strip)}>
      {cells.map((cell, index) => (
        <div
          data-summary-cell={index + 1}
          key={`${cell.label}-${index}`}
          {...stylex.props(styles.cell)}
        >
          <dt {...stylex.props(styles.label)}>{cell.label}</dt>
          <dd {...stylex.props(styles.valueRow)}>
            <strong {...stylex.props(styles.value)}>{cell.value}</strong>
            {cell.detail ? (
              <span {...stylex.props(styles.detail)}>{cell.detail}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const styles = stylex.create({
  strip: {
    display: "grid",
    width: "100%",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(128px, 100%), 1fr))",
    gap: "6px",
    margin: 0,
    padding: 0,
  },
  cell: {
    boxSizing: "border-box",
    minWidth: 0,
    paddingTop: "14px",
    paddingRight: "16px",
    paddingBottom: "14px",
    paddingLeft: "16px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  label: {
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
  valueRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: "8px",
    margin: 0,
    marginTop: "2px",
  },
  value: {
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
  },
  detail: {
    minWidth: 0,
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
