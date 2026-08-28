import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { BandStack, type BandCounts } from "../components";

const COMPACT = "@media (max-width: 639px)";

function HomeModuleHeading({
  action,
  detail,
  title,
}: {
  action?: ReactNode;
  detail?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.heading)}>
      <div {...stylex.props(styles.headingLine)}>
        <h2 {...stylex.props(styles.title)}>{title}</h2>
        {action}
      </div>
      {detail ? <div {...stylex.props(styles.detail)}>{detail}</div> : null}
    </div>
  );
}

export type HomeRatedBottle = {
  bandCounts: BandCounts;
  href: string;
  metadata: readonly string[];
  name: string;
  score: number;
};

/** Shows bottles with published median scores in API rank order. */
export function HomeHighestRated({
  bottles,
  totalRated,
}: {
  bottles: readonly HomeRatedBottle[];
  totalRated: number;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        action={
          <Link
            href="/bottles?sort=-score&minScore=0"
            {...stylex.props(styles.moreLink)}
          >
            All {totalRated.toLocaleString("en-US")} rated{" "}
            <span aria-hidden="true">→</span>
          </Link>
        }
        title="Highest rated"
      />
      <div {...stylex.props(styles.rows)}>
        {bottles.map((bottle) => (
          <Link
            href={bottle.href}
            key={bottle.href}
            {...stylex.props(styles.row, styles.ratedRow)}
          >
            <span {...stylex.props(styles.rowCopy)}>
              <strong {...stylex.props(styles.ratedBottleName)}>
                {bottle.name}
              </strong>
              {bottle.metadata.length ? (
                <span {...stylex.props(styles.rowMetadata)}>
                  {bottle.metadata.join(" · ")}
                </span>
              ) : null}
            </span>
            <BandStack counts={bottle.bandCounts} variant="compact" />
            <strong {...stylex.props(styles.ratedScore)}>{bottle.score}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

export type HomeReview = {
  bottleHref: string;
  bottleName: string;
  date: ReactNode;
  id: string;
  rating?: number | null;
  source: string;
  sourceHref: string;
};

/** Shows recent attributed critic reviews. */
export function HomeRecentReviews({
  reviews,
}: {
  reviews: readonly HomeReview[];
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading title="Newest critic reviews" />
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
            {review.rating !== null && review.rating !== undefined ? (
              <strong {...stylex.props(styles.reviewRating)}>
                {review.rating}
              </strong>
            ) : null}
            <span {...stylex.props(styles.rowDate)}>{review.date}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export type HomeOrigin = {
  description?: ReactNode;
  href: string;
  name: string;
  totalBottles: number;
};

export function HomeOrigins({
  countries,
  regions,
  scotland,
  totalBottles,
}: {
  countries: readonly HomeOrigin[];
  regions: readonly HomeOrigin[];
  scotland?: { href: string; totalBottles: number };
  totalBottles?: number;
}) {
  const scotlandShare =
    scotland && totalBottles
      ? Math.round((scotland.totalBottles / totalBottles) * 100)
      : undefined;

  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        detail="Country first · regions only where the trade uses them"
        title="Browse by origin"
      />
      {scotland ? (
        <div {...stylex.props(styles.originPanel)}>
          <div {...stylex.props(styles.originHeader)}>
            <a href={scotland.href} {...stylex.props(styles.originName)}>
              Scotland
            </a>
            <span {...stylex.props(styles.originCount)}>
              {scotland.totalBottles.toLocaleString("en-US")} bottlings
              {scotlandShare === undefined
                ? null
                : ` · ${scotlandShare}% of the database`}
            </span>
          </div>
          <div {...stylex.props(styles.regionHeading)}>Whisky regions</div>
          <div {...stylex.props(styles.regionGrid)}>
            {regions.map((region) => (
              <a
                href={region.href}
                key={region.href}
                {...stylex.props(styles.region)}
              >
                <strong {...stylex.props(styles.regionName)}>
                  {region.name}
                </strong>
                <span {...stylex.props(styles.regionFacts)}>
                  {region.totalBottles.toLocaleString("en-US")} bottlings
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div {...stylex.props(styles.countryGrid)}>
        {countries.map((country) => (
          <a
            href={country.href}
            key={country.href}
            {...stylex.props(styles.country)}
          >
            <span {...stylex.props(styles.countryHeading)}>
              <strong {...stylex.props(styles.countryName)}>
                {country.name}
              </strong>
              <span {...stylex.props(styles.countryCount)}>
                {country.totalBottles.toLocaleString("en-US")}
              </span>
            </span>
            {country.description ? (
              <span {...stylex.props(styles.countryDescription)}>
                {country.description}
              </span>
            ) : null}
          </a>
        ))}
      </div>
      <div {...stylex.props(styles.originFooter)}>
        <Link href="/locations" {...stylex.props(styles.moreLink)}>
          All countries <span aria-hidden="true">→</span>
        </Link>
        <Link href="/locations" {...stylex.props(styles.moreLink)}>
          Map <span aria-hidden="true">→</span>
        </Link>
        <span {...stylex.props(styles.originNote)}>
          Countries are divided into whisky regions only where the trade uses
          them.
        </span>
      </div>
    </section>
  );
}

export type HomeDistillery = {
  href: string;
  location?: string;
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
      <HomeModuleHeading title="Most recorded distilleries" />
      <div {...stylex.props(styles.distilleries)}>
        {distilleries.map((distillery) => (
          <a
            href={distillery.href}
            key={distillery.href}
            {...stylex.props(styles.distillery)}
          >
            <span {...stylex.props(styles.distilleryCopy)}>
              <strong {...stylex.props(styles.distilleryName)}>
                {distillery.name}
              </strong>
              <span {...stylex.props(styles.distilleryMetadata)}>
                {distillery.location ? `${distillery.location} · ` : null}
                {distillery.totalBottles.toLocaleString("en-US")} bottlings
              </span>
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
            ? "Anyone can add one"
            : `${totalBottles.toLocaleString("en-US")} records · anyone can add one`
        }
        title="Added this week"
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
        Add it. Cask number, vintage, ABV, finish—as much as the label tells
        you.
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
  headingLine: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
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
  ratedRow: {
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.accentTint,
    },
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
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
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
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
  ratedBottleName: {
    display: "block",
    overflow: "hidden",
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ratedScore: {
    width: "32px",
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textAlign: "right",
  },
  sourceLink: {
    width: "fit-content",
    maxWidth: "100%",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  reviewRating: {
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  rowDate: {
    width: "72px",
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.2,
    textAlign: "right",
    whiteSpace: "nowrap",
    [COMPACT]: {
      display: "none",
    },
  },
  originPanel: {
    marginTop: "14px",
    padding: "18px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  originHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    [COMPACT]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: space.x1,
    },
  },
  originName: {
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  originCount: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
  regionHeading: {
    marginTop: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
  regionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
    marginTop: space.x2,
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  region: {
    display: "block",
    minWidth: 0,
    padding: space.x3,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: colors.inset,
      ":hover": colors.accentTint,
      ":active": colors.accentTint,
    },
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
    fontSize: "15px",
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
  countryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
    marginTop: "6px",
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  country: {
    display: "block",
    minWidth: 0,
    padding: "18px",
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: colors.surface,
      ":hover": colors.inset,
      ":active": colors.accentTint,
    },
    color: colors.ink,
    textDecoration: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  countryHeading: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x2,
  },
  countryName: {
    overflow: "hidden",
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  countryCount: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
  },
  countryDescription: {
    display: "-webkit-box",
    overflow: "hidden",
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  },
  originFooter: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x4,
    marginTop: space.x3,
    flexWrap: "wrap",
  },
  originNote: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "12px",
    lineHeight: 1.4,
  },
  distilleries: {
    marginTop: "14px",
  },
  distillery: {
    display: "block",
    minWidth: 0,
    paddingTop: "11px",
    paddingBottom: "11px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.accentTint,
    },
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
    display: "block",
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
  distilleryCopy: {
    display: "block",
    minWidth: 0,
  },
  distilleryMetadata: {
    display: "block",
    marginTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
  },
  moreLink: {
    display: "inline-block",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.accentDeep,
      ":hover": colors.accent,
      ":active": colors.ink,
    },
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
    backgroundColor: {
      default: "transparent",
      ":hover": colors.inset,
      ":active": colors.accentTint,
    },
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
