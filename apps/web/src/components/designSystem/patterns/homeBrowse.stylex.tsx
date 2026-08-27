import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";

function HomeModuleHeading({
  detail,
  title,
}: {
  detail?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.heading)}>
      <h2 {...stylex.props(styles.title)}>{title}</h2>
      {detail ? <div {...stylex.props(styles.detail)}>{detail}</div> : null}
    </div>
  );
}

export type HomeReview = {
  bottleHref: string;
  bottleName: string;
  date: ReactNode;
  id: string;
  score?: string;
  source: string;
  sourceHref: string;
};

/** Shows recent attributed critic scores without converting their native scales. */
export function HomeRecentReviews({
  reviews,
}: {
  reviews: readonly HomeReview[];
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        detail="Scores stay on each source's original scale"
        title="Latest critic reviews"
      />
      <div {...stylex.props(styles.rows)}>
        {reviews.map((review) => (
          <article key={review.id} {...stylex.props(styles.row)}>
            <div {...stylex.props(styles.rowCopy)}>
              <a href={review.bottleHref} {...stylex.props(styles.rowTitle)}>
                {review.bottleName}
              </a>
              <a
                href={review.sourceHref}
                rel="noreferrer"
                target="_blank"
                {...stylex.props(styles.rowMetadata, styles.sourceLink)}
              >
                {review.source}
              </a>
            </div>
            {review.score ? (
              <strong {...stylex.props(styles.reviewScore)}>
                {review.score}
              </strong>
            ) : null}
            <span {...stylex.props(styles.rowDate)}>{review.date}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export type HomeRegion = {
  description?: ReactNode;
  href: string;
  name: string;
  totalBottles: number;
  totalDistilleries: number;
};

export function HomeRegions({ regions }: { regions: readonly HomeRegion[] }) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading title="Browse by region" />
      <div {...stylex.props(styles.regionGrid)}>
        {regions.map((region) => (
          <a
            href={region.href}
            key={region.href}
            {...stylex.props(styles.region)}
          >
            <strong {...stylex.props(styles.regionName)}>{region.name}</strong>
            <span {...stylex.props(styles.regionFacts)}>
              {region.totalBottles.toLocaleString("en-US")} bottlings
              <span aria-hidden="true"> · </span>
              {region.totalDistilleries.toLocaleString("en-US")} distiller
              {region.totalDistilleries === 1 ? "y" : "ies"}
            </span>
            {region.description ? (
              <span {...stylex.props(styles.regionDescription)}>
                {region.description}
              </span>
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}

export type HomeDistillery = {
  href: string;
  name: string;
  totalBottles: number;
};

export function HomeDistilleries({
  distilleries,
  links,
}: {
  distilleries: readonly HomeDistillery[];
  links: readonly { href: string; label: string }[];
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading title="Distilleries with the most bottlings" />
      <div {...stylex.props(styles.distilleries)}>
        {distilleries.map((distillery) => (
          <a
            href={distillery.href}
            key={distillery.href}
            {...stylex.props(styles.distillery)}
          >
            <strong {...stylex.props(styles.distilleryName)}>
              {distillery.name}
            </strong>
            <span {...stylex.props(styles.distilleryCount)}>
              {distillery.totalBottles.toLocaleString("en-US")}
            </span>
          </a>
        ))}
      </div>
      <div {...stylex.props(styles.directoryLinks)}>
        {links.map((link, index) => (
          <span key={link.href} {...stylex.props(styles.directoryLinkItem)}>
            {index > 0 ? (
              <span aria-hidden="true" {...stylex.props(styles.separator)}>
                ·
              </span>
            ) : null}
            <a href={link.href} {...stylex.props(styles.moreLink)}>
              {link.label} <span aria-hidden="true">→</span>
            </a>
          </span>
        ))}
      </div>
    </section>
  );
}

export type HomeRecentBottle = {
  href: string;
  metadata: readonly string[];
  name: string;
};

export function HomeRecentBottles({
  bottles,
  totalBottles,
}: {
  bottles: readonly HomeRecentBottle[];
  totalBottles?: number;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        detail={
          totalBottles === undefined
            ? "Add what's missing"
            : `${totalBottles.toLocaleString("en-US")} records · add what's missing`
        }
        title="Recently added"
      />
      <div {...stylex.props(styles.recentBottles)}>
        {bottles.map((bottle) => (
          <a
            href={bottle.href}
            key={bottle.href}
            {...stylex.props(styles.recentBottle)}
          >
            <strong {...stylex.props(styles.recentBottleName)}>
              {bottle.name}
            </strong>
            {bottle.metadata.length ? (
              <span {...stylex.props(styles.rowMetadata)}>
                {bottle.metadata.join(" · ")}
              </span>
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}

export function HomeContributionPrompt({
  primaryAction,
  secondaryAction,
}: {
  primaryAction: ReactNode;
  secondaryAction: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.prompt)}>
      <h2 {...stylex.props(styles.promptTitle)}>Missing a bottling?</h2>
      <p {...stylex.props(styles.promptCopy)}>
        Record what the label tells you: cask, vintage, strength, and finish.
      </p>
      <div {...stylex.props(styles.promptActions)}>
        {primaryAction}
        {secondaryAction}
      </div>
    </section>
  );
}

export type HomeQuestion = {
  answer: ReactNode;
  question: string;
};

export function HomeQuestions({
  questions,
}: {
  questions: readonly HomeQuestion[];
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading title="Common questions" />
      <div {...stylex.props(styles.questionGrid)}>
        {questions.map((question) => (
          <article key={question.question} {...stylex.props(styles.question)}>
            <h3 {...stylex.props(styles.questionTitle)}>{question.question}</h3>
            <div {...stylex.props(styles.questionAnswer)}>
              {question.answer}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const styles = stylex.create({
  section: {
    minWidth: 0,
    paddingTop: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  heading: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    flexDirection: "column",
    rowGap: space.x2,
  },
  title: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  detail: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.06em",
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
  rows: {
    marginTop: space.x2,
  },
  row: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: space.x3,
    paddingTop: "11px",
    paddingBottom: "11px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  rowCopy: {
    minWidth: 0,
    flex: 1,
  },
  rowTitle: {
    display: "block",
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  rowMetadata: {
    display: "block",
    overflow: "hidden",
    marginTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sourceLink: {
    width: "fit-content",
    maxWidth: "100%",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  reviewScore: {
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  rowDate: {
    width: "52px",
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.2,
    textAlign: "right",
    [COMPACT]: {
      display: "none",
    },
  },
  regionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "6px",
    marginTop: "14px",
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  region: {
    display: "block",
    minWidth: 0,
    paddingTop: space.x4,
    paddingRight: "18px",
    paddingBottom: space.x4,
    paddingLeft: "18px",
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.surface,
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  regionName: {
    display: "block",
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  regionFacts: {
    display: "block",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
  regionDescription: {
    display: "block",
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
    textWrap: "pretty",
  },
  distilleries: {
    marginTop: "14px",
  },
  distillery: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "baseline",
    gap: space.x3,
    paddingTop: "11px",
    paddingBottom: "11px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  distilleryName: {
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  distilleryCount: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.2,
  },
  moreLink: {
    display: "inline-block",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  directoryLinks: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px",
    marginTop: space.x3,
    flexWrap: "wrap",
  },
  directoryLinkItem: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: "6px",
  },
  separator: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
  },
  recentBottles: {
    marginTop: "10px",
    paddingRight: "18px",
    paddingLeft: "18px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  recentBottle: {
    display: "block",
    paddingTop: "11px",
    paddingBottom: "11px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  recentBottleName: {
    display: "block",
    fontFamily: fonts.display,
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  prompt: {
    padding: "18px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  promptTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  promptCopy: {
    margin: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  promptActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: space.x3,
    flexWrap: "wrap",
  },
  questionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "6px",
    marginTop: "14px",
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  question: {
    paddingTop: "18px",
    paddingRight: "20px",
    paddingBottom: "18px",
    paddingLeft: "20px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  questionTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  questionAnswer: {
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
    textWrap: "pretty",
  },
});
