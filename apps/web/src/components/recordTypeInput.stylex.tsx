"use client";

import * as stylex from "@stylexjs/stylex";

import { colors, effects, fonts, space } from "../styles/tokens.stylex";

export type RecordType = "tasting" | "review";

export function RecordTypeInput({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: RecordType) => void;
  value: RecordType;
}) {
  return (
    <div
      aria-label="Record type"
      role="radiogroup"
      {...stylex.props(styles.tabs)}
    >
      {(["tasting", "review"] as const).map((recordType) => {
        const checked = recordType === value;
        return (
          <label
            key={recordType}
            {...stylex.props(
              styles.tab,
              checked && styles.selectedTab,
              disabled && styles.disabledTab,
            )}
          >
            <input
              checked={checked}
              disabled={disabled}
              name="record-type"
              onChange={() => onChange(recordType)}
              type="radio"
              value={recordType}
              {...stylex.props(styles.visuallyHiddenInput)}
            />
            {recordType === "tasting" ? "Tasting" : "Review"}
          </label>
        );
      })}
    </div>
  );
}

const styles = stylex.create({
  tabs: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    columnGap: space.x6,
    paddingRight: space.x1,
    paddingLeft: space.x1,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  tab: {
    display: "inline-flex",
    minHeight: "40px",
    flexShrink: 0,
    alignItems: "center",
    color: { default: colors.inkMuted, ":hover": colors.ink },
    fontFamily: fonts.reading,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.2,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  selectedTab: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontWeight: 700,
    boxShadow: {
      default: `inset 0 -2px 0 ${colors.ink}`,
      ":focus-within": `inset 0 -2px 0 ${colors.ink}`,
    },
  },
  disabledTab: { cursor: "not-allowed", opacity: 0.45 },
  visuallyHiddenInput: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    opacity: 0,
    pointerEvents: "none",
  },
});
