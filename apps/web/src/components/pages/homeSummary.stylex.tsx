import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import {
  CountChip,
  TastingRatingDistribution,
  type TastingRatingCounts,
} from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";

export type HomeMemberFact = {
  label: string;
  value: number;
};

export type HomeMemberSummaryProps = {
  facts: readonly [HomeMemberFact, HomeMemberFact, HomeMemberFact];
  bands: TastingRatingCounts;
  totalTastings: number;
};

/** Summarizes the signed-in member's existing tasting and collection record. */
export function HomeMemberSummary({
  facts,
  bands,
  totalTastings,
}: HomeMemberSummaryProps) {
  return (
    <section
      aria-labelledby="member-record-heading"
      {...stylex.props(styles.widget)}
    >
      <div {...stylex.props(styles.widgetHeading)}>
        <SectionHeading id="member-record-heading">Your record</SectionHeading>
        <CountChip count={totalTastings} />
      </div>
      <div {...stylex.props(styles.recordPanel)}>
        <div {...stylex.props(styles.recordTotal)}>
          <strong {...stylex.props(styles.recordTotalValue)}>
            {totalTastings.toLocaleString("en-US")}
          </strong>
          <span
            {...stylex.props(
              foundationStyles.metadata,
              styles.recordTotalLabel,
            )}
          >
            tastings you've recorded
          </span>
        </div>
        <div {...stylex.props(styles.recordDistribution)}>
          <TastingRatingDistribution counts={bands} showCounts />
        </div>
        <dl {...stylex.props(styles.recordFacts)}>
          {facts.map((fact) => (
            <div key={fact.label} {...stylex.props(styles.recordFact)}>
              <dd {...stylex.props(styles.recordFactValue)}>
                {fact.value.toLocaleString("en-US")}
              </dd>
              <dt
                title={fact.label}
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.recordFactLabel,
                )}
              >
                {fact.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function HomeSectionLoading({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" {...stylex.props(styles.loading)}>
      {children}
    </div>
  );
}

const styles = stylex.create({
  widget: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x3,
  },
  widgetHeading: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  recordPanel: {
    paddingTop: "22px",
    paddingBottom: "22px",
    backgroundColor: "transparent",
  },
  recordTotal: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
  },
  recordTotalValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "34px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  recordTotalLabel: {
    color: colors.inkMuted,
  },
  recordDistribution: {
    marginTop: space.x4,
  },
  recordFacts: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: space.x3,
    margin: 0,
    marginTop: space.x4,
    padding: 0,
  },
  recordFact: {
    minWidth: 0,
  },
  recordFactValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  recordFactLabel: {
    overflow: "hidden",
    marginTop: "2px",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  loading: {
    minHeight: "240px",
  },
});
