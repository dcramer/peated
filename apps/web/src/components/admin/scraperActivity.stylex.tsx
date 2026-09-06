"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { SectionHeading } from "../sectionHeading.stylex";
import TimeSince from "../timeSince";
import { AdminTextLink } from "./adminContent.stylex";

type ScraperActivityData = Outputs["admin"]["scraperActivity"];
type HealthCounts = ScraperActivityData["totals"];
type SavedCounts = ScraperActivityData["saved"]["reviews"];
type ScraperActivityProps = { data: ScraperActivityData };

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatNamedCount(value: number, name: string) {
  return `${formatCount(value)} ${name}${value === 1 ? "" : "s"}`;
}

function requestFailureText(counts: HealthCounts) {
  if (!counts.requestErrorsComplete) {
    return counts.requestErrors
      ? `At least ${formatNamedCount(counts.requestErrors, "request")} failed`
      : "Some request failures were not recorded";
  }
  return formatNamedCount(counts.requestErrors, "failed request");
}

function problemText(error: string) {
  if (error === "Robots policy disallows this scraper path.") {
    return "The site does not allow us to check this page.";
  }
  return error;
}

function failureText(counts: HealthCounts) {
  const details: string[] = [];
  if (counts.requestErrors > 0 || !counts.requestErrorsComplete) {
    details.push(requestFailureText(counts));
  }
  if (counts.failedRuns > 0) {
    details.push(formatNamedCount(counts.failedRuns, "failed run"));
  }
  return details.length ? details.join(" · ") : "No failures";
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function SavedTotal({
  counts,
  first = false,
  label,
}: {
  counts: SavedCounts;
  first?: boolean;
  label: string;
}) {
  const olderRunCount = Math.max(
    0,
    counts.total - counts.new - counts.existing,
  );

  return (
    <div {...stylex.props(styles.savedTotal, !first && styles.savedDivider)}>
      <dt {...stylex.props(foundationStyles.rowTitle, styles.savedLabel)}>
        {label}
      </dt>
      <dd {...stylex.props(styles.savedValue)}>{formatCount(counts.total)}</dd>
      <dd {...stylex.props(foundationStyles.metadata, styles.savedBreakdown)}>
        <span>
          <strong {...stylex.props(styles.breakdownValue)}>
            {formatCount(counts.new)}
          </strong>{" "}
          new
        </span>
        <span>
          <strong {...stylex.props(styles.breakdownValue)}>
            {formatCount(counts.existing)}
          </strong>{" "}
          already in Peated
        </span>
        {olderRunCount > 0 ? (
          <span>
            <strong {...stylex.props(styles.breakdownValue)}>
              {formatCount(olderRunCount)}
            </strong>{" "}
            from older runs
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** Shows the scraper results and health that matter on the admin overview. */
export default function ScraperActivity({ data }: ScraperActivityProps) {
  const activeDays = data.days.filter(
    (day) =>
      day.runs > 0 || day.reviews > 0 || day.prices > 0 || day.bottles > 0,
  );

  return (
    <div {...stylex.props(styles.root)}>
      <section aria-labelledby="scraper-results-heading">
        <div {...stylex.props(styles.sectionHeading)}>
          <SectionHeading id="scraper-results-heading">
            Reviews, prices and bottles
          </SectionHeading>
          <p
            {...stylex.props(foundationStyles.body, styles.sectionDescription)}
          >
            New means Peated did not already have that review, price or bottle.
          </p>
        </div>

        <dl {...stylex.props(styles.savedGrid)}>
          <SavedTotal first label="Reviews" counts={data.saved.reviews} />
          <SavedTotal label="Prices" counts={data.saved.prices} />
          <SavedTotal label="Bottles" counts={data.saved.bottles} />
        </dl>

        <dl {...stylex.props(styles.healthGrid)}>
          <div {...stylex.props(styles.healthItem)}>
            <dt
              {...stylex.props(foundationStyles.metadata, styles.healthLabel)}
            >
              Runs
            </dt>
            <dd {...stylex.props(styles.healthValue)}>
              {formatCount(data.totals.runs)}
            </dd>
            <dd
              {...stylex.props(
                foundationStyles.metadata,
                styles.healthDetail,
                data.totals.failedRuns > 0 && styles.failure,
              )}
            >
              {formatNamedCount(data.totals.failedRuns, "failed run")}
            </dd>
          </div>
          <div {...stylex.props(styles.healthItem, styles.healthDivider)}>
            <dt
              {...stylex.props(foundationStyles.metadata, styles.healthLabel)}
            >
              Requests
            </dt>
            <dd {...stylex.props(styles.healthValue)}>
              {formatCount(data.totals.requests)}
            </dd>
            <dd
              {...stylex.props(
                foundationStyles.metadata,
                styles.healthDetail,
                (data.totals.requestErrors > 0 ||
                  !data.totals.requestErrorsComplete) &&
                  styles.failure,
              )}
            >
              {requestFailureText(data.totals)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="daily-activity-heading">
        <div {...stylex.props(styles.sectionHeading)}>
          <SectionHeading id="daily-activity-heading">
            Day by day
          </SectionHeading>
        </div>
        {activeDays.length ? (
          <ol {...stylex.props(styles.dailyList)}>
            {activeDays.map((day) => {
              const hasFailures =
                day.requestErrors > 0 ||
                day.failedRuns > 0 ||
                !day.requestErrorsComplete;
              return (
                <li key={day.date} {...stylex.props(styles.dailyRow)}>
                  <time
                    dateTime={day.date}
                    {...stylex.props(
                      foundationStyles.compactRowTitle,
                      styles.day,
                    )}
                  >
                    {formatDay(day.date)}
                  </time>
                  <div {...stylex.props(styles.dailyResults)}>
                    <span>{formatNamedCount(day.reviews, "review")}</span>
                    <span>{formatNamedCount(day.prices, "price")}</span>
                    <span>{formatNamedCount(day.bottles, "bottle")}</span>
                  </div>
                  <div
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.dailyHealth,
                    )}
                  >
                    <span>
                      {formatNamedCount(day.runs, "run")} ·{" "}
                      {formatNamedCount(day.requests, "request")}
                    </span>
                    <span {...stylex.props(hasFailures && styles.failure)}>
                      {failureText(day)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p {...stylex.props(foundationStyles.body, styles.empty)}>
            No scraper activity in the last 30 days.
          </p>
        )}
      </section>

      {data.recentFailures.length ? (
        <section aria-labelledby="recent-problems-heading">
          <div {...stylex.props(styles.sectionHeading)}>
            <SectionHeading id="recent-problems-heading">
              Recent problems
            </SectionHeading>
          </div>
          <ul {...stylex.props(styles.problemList)}>
            {data.recentFailures.map((failure) => (
              <li key={failure.runId} {...stylex.props(styles.problem)}>
                <div {...stylex.props(styles.problemHeader)}>
                  <AdminTextLink href={`/admin/sites/${failure.site.key}/runs`}>
                    {failure.site.name}
                  </AdminTextLink>
                  <span
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.problemTime,
                    )}
                  >
                    <TimeSince date={failure.completedAt} />
                  </span>
                </div>
                <p
                  {...stylex.props(
                    foundationStyles.body,
                    styles.problemMessage,
                  )}
                >
                  {problemText(failure.error)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x8,
  },
  sectionHeading: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
    marginBottom: space.x4,
  },
  sectionDescription: {
    maxWidth: "68ch",
    color: colors.inkMuted,
  },
  savedGrid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      "@media (max-width: 639px)": "1fr",
    },
    margin: 0,
    padding: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  savedTotal: {
    minWidth: 0,
    paddingTop: space.x6,
    paddingRight: space.x6,
    paddingBottom: space.x6,
    paddingLeft: space.x6,
    "@media (max-width: 639px)": {
      paddingRight: 0,
      paddingLeft: 0,
    },
  },
  savedDivider: {
    borderLeftWidth: { default: "1px", "@media (max-width: 639px)": 0 },
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
    "@media (max-width: 639px)": {
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: colors.hairline,
    },
  },
  savedLabel: { color: colors.ink },
  savedValue: {
    margin: 0,
    marginTop: space.x3,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "40px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  savedBreakdown: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
  },
  breakdownValue: { color: colors.ink, fontWeight: 600 },
  healthGrid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    margin: 0,
    padding: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  healthItem: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(72px, auto) auto 1fr",
    alignItems: "baseline",
    columnGap: space.x3,
    paddingTop: space.x4,
    paddingRight: space.x6,
    paddingBottom: space.x4,
    paddingLeft: space.x6,
    "@media (max-width: 639px)": {
      gridTemplateColumns: "1fr",
      rowGap: space.x1,
      paddingRight: space.x4,
      paddingLeft: 0,
    },
  },
  healthDivider: {
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
    "@media (max-width: 639px)": { paddingLeft: space.x4 },
  },
  healthLabel: { color: colors.inkMuted },
  healthValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  healthDetail: { margin: 0, color: colors.inkMuted },
  failure: { color: colors.critical },
  dailyList: {
    margin: 0,
    padding: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    listStyle: "none",
  },
  dailyRow: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "88px minmax(0, 1.35fr) minmax(210px, 1fr)",
    alignItems: "center",
    columnGap: space.x6,
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    "@media (max-width: 759px)": {
      gridTemplateColumns: "1fr",
      alignItems: "stretch",
      rowGap: space.x2,
    },
  },
  day: { color: colors.ink },
  dailyResults: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    columnGap: space.x3,
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
    "@media (max-width: 479px)": {
      gridTemplateColumns: "1fr",
      rowGap: space.x1,
    },
  },
  dailyHealth: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
    color: colors.inkMuted,
  },
  empty: {
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.inkMuted,
  },
  problemList: {
    margin: 0,
    padding: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    listStyle: "none",
  },
  problem: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  problemHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: space.x4,
  },
  problemTime: { flexShrink: 0, color: colors.inkMuted },
  problemMessage: { color: colors.critical },
});
