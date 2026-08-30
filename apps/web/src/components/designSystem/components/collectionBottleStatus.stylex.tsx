"use client";

import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

export const COLLECTION_BOTTLE_STATUS_VALUES = [
  "sealed",
  "open",
  "empty",
] as const;

export type CollectionBottleStatus =
  (typeof COLLECTION_BOTTLE_STATUS_VALUES)[number];

export type CollectionBottleStatusValue = CollectionBottleStatus | null;

const statusLabels = {
  sealed: "Sealed",
  open: "Open",
  empty: "Empty",
} satisfies Record<CollectionBottleStatus, string>;

export function getCollectionBottleStatusLabel(
  status: CollectionBottleStatusValue | undefined,
) {
  return status ? statusLabels[status] : "Not set";
}

export function CollectionBottleStatusLabel({
  status,
}: {
  status?: CollectionBottleStatusValue;
}) {
  if (!status) return null;

  return (
    <span {...stylex.props(foundationStyles.body, styles.label)}>
      {statusLabels[status]}
    </span>
  );
}

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
  label: {
    display: "inline-flex",
    alignItems: "center",
    color: colors.inkMuted,
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
      default: colors.surface,
      ":hover": colors.inset,
      ":active": colors.accentTint,
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
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
  },
  disabled: {
    opacity: 0.45,
  },
});
