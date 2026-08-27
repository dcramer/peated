import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../../../styles/tokens.stylex";

export type FactListItem = {
  label: string;
  value?: ReactNode;
};

export type FactListProps = {
  facts: readonly [FactListItem, ...FactListItem[]];
};

/** Presents supplied label facts without inferring values for missing data. */
export function FactList({ facts }: FactListProps) {
  return (
    <dl {...stylex.props(styles.list)}>
      {facts.map((fact) => (
        <div key={fact.label} {...stylex.props(styles.row)}>
          <dt {...stylex.props(styles.label)}>{fact.label}</dt>
          <dd {...stylex.props(styles.value)}>{fact.value ?? "Not stated"}</dd>
        </div>
      ))}
    </dl>
  );
}

const styles = stylex.create({
  list: {
    margin: 0,
    padding: 0,
  },
  row: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: space.x3,
    paddingTop: "9px",
    paddingBottom: "9px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  label: {
    width: "82px",
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  value: {
    minWidth: 0,
    flex: 1,
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
});
