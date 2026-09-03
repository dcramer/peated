"use client";

import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../styles/tokens.stylex";

const COLLECTION_BOTTLE_STATUS_VALUES = ["sealed", "open", "empty"] as const;

export type CollectionBottleStatus =
  (typeof COLLECTION_BOTTLE_STATUS_VALUES)[number];

export type CollectionBottleStatusValue = CollectionBottleStatus | null;

const statusLabels = {
  sealed: "Sealed",
  open: "Open",
  empty: "Empty",
} satisfies Record<CollectionBottleStatus, string>;

/** Selects an optional Library bottle status with the same treatment as serving style. */
export function CollectionBottleStatusInput({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (status: CollectionBottleStatus) => void;
  value?: CollectionBottleStatusValue;
}) {
  const name = useId();
  return (
    <div
      aria-label="Bottle status"
      role="radiogroup"
      {...stylex.props(styles.group, disabled && styles.disabled)}
    >
      {COLLECTION_BOTTLE_STATUS_VALUES.map((status) => {
        const selected = value === status;

        return (
          <label
            key={status}
            {...stylex.props(
              foundationStyles.interactive,
              styles.option,
              selected && styles.selected,
            )}
          >
            <input
              checked={selected}
              disabled={disabled}
              name={name}
              onChange={() => onChange(status)}
              type="radio"
              value={status}
              {...stylex.props(styles.input)}
            />
            {statusLabels[status]}
          </label>
        );
      })}
    </div>
  );
}

const styles = stylex.create({
  group: {
    display: "grid",
    width: "100%",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: space.x2,
  },
  option: {
    position: "relative",
    display: "flex",
    minWidth: 0,
    height: "44px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.fieldBackground,
    color: colors.inkMuted,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.fieldRule}`,
      ":hover": `inset 0 0 0 1px ${colors.inkMuted}`,
      ":active": `inset 0 0 0 2px ${colors.accent}`,
      ":focus-within": effects.focusRing,
    },
  },
  selected: {
    backgroundColor: colors.accentTint,
    color: colors.ink,
    boxShadow: {
      default: `inset 0 0 0 2px ${colors.accent}`,
      ":hover": `inset 0 0 0 2px ${colors.accent}`,
      ":focus-within": effects.focusRing,
    },
  },
  input: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    opacity: 0,
    pointerEvents: "none",
  },
  disabled: {
    opacity: 0.45,
  },
});
