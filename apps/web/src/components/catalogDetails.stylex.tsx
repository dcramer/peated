import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, fonts, space } from "../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";
const PHONE = "@media (max-width: 480px)";

export type PeatedIdProps = {
  detail?: ReactNode;
  id: string;
};

export function PeatedId({ detail, id }: PeatedIdProps) {
  return (
    <div {...stylex.props(styles.idStamp)}>
      <span {...stylex.props(styles.idLabel)}>Peated ID</span>
      <span {...stylex.props(styles.idValue)}>{id}</span>
      <span aria-hidden="true" {...stylex.props(styles.idRule)} />
      {detail ? <span {...stylex.props(styles.idDetail)}>{detail}</span> : null}
    </div>
  );
}

export type KeyFact = {
  label: string;
  value?: number | string | null;
};

export type KeyFactList =
  | readonly [KeyFact]
  | readonly [KeyFact, KeyFact]
  | readonly [KeyFact, KeyFact, KeyFact]
  | readonly [KeyFact, KeyFact, KeyFact, KeyFact];

function hasKeyFactValue(fact: KeyFact) {
  return fact.value !== null && fact.value !== undefined && fact.value !== "";
}

export function hasVisibleKeyFacts(facts: KeyFactList) {
  return facts.some(hasKeyFactValue);
}

export function KeyFacts({ facts }: { facts: KeyFactList }) {
  const visibleFacts = facts.filter(hasKeyFactValue);

  if (!visibleFacts.length) return null;

  return (
    <dl
      {...stylex.props(
        styles.keyFacts,
        getKeyFactsColumnStyle(visibleFacts.length),
      )}
    >
      {visibleFacts.map((fact, index) => (
        <div
          data-key-fact={index + 1}
          key={`${fact.label}-${index}`}
          {...stylex.props(
            styles.keyFact,
            visibleFacts.length >= 3 &&
              index % 2 === 0 &&
              styles.keyFactPhoneOdd,
            visibleFacts.length >= 3 &&
              index % 2 === 1 &&
              styles.keyFactPhoneEven,
          )}
        >
          <dt {...stylex.props(styles.keyFactLabel)}>{fact.label}</dt>
          <dd {...stylex.props(styles.keyFactValue)}>{fact.value}</dd>
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
    fontFamily: fonts.reading,
    fontSize: "13px",
    letterSpacing: 0,
    lineHeight: 1.4,
  },
  idLabel: {
    flexShrink: 0,
  },
  idValue: {
    flexShrink: 0,
    color: colors.accentDeep,
  },
  idRule: {
    minWidth: space.x3,
    height: "1px",
    flex: 1,
    backgroundColor: colors.hairline,
  },
  idDetail: {
    minWidth: 0,
    width: { default: "auto", [COMPACT]: "100%" },
    overflow: { default: "hidden", [COMPACT]: "visible" },
    textOverflow: { default: "ellipsis", [COMPACT]: "clip" },
    whiteSpace: { default: "nowrap", [COMPACT]: "normal" },
  },
  keyFacts: {
    display: "grid",
    width: "100%",
    minWidth: 0,
    gap: "6px",
    margin: 0,
    paddingTop: "20px",
    paddingBottom: "20px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  keyFactsOne: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  keyFactsTwo: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  keyFactsThree: {
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      [PHONE]: "repeat(2, minmax(0, 1fr))",
    },
  },
  keyFactsFour: {
    gridTemplateColumns: {
      default: "repeat(4, minmax(0, 1fr))",
      [PHONE]: "repeat(2, minmax(0, 1fr))",
    },
  },
  keyFact: {
    boxSizing: "border-box",
    minWidth: 0,
    flex: "1 1 0",
    display: "flex",
    flexDirection: "column",
    paddingRight: space.x6,
    paddingLeft: space.x6,
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
    ":first-child": { paddingLeft: 0, borderLeftWidth: 0 },
  },
  keyFactPhoneOdd: {
    paddingLeft: { default: null, [PHONE]: 0 },
    borderLeftWidth: { default: null, [PHONE]: 0 },
  },
  keyFactPhoneEven: {
    paddingLeft: { default: null, [PHONE]: space.x6 },
    borderLeftWidth: { default: null, [PHONE]: "1px" },
  },
  keyFactLabel: {
    order: 2,
    marginTop: "6px",
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    letterSpacing: 0,
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  keyFactValue: {
    order: 1,
    overflow: "hidden",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "28px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const keyFactsColumnStyles = {
  1: styles.keyFactsOne,
  2: styles.keyFactsTwo,
  3: styles.keyFactsThree,
  4: styles.keyFactsFour,
} satisfies Record<KeyFactList["length"], stylex.StyleXStyles>;

function getKeyFactsColumnStyle(factCount: number) {
  if (factCount === 1) return keyFactsColumnStyles[1];
  if (factCount === 2) return keyFactsColumnStyles[2];
  if (factCount === 3) return keyFactsColumnStyles[3];
  return keyFactsColumnStyles[4];
}
