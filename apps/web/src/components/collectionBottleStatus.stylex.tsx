"use client";

import * as stylex from "@stylexjs/stylex";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
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

export function CollectionBottleStatusChips({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (status: CollectionBottleStatus) => void;
  value?: CollectionBottleStatusValue;
}) {
  return (
    <div
      aria-label="Bottle status"
      role="group"
      {...stylex.props(styles.group)}
    >
      {COLLECTION_BOTTLE_STATUS_VALUES.map((status) => {
        const selected = value === status;

        return (
          <button
            aria-pressed={selected}
            disabled={disabled || selected}
            key={status}
            onClick={() => onChange(status)}
            type="button"
            {...stylex.props(
              styles.chip,
              selected && styles.selected,
              disabled && !selected && styles.disabled,
            )}
          >
            {statusLabels[status]}
          </button>
        );
      })}
    </div>
  );
}

const styles = stylex.create({
  group: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: space.x1,
    flexWrap: "wrap",
  },
  chip: {
    boxSizing: "border-box",
    display: "inline-flex",
    height: "28px",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: space.x2,
    paddingLeft: space.x2,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.surface,
    },
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1,
    cursor: {
      default: "pointer",
      ":disabled": "default",
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    transitionProperty: "background-color, border-color, color, opacity",
    transitionDuration: "120ms",
  },
  selected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    color: colors.ground,
  },
  disabled: {
    opacity: 0.45,
  },
});
