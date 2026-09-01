import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../styles/tokens.stylex";

export type FactListItem = {
  label: string;
  value?: ReactNode;
};

export type FactListProps = {
  facts: readonly [FactListItem, ...FactListItem[]];
  layout?: "grid" | "list";
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
export function FactList({ facts, layout = "list" }: FactListProps) {
  const visibleFacts = facts.filter((fact) => hasFactValue(fact.value));

  if (!visibleFacts.length) return null;

  return (
    <dl {...stylex.props(styles.list, layout === "grid" && styles.grid)}>
      {visibleFacts.map((fact) => (
        <div
          key={fact.label}
          {...stylex.props(styles.row, layout === "grid" && styles.gridItem)}
        >
          <dt
            {...stylex.props(
              styles.label,
              layout === "grid" && styles.gridLabel,
            )}
          >
            {fact.label}
          </dt>
          <dd
            {...stylex.props(
              styles.value,
              layout === "grid" && styles.gridValue,
            )}
          >
            {fact.value}
          </dd>
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
  grid: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(auto-fit, minmax(160px, 1fr))",
      "@media (max-width: 559px)": "minmax(0, 1fr)",
    },
    gap: space.x4,
    paddingTop: space.x4,
    paddingBottom: space.x4,
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
  gridItem: {
    display: "block",
    paddingTop: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  label: {
    width: "100px",
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    letterSpacing: 0,
    lineHeight: 1.4,
  },
  gridLabel: {
    width: "auto",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.04em",
    lineHeight: 1.3,
  },
  value: {
    minWidth: 0,
    flex: 1,
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  gridValue: {
    marginTop: space.x1,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1.35,
  },
});
