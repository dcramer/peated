"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";

import { TextLink } from "@peated/web/components/textLink.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../styles/tokens.stylex";
import { SectionHeading } from "../sectionHeading.stylex";

type OperationsData = Outputs["admin"]["moderation"]["automation"];
type InboxCounts = Outputs["admin"]["moderation"]["listTasks"]["counts"];
type BottleResolution = Outputs["admin"]["scraperActivity"]["bottleResolution"];
type OperationsOverviewProps = {
  bottleResolution: BottleResolution;
  data: OperationsData;
  inboxCounts: InboxCounts;
};

const proposalTypeLabels = {
  match_existing: "Existing matches",
  create_new: "New Bottles",
  correction: "Corrections",
  no_match: "No match",
} satisfies Record<
  OperationsData["listingAutomation"]["byProposalType"][number]["proposalType"],
  string
>;

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function formatPercent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function ResolutionItem({
  detail,
  label,
  tone,
  total,
  value,
}: {
  detail: string;
  label: string;
  tone: "unknown" | "created" | "matched";
  total: number;
  value: number;
}) {
  return (
    <div {...stylex.props(styles.resolutionItem)}>
      <dt {...stylex.props(styles.resolutionLabel)}>
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.resolutionMark,
            tone === "unknown" && styles.unknown,
            tone === "created" && styles.created,
            tone === "matched" && styles.matched,
          )}
        />
        <span {...stylex.props(foundationStyles.compactRowTitle)}>{label}</span>
      </dt>
      <dd {...stylex.props(styles.resolutionValue)}>{formatCount(value)}</dd>
      <dd {...stylex.props(foundationStyles.metadata, styles.resolutionDetail)}>
        {formatPercent(value, total)}% · {detail}
      </dd>
    </div>
  );
}

function StatusRow({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "danger";
  value: number;
}) {
  return (
    <div {...stylex.props(styles.statusRow)}>
      <dt {...stylex.props(foundationStyles.body, styles.statusLabel)}>
        {label}
      </dt>
      <dd
        {...stylex.props(
          styles.statusValue,
          tone === "danger" && styles.danger,
        )}
      >
        {formatCount(value)}
      </dd>
    </div>
  );
}

function SummaryCount({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "danger";
  value: number;
}) {
  return (
    <p {...stylex.props(styles.summaryCount)}>
      <strong
        {...stylex.props(
          styles.summaryValue,
          tone === "danger" && styles.danger,
        )}
      >
        {formatCount(value)}
      </strong>
      <span {...stylex.props(foundationStyles.body, styles.summaryLabel)}>
        {label}
      </span>
    </p>
  );
}

/** Separates human decisions from background work before showing data health. */
export default function OperationsOverview({
  bottleResolution,
  data,
  inboxCounts,
}: OperationsOverviewProps) {
  const resolutionTotal =
    bottleResolution.unknown +
    bottleResolution.created +
    bottleResolution.matched;

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.workGrid)}>
        <section
          aria-labelledby="moderation-inbox-heading"
          {...stylex.props(styles.moderationPanel)}
        >
          <div {...stylex.props(styles.panelHeader)}>
            <SectionHeading id="moderation-inbox-heading">
              Moderation inbox
            </SectionHeading>
            <TextLink href="/admin/moderation/inbox">Open inbox</TextLink>
          </div>
          <SummaryCount
            label={inboxCounts.all === 1 ? "open decision" : "open decisions"}
            value={inboxCounts.all}
          />
          <dl {...stylex.props(styles.statusList)}>
            <StatusRow label="Listings" value={inboxCounts.listing} />
            <StatusRow label="Catalog" value={inboxCounts.catalog} />
          </dl>
        </section>

        <section
          aria-labelledby="background-work-heading"
          {...stylex.props(styles.backgroundPanel)}
        >
          <div {...stylex.props(styles.panelHeader)}>
            <SectionHeading id="background-work-heading">
              Background work
            </SectionHeading>
            <TextLink href="/admin/moderation/automation">
              View background work
            </TextLink>
          </div>
          <SummaryCount
            label={data.counts.failed === 1 ? "failed item" : "failed items"}
            tone={data.counts.failed > 0 ? "danger" : "default"}
            value={data.counts.failed}
          />
          <dl {...stylex.props(styles.statusList)}>
            <StatusRow label="In progress" value={data.counts.processing} />
            <StatusRow label="Waiting" value={data.counts.waiting} />
          </dl>
        </section>
      </div>

      <div {...stylex.props(styles.insightsGrid)}>
        <section
          aria-labelledby="bottle-resolution-heading"
          {...stylex.props(styles.resolutionPanel)}
        >
          <div {...stylex.props(styles.panelHeading)}>
            <SectionHeading id="bottle-resolution-heading">
              Bottle resolution
            </SectionHeading>
            <p
              {...stylex.props(foundationStyles.body, styles.panelDescription)}
            >
              New reviews and prices from the last 30 days, grouped by their
              current Bottle match.
            </p>
          </div>

          {resolutionTotal ? (
            <>
              <div aria-hidden="true" {...stylex.props(styles.resolutionTrack)}>
                {bottleResolution.unknown ? (
                  <span
                    style={{ flexGrow: bottleResolution.unknown }}
                    {...stylex.props(styles.resolutionSegment, styles.unknown)}
                  />
                ) : null}
                {bottleResolution.created ? (
                  <span
                    style={{ flexGrow: bottleResolution.created }}
                    {...stylex.props(styles.resolutionSegment, styles.created)}
                  />
                ) : null}
                {bottleResolution.matched ? (
                  <span
                    style={{ flexGrow: bottleResolution.matched }}
                    {...stylex.props(styles.resolutionSegment, styles.matched)}
                  />
                ) : null}
              </div>
              <dl {...stylex.props(styles.resolutionList)}>
                <ResolutionItem
                  label="Unknown"
                  value={bottleResolution.unknown}
                  total={resolutionTotal}
                  detail="no Bottle match yet"
                  tone="unknown"
                />
                <ResolutionItem
                  label="New bottles"
                  value={bottleResolution.created}
                  total={resolutionTotal}
                  detail="added to Peated"
                  tone="created"
                />
                <ResolutionItem
                  label="Existing matches"
                  value={bottleResolution.matched}
                  total={resolutionTotal}
                  detail="matched to Bottles in Peated"
                  tone="matched"
                />
              </dl>
            </>
          ) : (
            <p {...stylex.props(foundationStyles.body, styles.empty)}>
              No new reviews or prices in the last 30 days.
            </p>
          )}
        </section>

        <section
          aria-labelledby="price-matching-heading"
          {...stylex.props(styles.matchingPanel)}
        >
          <div {...stylex.props(styles.matchingHeader)}>
            <SectionHeading id="price-matching-heading">
              Price matching
            </SectionHeading>
            {data.listingAutomation.sampleSize ? (
              <strong {...stylex.props(styles.matchingRate)}>
                {data.listingAutomation.rate ?? 0}% automatic
              </strong>
            ) : null}
          </div>
          {data.listingAutomation.sampleSize ? (
            <>
              <p
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.matchingDetail,
                )}
              >
                {formatCount(data.listingAutomation.automatic)} automatic ·{" "}
                {formatCount(data.listingAutomation.manual)} manual ·{" "}
                <span
                  {...stylex.props(
                    data.listingAutomation.failed > 0 && styles.danger,
                  )}
                >
                  {formatCount(data.listingAutomation.failed)} failed
                </span>
                <br />
                Last {formatCount(data.listingAutomation.sampleSize)} completed
                checks
              </p>
              <dl
                aria-label="Price matching by decision"
                {...stylex.props(styles.matchingBreakdown)}
              >
                {data.listingAutomation.byProposalType.map((item) => (
                  <div
                    key={item.proposalType}
                    {...stylex.props(styles.matchingBreakdownRow)}
                  >
                    <dt>{proposalTypeLabels[item.proposalType]}</dt>
                    <dd {...stylex.props(styles.matchingBreakdownValue)}>
                      {item.rate}% · {formatCount(item.sampleSize)} checked
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p
              {...stylex.props(
                foundationStyles.metadata,
                styles.matchingDetail,
              )}
            >
              No completed price checks yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x6,
  },
  workGrid: {
    display: "grid",
    minWidth: 0,
    alignItems: "start",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 839px)": "1fr",
    },
    gap: space.x4,
  },
  insightsGrid: {
    display: "grid",
    minWidth: 0,
    alignItems: "start",
    gridTemplateColumns: {
      default: "minmax(0, 1.7fr) minmax(280px, 1fr)",
      "@media (max-width: 839px)": "1fr",
    },
    gap: space.x6,
    paddingTop: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  moderationPanel: {
    minWidth: 0,
    padding: { default: space.x6, "@media (max-width: 639px)": space.x4 },
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  backgroundPanel: {
    minWidth: 0,
    padding: { default: space.x6, "@media (max-width: 639px)": space.x4 },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
  },
  resolutionPanel: { minWidth: 0 },
  matchingPanel: { minWidth: 0 },
  panelHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    "@media (max-width: 479px)": {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: space.x2,
    },
  },
  panelHeading: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  panelDescription: { maxWidth: "62ch", color: colors.inkMuted },
  resolutionTrack: {
    display: "flex",
    height: "10px",
    marginTop: space.x6,
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
  },
  resolutionSegment: { minWidth: "3px", flexBasis: 0 },
  unknown: { backgroundColor: colors.dataRange },
  created: { backgroundColor: colors.accent },
  matched: { backgroundColor: colors.dataAccent },
  resolutionList: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      "@media (max-width: 559px)": "1fr",
    },
    gap: { default: space.x4, "@media (max-width: 559px)": space.x3 },
    margin: 0,
    marginTop: space.x6,
    padding: 0,
  },
  resolutionItem: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "1fr auto",
    columnGap: space.x2,
    alignItems: "baseline",
    "@media (max-width: 559px)": {
      paddingBottom: space.x3,
      borderBottomWidth: "1px",
      borderBottomStyle: "solid",
      borderBottomColor: colors.hairline,
    },
  },
  resolutionLabel: {
    display: "inline-flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x2,
  },
  resolutionMark: {
    width: "9px",
    height: "9px",
    flexShrink: 0,
    borderRadius: "50%",
  },
  resolutionValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "-0.035em",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  resolutionDetail: {
    gridColumn: "1 / -1",
    margin: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
  },
  empty: {
    marginTop: space.x6,
    paddingTop: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    color: colors.inkMuted,
  },
  summaryCount: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x2,
    margin: 0,
    marginTop: space.x6,
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  summaryLabel: { color: colors.inkMuted },
  statusList: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    margin: 0,
    marginTop: space.x4,
    padding: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  statusRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x4,
    paddingTop: space.x2,
    paddingBottom: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  statusLabel: { color: colors.inkMuted },
  statusValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  danger: { color: colors.critical },
  matchingHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
  },
  matchingRate: {
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  matchingDetail: { marginTop: space.x4, color: colors.inkMuted },
  matchingBreakdown: {
    display: "grid",
    gap: space.x1,
    margin: 0,
    marginTop: space.x3,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    color: colors.inkMuted,
    fontSize: "13px",
  },
  matchingBreakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: space.x3,
  },
  matchingBreakdownValue: {
    margin: 0,
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
  },
});
