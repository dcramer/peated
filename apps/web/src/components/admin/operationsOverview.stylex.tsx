"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { SectionHeading } from "../sectionHeading.stylex";

type OperationsData = Outputs["admin"]["moderation"]["automation"];
type OperationsOverviewProps = { data: OperationsData };

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function Metric({
  detail,
  first = false,
  label,
  mobileLeft = false,
  mobileTop = false,
  tone = "default",
  value,
}: {
  detail?: ReactNode;
  first?: boolean;
  label: string;
  mobileLeft?: boolean;
  mobileTop?: boolean;
  tone?: "default" | "danger";
  value: number;
}) {
  return (
    <div
      {...stylex.props(
        styles.metric,
        !first && styles.metricDivider,
        mobileLeft && styles.mobileLeft,
        mobileTop && styles.mobileTop,
      )}
    >
      <dt {...stylex.props(foundationStyles.rowTitle, styles.metricLabel)}>
        {label}
      </dt>
      <dd
        {...stylex.props(
          styles.metricValue,
          tone === "danger" && styles.danger,
        )}
      >
        {formatCount(value)}
      </dd>
      {detail ? (
        <dd {...stylex.props(foundationStyles.metadata, styles.metricDetail)}>
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

/** Summarizes live background work and recent price matching for administrators. */
export default function OperationsOverview({ data }: OperationsOverviewProps) {
  return (
    <div {...stylex.props(styles.root)}>
      <section aria-labelledby="current-operations-heading">
        <div {...stylex.props(styles.sectionHeading)}>
          <SectionHeading id="current-operations-heading">
            Right now
          </SectionHeading>
        </div>
        <dl {...stylex.props(styles.currentGrid)}>
          <Metric
            first
            label="Needs attention"
            value={data.counts.failed}
            tone={data.counts.failed > 0 ? "danger" : "default"}
          />
          <Metric
            label="In progress"
            mobileLeft
            value={data.counts.processing}
          />
          <Metric label="Waiting" mobileTop value={data.counts.waiting} />
          <Metric
            label="Finished today"
            mobileLeft
            mobileTop
            value={data.counts.clearedToday}
          />
        </dl>
      </section>

      <section aria-labelledby="price-matching-heading">
        <div {...stylex.props(styles.sectionHeading)}>
          <SectionHeading id="price-matching-heading">
            Price matching
          </SectionHeading>
          <p
            {...stylex.props(foundationStyles.body, styles.sectionDescription)}
          >
            {data.listingAutomation.sampleSize
              ? `Last ${formatCount(data.listingAutomation.sampleSize)} prices checked`
              : "No completed price checks yet."}
          </p>
        </div>
        {data.listingAutomation.sampleSize ? (
          <dl {...stylex.props(styles.matchingGrid)}>
            <Metric
              first
              label="Matched automatically"
              value={data.listingAutomation.automatic}
              detail={`${data.listingAutomation.rate ?? 0}% of checks`}
            />
            <Metric
              label="Handled by a person"
              mobileTop
              value={data.listingAutomation.manual}
            />
            <Metric
              label="Failed"
              mobileTop
              value={data.listingAutomation.failed}
              tone={data.listingAutomation.failed > 0 ? "danger" : "default"}
            />
          </dl>
        ) : null}
      </section>
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
  currentGrid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: {
      default: "repeat(4, minmax(0, 1fr))",
      "@media (max-width: 639px)": "repeat(2, minmax(0, 1fr))",
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
  matchingGrid: {
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
  metric: {
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
  metricDivider: {
    borderLeftWidth: { default: "1px", "@media (max-width: 639px)": 0 },
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
  },
  mobileLeft: {
    "@media (max-width: 639px)": {
      paddingLeft: space.x4,
      borderLeftWidth: "1px",
      borderLeftStyle: "solid",
      borderLeftColor: colors.hairline,
    },
  },
  mobileTop: {
    "@media (max-width: 639px)": {
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: colors.hairline,
    },
  },
  metricLabel: { color: colors.ink },
  metricValue: {
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
  metricDetail: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
  },
  danger: { color: colors.critical },
});
