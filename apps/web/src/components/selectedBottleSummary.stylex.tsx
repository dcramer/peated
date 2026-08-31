import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../styles/tokens.stylex";
import { BottleVisual } from "./bottleIdentityRow.stylex";
import { Button } from "./button.stylex";

export type SelectedBottleSummaryProps = {
  bottleId: string;
  imageUrl?: string | null;
  metadata: string;
  name: string;
  /** Shows a change action when the owning workflow allows bottle selection. */
  onChange?: () => void;
};

/** Keeps the selected bottle visible while a member completes a related form. */
export function SelectedBottleSummary({
  bottleId,
  imageUrl,
  metadata,
  name,
  onChange,
}: SelectedBottleSummaryProps) {
  return (
    <section aria-label="Selected bottle" {...stylex.props(styles.summary)}>
      <BottleVisual imageUrl={imageUrl} label={`${name} bottle`} size="sm" />
      <div {...stylex.props(styles.copy)}>
        <strong title={name} {...stylex.props(styles.name)}>
          {name}
        </strong>
        <span
          title={`${bottleId} · ${metadata}`}
          {...stylex.props(styles.metadata)}
        >
          {bottleId} · {metadata}
        </span>
      </div>
      {onChange ? (
        <Button onClick={onChange} size="sm" variant="text">
          Change bottle
        </Button>
      ) : null}
    </section>
  );
}

const styles = stylex.create({
  summary: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    paddingTop: space.x3,
    paddingRight: 0,
    paddingBottom: space.x3,
    paddingLeft: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
    backgroundColor: "transparent",
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    rowGap: space.x1,
  },
  name: {
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.25,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metadata: {
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
