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
import CountryMapIcon from "../../countryMapIcon";
import {
  Card,
  CardActionLink,
  CardLink,
  CardPrimaryLink,
  ItemList,
  ItemRow,
  RatingMeasure,
  type BandCounts,
} from "../components";

const COMPACT = "@media (max-width: 639px)";
const NARROW = "@media (max-width: 899px)";

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
  scoreCount: number;
  scoreHigh?: number | null;
  scoreLow?: number | null;
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
        <ItemList ariaLabel="Highest rated bottles">
          {bottles.map((bottle) => (
            <ItemRow
              end={
                <RatingMeasure
                  counts={bottle.bandCounts}
                  high={bottle.scoreHigh}
                  low={bottle.scoreLow}
                  median={bottle.score}
                  scoreCount={bottle.scoreCount}
                />
              }
              href={bottle.href}
              key={bottle.href}
              metadata={bottle.metadata.join(" · ")}
              title={bottle.name}
            />
          ))}
        </ItemList>
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
        <ItemList ariaLabel="Newest critic reviews">
          {reviews.map((review) => (
            <ItemRow
              end={
                <span {...stylex.props(styles.reviewFacts)}>
                  {review.rating !== null && review.rating !== undefined ? (
                    <strong {...stylex.props(styles.reviewRating)}>
                      {review.rating}
                    </strong>
                  ) : null}
                  <span {...stylex.props(styles.rowDate)}>{review.date}</span>
                </span>
              }
              href={review.bottleHref}
              key={review.id}
              metadata={
                <a
                  href={review.sourceHref}
                  rel="noreferrer"
                  target="_blank"
                  {...stylex.props(styles.sourceLink)}
                >
                  {review.source}
                </a>
              }
              title={review.bottleName}
            />
          ))}
        </ItemList>
      </div>
    </section>
  );
}

export type HomeOrigin = {
  description?: string;
  href: string;
  name: string;
  slug: string;
  totalBottles: number;
};

const REGION_DESCRIPTION_MAX_LENGTH = 80;

function truncateRegionDescription(description: string) {
  const normalized = description.trim().replace(/\s+/g, " ");

  if (normalized.length <= REGION_DESCRIPTION_MAX_LENGTH) {
    return { text: normalized, truncated: false };
  }

  const wordBoundary = normalized
    .slice(0, REGION_DESCRIPTION_MAX_LENGTH + 1)
    .lastIndexOf(" ");
  const cutoff =
    wordBoundary > 0 ? wordBoundary : REGION_DESCRIPTION_MAX_LENGTH;

  return {
    text: `${normalized.slice(0, cutoff).trimEnd()}…`,
    truncated: true,
  };
}

function RegionCard({ region }: { region: HomeOrigin }) {
  const description = region.description
    ? truncateRegionDescription(region.description)
    : null;

  return (
    <Card
      appearance="surface"
      linked
      padding="none"
      {...stylex.props(styles.region)}
    >
      <span {...stylex.props(styles.regionLine)}>
        <CardPrimaryLink href={region.href}>
          <strong {...stylex.props(styles.regionName)}>{region.name}</strong>
        </CardPrimaryLink>
        <span {...stylex.props(styles.regionFacts)}>
          {region.totalBottles.toLocaleString("en-US")}
        </span>
      </span>
      {description ? (
        <>
          <span {...stylex.props(styles.regionDescription)}>
            {description.text}
          </span>
          {description.truncated ? (
            <CardActionLink
              href={region.href}
              {...stylex.props(styles.regionMore)}
            >
              Read more <span aria-hidden="true">→</span>
            </CardActionLink>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

export function HomeOrigins({
  countries,
  remainingCountries,
  regions,
}: {
  countries: readonly HomeOrigin[];
  remainingCountries?: { count: number; totalBottles: number };
  regions: readonly HomeOrigin[];
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeModuleHeading
        action={
          <Link href="/locations" {...stylex.props(styles.moreLink)}>
            Open the map <span aria-hidden="true">→</span>
          </Link>
        }
        title="Browse by origin"
      />
      <p {...stylex.props(styles.originIntro)}>
        Mostly Scotch, a good deal of American, and a growing amount of
        everything else.
      </p>
      <div {...stylex.props(styles.countryGrid)}>
        {countries.map((country) => (
          <CardLink
            appearance="surface"
            href={country.href}
            key={country.href}
            padding="none"
            {...stylex.props(styles.country)}
          >
            <span aria-hidden="true" {...stylex.props(styles.countryMap)}>
              <CountryMapIcon
                slug={country.slug}
                {...stylex.props(styles.countryMapSvg)}
              />
            </span>
            <span {...stylex.props(styles.countryHeading)}>
              <strong {...stylex.props(styles.countryName)}>
                {country.name}
              </strong>
            </span>
            <span {...stylex.props(styles.countryCount)}>
              {country.totalBottles.toLocaleString("en-US")} bottles
            </span>
          </CardLink>
        ))}
        {remainingCountries && remainingCountries.count > 0 ? (
          <CardLink
            appearance="surface"
            href="/locations"
            padding="none"
            {...stylex.props(styles.country)}
          >
            <span
              aria-hidden="true"
              {...stylex.props(styles.countryMap, styles.remainingMap)}
            >
              +{remainingCountries.count}
            </span>
            <span {...stylex.props(styles.countryHeading)}>
              <strong {...stylex.props(styles.countryName)}>
                Everywhere else
              </strong>
            </span>
            <span {...stylex.props(styles.countryCount)}>
              {remainingCountries.totalBottles.toLocaleString("en-US")} bottles
            </span>
          </CardLink>
        ) : null}
      </div>
      {regions.length ? (
        <>
          <div {...stylex.props(styles.regionHeading)}>By region</div>
          <div {...stylex.props(styles.regionGrid)}>
            {regions.map((region) => (
              <RegionCard key={region.href} region={region} />
            ))}
          </div>
        </>
      ) : null}
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
        <ItemList ariaLabel="Most recorded distilleries">
          {distilleries.map((distillery) => (
            <ItemRow
              href={distillery.href}
              key={distillery.href}
              metadata={
                <>
                  {distillery.location ? `${distillery.location} · ` : null}
                  {distillery.totalBottles.toLocaleString("en-US")} bottlings
                </>
              }
              title={distillery.name}
            />
          ))}
        </ItemList>
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
        <ItemList ariaLabel="Bottles added this week" variant="surface">
          {bottles.map((bottle) => (
            <ItemRow
              href={bottle.href}
              key={bottle.href}
              metadata={bottle.metadata.join(" · ")}
              size="sm"
              title={bottle.name}
              variant="surface"
            />
          ))}
        </ItemList>
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
  sourceLink: {
    position: "relative",
    zIndex: 2,
    width: "fit-content",
    maxWidth: "100%",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
  },
  reviewFacts: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
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
  originIntro: {
    maxWidth: "640px",
    marginTop: space.x2,
    marginBottom: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.5,
  },
  regionHeading: {
    marginTop: space.x6,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.4,
    textTransform: "uppercase",
  },
  regionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginTop: space.x2,
    [NARROW]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  region: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    padding: space.x3,
    color: colors.ink,
    textDecoration: "none",
  },
  regionName: {
    display: "block",
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  regionLine: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x2,
  },
  regionFacts: {
    display: "block",
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
  regionDescription: {
    display: "block",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
    textWrap: "pretty",
  },
  regionMore: {
    width: "fit-content",
    marginTop: space.x2,
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
  },
  countryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginTop: space.x4,
    [NARROW]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [COMPACT]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  country: {
    display: "flex",
    minWidth: 0,
    minHeight: "188px",
    flexDirection: "column",
    justifyContent: "flex-end",
    padding: "18px",
    color: colors.ink,
    textDecoration: "none",
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
    display: "block",
    flexShrink: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
  },
  countryMap: {
    display: "flex",
    width: "100%",
    minHeight: 0,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: space.x2,
    paddingRight: space.x3,
    paddingBottom: space.x4,
    paddingLeft: space.x3,
    color: colors.inkMuted,
  },
  countryMapSvg: {
    width: "100%",
    maxWidth: "132px",
    height: "76px",
  },
  remainingMap: {
    fontFamily: fonts.display,
    fontSize: "42px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
  },
  distilleries: {
    marginTop: "14px",
  },
  moreLink: {
    display: "inline-block",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.accent,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
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
