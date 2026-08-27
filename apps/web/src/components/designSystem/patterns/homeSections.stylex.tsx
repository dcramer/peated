import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  RecordId,
  SectionHeading,
  SpecStrip,
  SummaryStrip,
  type SpecStripCells,
  type SummaryStripCells,
} from "../components";

const NARROW = "@media (max-width: 759px)";

export type PublicHomeIntroProps = {
  description: ReactNode;
  eyebrow?: ReactNode;
  facts?: SummaryStripCells;
  primaryAction: ReactNode;
  secondaryAction: ReactNode;
  title: ReactNode;
};

/** Introduces Peated and shows caller-supplied platform facts. */
export function PublicHomeIntro({
  description,
  eyebrow,
  facts,
  primaryAction,
  secondaryAction,
  title,
}: PublicHomeIntroProps) {
  return (
    <section {...stylex.props(styles.hero)}>
      {eyebrow ? <div {...stylex.props(styles.eyebrow)}>{eyebrow}</div> : null}
      <h1 {...stylex.props(styles.heroTitle)}>{title}</h1>
      <div {...stylex.props(styles.heroCopy)}>{description}</div>
      <div {...stylex.props(styles.heroActions)}>
        {primaryAction}
        {secondaryAction}
      </div>
      {facts ? (
        <div {...stylex.props(styles.heroFacts)}>
          <SummaryStrip cells={facts} />
        </div>
      ) : null}
    </section>
  );
}

export type HomeDatabaseOverviewProps = {
  principles: readonly [string, string, string];
  record: {
    description: ReactNode;
    detail: string;
    id: string;
    specs: SpecStripCells;
    title: ReactNode;
  };
};

/** Explains a Peated bottle record with a representative component composition. */
export function HomeDatabaseOverview({
  principles,
  record,
}: HomeDatabaseOverviewProps) {
  return (
    <section {...stylex.props(styles.overview)}>
      <div {...stylex.props(styles.overviewColumn)}>
        <SectionHeading>What a bottle page holds</SectionHeading>
        <div {...stylex.props(styles.recordPreview)}>
          <RecordId detail={record.detail} id={record.id} />
          <h3 {...stylex.props(styles.recordTitle)}>{record.title}</h3>
          <div {...stylex.props(styles.recordSpecs)}>
            <SpecStrip cells={record.specs} />
          </div>
          <div {...stylex.props(styles.recordDescription)}>
            {record.description}
          </div>
        </div>
      </div>
      <div {...stylex.props(styles.overviewColumn)}>
        <SectionHeading>How it stays complete</SectionHeading>
        <ul {...stylex.props(styles.principles)}>
          {principles.map((principle) => (
            <li key={principle} {...stylex.props(styles.principle)}>
              {principle}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const styles = stylex.create({
  hero: {
    paddingTop: space.x6,
    paddingBottom: space.x12,
    [NARROW]: {
      paddingTop: space.x4,
      paddingBottom: space.x8,
    },
  },
  eyebrow: {
    marginBottom: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  heroTitle: {
    maxWidth: "760px",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "clamp(40px, 5vw, 44px)",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1.02,
  },
  heroCopy: {
    maxWidth: "620px",
    marginTop: "18px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "17px",
    lineHeight: 1.55,
  },
  heroActions: {
    display: "flex",
    gap: "10px",
    marginTop: "22px",
    flexWrap: "wrap",
  },
  heroFacts: {
    marginTop: space.x12,
  },
  overview: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 336px",
    gap: space.x8,
    alignItems: "start",
    paddingBottom: space.x12,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  overviewColumn: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: "14px",
  },
  recordPreview: {
    paddingTop: "22px",
    paddingRight: space.x6,
    paddingBottom: "22px",
    paddingLeft: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  recordTitle: {
    margin: 0,
    marginTop: space.x3,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "34px",
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1.04,
  },
  recordSpecs: {
    marginTop: space.x3,
  },
  recordDescription: {
    maxWidth: "540px",
    marginTop: "14px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  principles: {
    margin: 0,
    paddingTop: space.x2,
    paddingRight: space.x6,
    paddingBottom: space.x2,
    paddingLeft: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    listStyle: "none",
  },
  principle: {
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
});
