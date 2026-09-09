"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import { TextLink } from "@peated/web/components/textLink.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { SectionHeading } from "../sectionHeading.stylex";
import TimeSince from "../timeSince";

type ScraperActivityData = Outputs["admin"]["scraperActivity"];
type HealthCounts = ScraperActivityData["totals"];
type SavedCounts = ScraperActivityData["saved"]["reviews"];
type ActivityDay = ScraperActivityData["days"][number];
type ScraperActivityProps = { data: ScraperActivityData };

const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const fullDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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
  return shortDayFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatFullDay(value: string) {
  return fullDayFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function hasFailures(day: ActivityDay) {
  return (
    day.requestErrors > 0 || day.failedRuns > 0 || !day.requestErrorsComplete
  );
}

function savedTotal(day: ActivityDay) {
  return day.reviews + day.prices + day.catalogListings;
}

function savedDayLabel(day: ActivityDay) {
  return `${formatFullDay(day.date)}: ${formatNamedCount(day.reviews, "review")}, ${formatNamedCount(day.prices, "price")}, ${formatNamedCount(day.catalogListings, "catalog listing")}`;
}

function requestDayLabel(day: ActivityDay) {
  return `${formatFullDay(day.date)}: ${formatNamedCount(day.requests, "request")}, ${formatNamedCount(day.runs, "run")}, ${failureText(day)}`;
}

function ChartDates({ days }: { days: readonly ActivityDay[] }) {
  return (
    <div
      aria-hidden="true"
      {...stylex.props(foundationStyles.metadata, styles.chartDates)}
    >
      <span>{formatDay(days[0]!.date)}</span>
      <span>{formatDay(days.at(-1)!.date)}</span>
    </div>
  );
}

function ChartLegend({
  items,
}: {
  items: readonly {
    label: string;
    tone: "reviews" | "prices" | "catalogListings" | "requests" | "failures";
  }[];
}) {
  return (
    <ul {...stylex.props(styles.chartLegend)}>
      {items.map((item) => (
        <li
          key={item.label}
          {...stylex.props(foundationStyles.metadata, styles.legendItem)}
        >
          <span
            aria-hidden="true"
            {...stylex.props(
              styles.legendMark,
              item.tone === "reviews" && styles.reviews,
              item.tone === "prices" && styles.prices,
              item.tone === "catalogListings" && styles.catalogListings,
              item.tone === "requests" && styles.requests,
              item.tone === "failures" && styles.failures,
            )}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function SavedActivityChart({ days }: { days: readonly ActivityDay[] }) {
  const largestTotal = Math.max(...days.map(savedTotal), 0);

  return (
    <figure {...stylex.props(styles.chart)}>
      <figcaption {...stylex.props(styles.chartHeader)}>
        <span {...stylex.props(foundationStyles.compactRowTitle)}>
          Saved each day
        </span>
        <span {...stylex.props(foundationStyles.metadata, styles.chartScale)}>
          {largestTotal
            ? `Up to ${formatNamedCount(largestTotal, "item")} a day`
            : "No items saved"}
        </span>
      </figcaption>
      <div {...stylex.props(styles.chartPlot)}>
        <span aria-hidden="true" {...stylex.props(styles.chartGuide)} />
        {!largestTotal ? (
          <span {...stylex.props(foundationStyles.metadata, styles.chartEmpty)}>
            No reviews, prices or catalog listings were saved.
          </span>
        ) : null}
        <ol aria-label="Saved items by day" {...stylex.props(styles.chartBars)}>
          {days.map((day) => {
            const total = savedTotal(day);
            const height = largestTotal ? (total / largestTotal) * 100 : 0;
            return (
              <li
                key={day.date}
                title={savedDayLabel(day)}
                {...stylex.props(styles.chartBar)}
              >
                <span {...stylex.props(styles.visuallyHidden)}>
                  {savedDayLabel(day)}
                </span>
                {total > 0 ? (
                  <span
                    aria-hidden="true"
                    style={{ height: `${height}%` }}
                    {...stylex.props(styles.savedBar)}
                  >
                    {day.reviews > 0 ? (
                      <span
                        style={{ flexGrow: day.reviews }}
                        {...stylex.props(styles.savedBarPart, styles.reviews)}
                      />
                    ) : null}
                    {day.prices > 0 ? (
                      <span
                        style={{ flexGrow: day.prices }}
                        {...stylex.props(styles.savedBarPart, styles.prices)}
                      />
                    ) : null}
                    {day.catalogListings > 0 ? (
                      <span
                        style={{ flexGrow: day.catalogListings }}
                        {...stylex.props(
                          styles.savedBarPart,
                          styles.catalogListings,
                        )}
                      />
                    ) : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <ChartDates days={days} />
      <ChartLegend
        items={[
          { label: "Reviews", tone: "reviews" },
          { label: "Prices", tone: "prices" },
          { label: "Catalog listings", tone: "catalogListings" },
        ]}
      />
    </figure>
  );
}

function RequestActivityChart({
  days,
  divided = true,
}: {
  days: readonly ActivityDay[];
  divided?: boolean;
}) {
  const largestTotal = Math.max(...days.map((day) => day.requests), 0);

  return (
    <figure {...stylex.props(styles.chart, divided && styles.chartDivider)}>
      <figcaption {...stylex.props(styles.chartHeader)}>
        <span {...stylex.props(foundationStyles.compactRowTitle)}>
          Requests each day
        </span>
        <span {...stylex.props(foundationStyles.metadata, styles.chartScale)}>
          Up to {formatNamedCount(largestTotal, "request")} a day
        </span>
      </figcaption>
      <div {...stylex.props(styles.chartPlot)}>
        <span aria-hidden="true" {...stylex.props(styles.chartGuide)} />
        <ol aria-label="Requests by day" {...stylex.props(styles.chartBars)}>
          {days.map((day) => {
            const height = largestTotal
              ? (day.requests / largestTotal) * 100
              : 0;
            const problem = hasFailures(day);
            return (
              <li
                key={day.date}
                title={requestDayLabel(day)}
                {...stylex.props(styles.chartBar)}
              >
                <span {...stylex.props(styles.visuallyHidden)}>
                  {requestDayLabel(day)}
                </span>
                {day.requests > 0 || problem ? (
                  <span
                    aria-hidden="true"
                    style={{ height: `${Math.max(height, problem ? 3 : 0)}%` }}
                    {...stylex.props(
                      styles.requestBar,
                      day.requests > 0 && styles.requests,
                    )}
                  >
                    {problem ? (
                      <span {...stylex.props(styles.requestFailureMark)} />
                    ) : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <ChartDates days={days} />
      <ChartLegend
        items={[
          { label: "Requests", tone: "requests" },
          { label: "Had failures", tone: "failures" },
        ]}
      />
    </figure>
  );
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

/** Shows scraper output, request health, daily details, and recent problems. */
export default function ScraperActivity({ data }: ScraperActivityProps) {
  const activeDays = data.days.filter(
    (day) =>
      day.runs > 0 ||
      day.requests > 0 ||
      hasFailures(day) ||
      day.reviews > 0 ||
      day.prices > 0 ||
      day.catalogListings > 0,
  );
  const chartDays = [...data.days].reverse();
  const savedRecordTotal =
    data.saved.reviews.total +
    data.saved.prices.total +
    data.saved.catalogListings.total;
  const hasSavedActivity = data.days.some((day) => savedTotal(day) > 0);
  const hasRequestActivity = data.days.some(
    (day) => day.requests > 0 || hasFailures(day),
  );

  return (
    <div {...stylex.props(styles.root)}>
      {data.recentFailures.length ? (
        <section
          aria-labelledby="recent-problems-heading"
          {...stylex.props(styles.problemSection)}
        >
          <div {...stylex.props(styles.problemSectionHeader)}>
            <SectionHeading id="recent-problems-heading">
              Recent scraper problems
            </SectionHeading>
            <span {...stylex.props(styles.problemCount)}>
              {formatCount(data.recentFailures.length)}
            </span>
          </div>
          <ul {...stylex.props(styles.problemList)}>
            {data.recentFailures.map((failure) => (
              <li key={failure.runId} {...stylex.props(styles.problem)}>
                <div {...stylex.props(styles.problemHeader)}>
                  <TextLink href={`/admin/sites/${failure.site.key}/runs`}>
                    {failure.site.name}
                  </TextLink>
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

      <section aria-labelledby="source-activity-heading">
        <div {...stylex.props(styles.sourceHeader)}>
          <div {...stylex.props(styles.sectionHeading)}>
            <SectionHeading id="source-activity-heading">
              Source activity
            </SectionHeading>
            <p
              {...stylex.props(
                foundationStyles.body,
                styles.sectionDescription,
              )}
            >
              Last 30 days. New means Peated did not already have that review,
              price or catalog listing.
            </p>
          </div>
          <TextLink href="/admin/sites">Manage scrapers</TextLink>
        </div>

        <dl {...stylex.props(styles.healthSummary)}>
          <div {...stylex.props(styles.healthSummaryItem)}>
            <dt
              {...stylex.props(foundationStyles.metadata, styles.healthLabel)}
            >
              Runs
            </dt>
            <dd {...stylex.props(styles.healthSummaryValue)}>
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
          <div {...stylex.props(styles.healthSummaryItem)}>
            <dt
              {...stylex.props(foundationStyles.metadata, styles.healthLabel)}
            >
              Requests
            </dt>
            <dd {...stylex.props(styles.healthSummaryValue)}>
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

        {savedRecordTotal ? (
          <dl {...stylex.props(styles.savedGrid)}>
            <SavedTotal first label="Reviews" counts={data.saved.reviews} />
            <SavedTotal label="Prices" counts={data.saved.prices} />
            <SavedTotal
              label="Catalog listings"
              counts={data.saved.catalogListings}
            />
          </dl>
        ) : hasRequestActivity || data.totals.runs > 0 ? (
          <p {...stylex.props(foundationStyles.body, styles.savedEmpty)}>
            No reviews, prices or catalog listings saved.
          </p>
        ) : null}

        {hasSavedActivity || hasRequestActivity ? (
          <>
            <div
              {...stylex.props(
                styles.chartGrid,
                hasSavedActivity && hasRequestActivity
                  ? styles.chartGridSplit
                  : styles.chartGridSingle,
              )}
            >
              {hasSavedActivity ? (
                <SavedActivityChart days={chartDays} />
              ) : null}
              {hasRequestActivity ? (
                <RequestActivityChart
                  days={chartDays}
                  divided={hasSavedActivity}
                />
              ) : null}
            </div>
            <details {...stylex.props(styles.dailyDetails)}>
              <summary
                {...stylex.props(
                  foundationStyles.interactiveSmall,
                  styles.dailySummary,
                )}
              >
                Daily details
              </summary>
              <ol {...stylex.props(styles.dailyList)}>
                {activeDays.map((day) => (
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
                      <span>
                        {formatNamedCount(
                          day.catalogListings,
                          "catalog listing",
                        )}
                      </span>
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
                      <span
                        {...stylex.props(hasFailures(day) && styles.failure)}
                      >
                        {failureText(day)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <p {...stylex.props(foundationStyles.body, styles.empty)}>
            No scraper activity in the last 30 days.
          </p>
        )}
      </section>
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x6,
  },
  sourceHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x6,
    marginBottom: space.x4,
    "@media (max-width: 559px)": {
      flexDirection: "column",
      gap: space.x2,
    },
  },
  sectionHeading: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
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
    paddingTop: space.x4,
    paddingRight: space.x6,
    paddingBottom: space.x4,
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
    marginTop: space.x2,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "32px",
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
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  breakdownValue: { color: colors.ink, fontWeight: 600 },
  healthSummary: {
    display: "flex",
    minWidth: 0,
    flexWrap: "wrap",
    gap: space.x4,
    margin: 0,
    marginBottom: space.x3,
    padding: 0,
  },
  healthSummaryItem: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "auto auto auto",
    alignItems: "baseline",
    columnGap: space.x2,
    "@media (max-width: 639px)": {
      gridTemplateColumns: "auto auto",
    },
  },
  healthLabel: { color: colors.inkMuted },
  healthSummaryValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  healthDetail: {
    margin: 0,
    color: colors.inkMuted,
    "@media (max-width: 639px)": { gridColumn: "1 / -1" },
  },
  failure: { color: colors.critical },
  chartGrid: {
    display: "grid",
    minWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  chartGridSplit: {
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 759px)": "1fr",
    },
  },
  chartGridSingle: { gridTemplateColumns: "1fr" },
  chart: {
    minWidth: 0,
    margin: 0,
    paddingTop: space.x4,
    paddingRight: space.x6,
    paddingBottom: space.x4,
    "@media (max-width: 759px)": { paddingRight: 0 },
  },
  chartDivider: {
    paddingRight: 0,
    paddingLeft: space.x6,
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
    "@media (max-width: 759px)": {
      paddingLeft: 0,
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: colors.hairline,
      borderLeftWidth: 0,
    },
  },
  chartHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
  },
  chartScale: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  chartPlot: {
    position: "relative",
    height: "128px",
    marginTop: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  chartGuide: {
    position: "absolute",
    top: "50%",
    right: 0,
    left: 0,
    height: "1px",
    backgroundColor: colors.hairline,
  },
  chartEmpty: {
    position: "absolute",
    top: "50%",
    left: "50%",
    zIndex: 1,
    width: "max-content",
    maxWidth: "calc(100% - 32px)",
    paddingRight: space.x2,
    paddingLeft: space.x2,
    backgroundColor: colors.ground,
    color: colors.inkMuted,
    textAlign: "center",
    transform: "translate(-50%, -50%)",
  },
  chartBars: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "stretch",
    gap: "2px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  chartBar: {
    position: "relative",
    display: "flex",
    minWidth: 0,
    flex: 1,
    alignItems: "flex-end",
  },
  savedBar: {
    display: "flex",
    width: "100%",
    minHeight: "2px",
    flexDirection: "column-reverse",
    overflow: "hidden",
  },
  savedBarPart: { minHeight: "1px", flexBasis: 0 },
  requestBar: {
    position: "relative",
    display: "block",
    width: "100%",
    minHeight: "3px",
  },
  requestFailureMark: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: "3px",
    backgroundColor: colors.critical,
  },
  reviews: { backgroundColor: colors.ratingFill },
  prices: { backgroundColor: colors.dataAccent },
  catalogListings: { backgroundColor: colors.dataRange },
  requests: { backgroundColor: colors.dataAccent },
  failures: { backgroundColor: colors.critical },
  chartDates: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: space.x1,
    color: colors.inkMuted,
  },
  chartLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: space.x3,
    margin: 0,
    marginTop: space.x3,
    padding: 0,
    color: colors.inkMuted,
    listStyle: "none",
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: space.x1,
  },
  legendMark: {
    width: "9px",
    height: "9px",
    flexShrink: 0,
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  dailyDetails: { marginTop: space.x4 },
  dailySummary: {
    width: "fit-content",
    color: colors.accent,
    cursor: "pointer",
  },
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
  savedEmpty: {
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    color: colors.inkMuted,
  },
  problemSection: {
    minWidth: 0,
    padding: { default: space.x4, "@media (max-width: 639px)": space.x3 },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.criticalQuiet,
    backgroundColor: colors.surface,
  },
  problemSectionHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    marginBottom: space.x3,
  },
  problemCount: {
    display: "inline-flex",
    minWidth: "24px",
    height: "24px",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: space.x2,
    paddingLeft: space.x2,
    borderRadius: "12px",
    backgroundColor: colors.critical,
    color: colors.ground,
    fontFamily: fonts.display,
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
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
    paddingBottom: space.x3,
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
