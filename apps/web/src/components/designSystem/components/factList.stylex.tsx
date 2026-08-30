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

function hasFactValue(value: ReactNode) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    value !== false &&
    value !== true
  );
}

export function hasVisibleFacts(facts: readonly FactListItem[]) {
  return facts.some((fact) => hasFactValue(fact.value));
}

/** Presents supplied facts and omits facts that have no value. */
export function FactList({ facts }: FactListProps) {
  const visibleFacts = facts.filter((fact) => hasFactValue(fact.value));

  if (!visibleFacts.length) return null;

  return (
    <dl {...stylex.props(styles.list)}>
      {visibleFacts.map((fact) => (
        <div key={fact.label} {...stylex.props(styles.row)}>
          <dt {...stylex.props(styles.label)}>{fact.label}</dt>
          <dd {...stylex.props(styles.value)}>{fact.value}</dd>
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
    fontFamily: fonts.reading,
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
    fontFamily: fonts.reading,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
});
