import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, fonts, space } from "../styles/tokens.stylex";
import { getTextTitle } from "./textTitle";

const COMPACT = "@media (max-width: 639px)";
const PHONE = "@media (max-width: 480px)";

export type PeatedIdProps = {
  detail?: ReactNode;
  id: string;
};

export function PeatedId({ detail, id }: PeatedIdProps) {
  return (
    <div {...stylex.props(foundationStyles.metadata, styles.idStamp)}>
      <span {...stylex.props(styles.idLabel)}>Peated ID</span>
      <span {...stylex.props(styles.idValue)}>{id}</span>
      {detail ? (
        <span title={getTextTitle(detail)} {...stylex.props(styles.idDetail)}>
          {detail}
        </span>
      ) : null}
    </div>
  );
}

export type KeyFact = {
  label: string;
  /** Marks a value made of words, such as a series name, which uses smaller type on phones so more of it fits. */
  text?: boolean;
  value?: number | string | null;
};

function hasKeyFactValue(fact: KeyFact) {
  return fact.value !== null && fact.value !== undefined && fact.value !== "";
}

export function hasVisibleKeyFacts(facts: readonly KeyFact[]) {
  return facts.some(hasKeyFactValue);
}

/** Facts sized to their content and wrapped in one row, as in a page header. */
export function KeyFacts({ facts }: { facts: readonly KeyFact[] }) {
  const visibleFacts = facts.filter(hasKeyFactValue);

  if (!visibleFacts.length) return null;

  return (
    <dl {...stylex.props(styles.keyFacts)}>
      {visibleFacts.map((fact, index) => (
        <div
          data-key-fact={index + 1}
          key={`${fact.label}-${index}`}
          {...stylex.props(styles.keyFact)}
        >
          <dt
            title={fact.label}
            {...stylex.props(foundationStyles.fieldLabel, styles.keyFactLabel)}
          >
            {fact.label}
          </dt>
          <dd
            title={String(fact.value)}
            {...stylex.props(
              styles.keyFactValue,
              fact.text && styles.keyFactValueText,
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
  idStamp: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    flexWrap: { default: "nowrap", [COMPACT]: "wrap" },
    columnGap: space.x3,
    color: colors.inkMuted,
  },
  idLabel: {
    flexShrink: 0,
  },
  idValue: {
    flexShrink: 0,
    color: colors.accentDeep,
  },
  idDetail: {
    minWidth: 0,
    width: { default: "auto", [COMPACT]: "100%" },
    marginLeft: 0,
    overflow: { default: "hidden", [COMPACT]: "visible" },
    textOverflow: { default: "ellipsis", [COMPACT]: "clip" },
    whiteSpace: { default: "nowrap", [COMPACT]: "normal" },
  },
  keyFacts: {
    display: "flex",
    flexWrap: "wrap",
    // Keeps labels on one line when a smaller text value shares the row.
    alignItems: { default: "flex-end", [PHONE]: "baseline" },
    width: "100%",
    minWidth: 0,
    columnGap: { default: space.x8, [PHONE]: space.x4 },
    rowGap: { default: space.x4, [PHONE]: space.x1 },
    margin: 0,
  },
  keyFact: {
    boxSizing: "border-box",
    minWidth: 0,
    flex: "0 1 auto",
    display: "flex",
    // DESIGN.md: phones show each fact on one line, value then label, so the
    // header leaves room for the page below it.
    flexDirection: { default: "column", [PHONE]: "row" },
    alignItems: { default: "stretch", [PHONE]: "baseline" },
    columnGap: "6px",
  },
  keyFactLabel: {
    order: 2,
    marginTop: { default: "6px", [PHONE]: 0 },
    overflow: "hidden",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  keyFactValue: {
    order: 1,
    overflow: "hidden",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: { default: "28px", [PHONE]: "18px" },
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  keyFactValueText: {
    fontSize: { default: "28px", [PHONE]: "18px" },
  },
});
