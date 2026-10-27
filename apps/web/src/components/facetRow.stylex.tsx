import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
} from "../styles/tokens.stylex";
import { LoadingText } from "./feedback.stylex";

type AvailableFacet = {
  count: number;
  total: number;
};

type CountlessFacet = {
  count?: undefined;
  total?: never;
};

type UnavailableFacet = {
  count: null;
  total?: never;
};

export type FacetRowProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className" | "disabled" | "style"
> &
  (AvailableFacet | CountlessFacet | UnavailableFacet) & {
    /** Show the × that clears a selected row. Off for required choices. */
    clearable?: boolean;
    label: string;
    selected?: boolean;
  };

/** Combines a filter choice with an optional API-owned count and share. */
export function FacetRow({
  clearable = true,
  count,
  label,
  selected = false,
  total,
  type = "button",
  ...props
}: FacetRowProps) {
  const available = count !== null;
  const counted = count !== null && count !== undefined;
  const share = counted && total > 0 ? Math.min(100, (count / total) * 100) : 0;

  return (
    <button
      {...props}
      aria-pressed={available ? selected : undefined}
      disabled={!available}
      type={type}
      {...stylex.props(
        styles.row,
        selected && styles.selected,
        !available && styles.unavailable,
      )}
    >
      <span
        title={label}
        {...stylex.props(
          foundationStyles.interactiveSmall,
          styles.label,
          !counted && styles.labelWide,
          selected && [foundationStyles.interactiveSmall, styles.selectedLabel],
        )}
      >
        {label}
      </span>
      {counted ? (
        <span aria-hidden="true" {...stylex.props(styles.trackSlot)}>
          <span {...stylex.props(styles.track)}>
            <span
              {...stylex.props(
                styles.fill(`${share}%`),
                selected && styles.selectedFill,
              )}
            />
          </span>
        </span>
      ) : null}
      {counted || !available ? (
        <span {...stylex.props(foundationStyles.metadata, styles.count)}>
          {counted ? count.toLocaleString("en-US") : "–"}
        </span>
      ) : null}
      <span aria-hidden="true" {...stylex.props(styles.dismissSlot)}>
        {available && selected && clearable ? "×" : null}
      </span>
    </button>
  );
}

/** Reserves one counted facet row while its counts load. */
export function FacetRowLoading() {
  return (
    <div aria-hidden="true" {...stylex.props(styles.row, styles.unavailable)}>
      <span {...stylex.props(foundationStyles.interactiveSmall, styles.label)}>
        <LoadingText width="70%" />
      </span>
      <span {...stylex.props(styles.trackSlot)}>
        <span {...stylex.props(styles.track)} />
      </span>
      <span {...stylex.props(foundationStyles.metadata, styles.count)}>
        <LoadingText width="2ch" />
      </span>
      <span {...stylex.props(styles.dismissSlot)} />
    </div>
  );
}

const styles = stylex.create({
  // Like linked rows, the row reaches 8px past the text on each side so its
  // hover and selected fills have room around the label and count.
  row: {
    boxSizing: "border-box",
    display: "flex",
    width: "calc(100% + 16px)",
    minWidth: 0,
    alignItems: "center",
    gap: "10px",
    marginRight: "-8px",
    marginLeft: "-8px",
    paddingTop: "7px",
    paddingRight: "8px",
    paddingBottom: "7px",
    paddingLeft: "8px",
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
    },
    color: colors.ink,
    fontFamily: fonts.reading,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  // DESIGN.md: accent tint marks selected data.
  selected: {
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
  },
  unavailable: {
    backgroundColor: "transparent",
    color: colors.inkMuted,
    cursor: "default",
  },
  label: {
    width: "128px",
    minWidth: 0,
    flex: "0 1 128px",
    overflow: "hidden",
    fontWeight: 600,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  labelWide: {
    width: "auto",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
  },
  selectedLabel: {
    fontWeight: 700,
  },
  trackSlot: {
    display: "flex",
    minWidth: "36px",
    flex: "1 1 auto",
    alignItems: "center",
  },
  track: {
    display: "block",
    width: "100%",
    height: "6px",
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.surface,
  },
  fill: (width: string) => ({
    display: "block",
    width,
    height: "100%",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.dataAccent,
  }),
  selectedFill: {
    backgroundColor: colors.accent,
  },
  count: {
    width: "48px",
    flex: "0 0 48px",
    overflow: "hidden",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    textOverflow: "clip",
    whiteSpace: "nowrap",
  },
  dismissSlot: {
    width: "14px",
    flex: "0 0 14px",
    fontFamily: fonts.reading,
    fontSize: "12px",
    lineHeight: 1,
    textAlign: "right",
  },
});
