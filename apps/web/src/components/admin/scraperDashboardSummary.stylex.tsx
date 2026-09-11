import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { AdminMetadataList } from "./adminContent.stylex";

type Coverage = Outputs["admin"]["catalogCoverage"];
type Health = Outputs["externalSites"]["healthList"]["summary"];

function percentage(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function HealthStat({
  divided = false,
  label,
  value,
}: {
  divided?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div {...stylex.props(styles.healthStat, divided && styles.divided)}>
      <dt {...stylex.props(foundationStyles.metadata, styles.healthLabel)}>
        {label}
      </dt>
      <dd {...stylex.props(styles.healthValue)}>
        {value.toLocaleString("en-US")}
      </dd>
    </div>
  );
}

function CoverageRow({
  detail,
  divided = false,
  label,
  value,
}: {
  detail: ReactNode;
  divided?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div {...stylex.props(styles.coverageRow, divided && styles.rowDivided)}>
      <dt {...stylex.props(styles.coverageTerm)}>
        <strong {...stylex.props(styles.coverageValue)}>
          {value.toLocaleString("en-US")}
        </strong>
        <span
          {...stylex.props(foundationStyles.metadata, styles.coverageLabel)}
        >
          {label}
        </span>
      </dt>
      <dd {...stylex.props(foundationStyles.metadata, styles.coverageDetail)}>
        {detail}
      </dd>
    </div>
  );
}

export default function ScraperDashboardSummary({
  coverage,
  health,
}: {
  coverage: Coverage;
  health: Health;
}) {
  return (
    <section aria-label="Scraper summary" {...stylex.props(styles.summary)}>
      <dl aria-label="Scraper health" {...stylex.props(styles.health)}>
        <HealthStat label="Total scrapers" value={health.total} />
        <HealthStat divided label="Healthy" value={health.healthy} />
        <HealthStat divided label="Unhealthy" value={health.unhealthy} />
      </dl>

      <dl aria-label="Catalog coverage" {...stylex.props(styles.coverage)}>
        <CoverageRow
          label="Active bottles"
          value={coverage.bottles.total}
          detail={
            <AdminMetadataList
              items={[
                `${percentage(coverage.bottles.withDescription, coverage.bottles.total)} described`,
                `${percentage(coverage.bottles.withImage, coverage.bottles.total)} pictured`,
                `${percentage(coverage.bottles.withReviews, coverage.bottles.total)} with reviews`,
                `${percentage(coverage.bottles.withPriceListings, coverage.bottles.total)} with prices`,
              ]}
            />
          }
        />
        <CoverageRow
          divided
          label="Visible reviews"
          value={coverage.externalReviews.total}
          detail={
            <AdminMetadataList
              items={[
                `${coverage.externalReviews.matched.toLocaleString("en-US")} matched`,
                `${coverage.externalReviews.unmatched.toLocaleString("en-US")} unmatched`,
              ]}
            />
          }
        />
        <CoverageRow
          divided
          label="Visible prices"
          value={coverage.priceListings.total}
          detail={
            <AdminMetadataList
              items={[
                `${coverage.priceListings.matched.toLocaleString("en-US")} matched`,
                `${coverage.priceListings.unmatched.toLocaleString("en-US")} unmatched`,
              ]}
            />
          }
        />
      </dl>
    </section>
  );
}

const styles = stylex.create({
  summary: {
    display: "grid",
    minWidth: 0,
    alignItems: "stretch",
    gridTemplateColumns: {
      default: "minmax(360px, 0.85fr) minmax(0, 1.4fr)",
      "@media (max-width: 839px)": "minmax(0, 1fr)",
    },
    gap: { default: space.x6, "@media (max-width: 839px)": space.x4 },
  },
  health: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    margin: 0,
    padding: 0,
    backgroundColor: colors.surface,
  },
  healthStat: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    justifyContent: "center",
    padding: { default: space.x4, "@media (max-width: 639px)": space.x3 },
  },
  divided: {
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
  },
  healthLabel: {
    color: colors.inkMuted,
  },
  healthValue: {
    order: -1,
    margin: 0,
    marginBottom: space.x2,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: { default: "32px", "@media (max-width: 639px)": "28px" },
    fontWeight: 700,
    lineHeight: 1,
  },
  coverage: {
    minWidth: 0,
    margin: 0,
    padding: 0,
  },
  coverageRow: {
    display: "grid",
    minWidth: 0,
    alignItems: "center",
    gridTemplateColumns: {
      default: "minmax(148px, 0.45fr) minmax(0, 1fr)",
      "@media (max-width: 639px)": "minmax(0, 1fr)",
    },
    columnGap: space.x4,
    rowGap: space.x1,
    paddingTop: space.x2,
    paddingBottom: space.x2,
  },
  rowDivided: {
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  coverageTerm: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: space.x2,
  },
  coverageValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    lineHeight: 1,
  },
  coverageLabel: {
    color: colors.ink,
    fontWeight: 600,
  },
  coverageDetail: {
    minWidth: 0,
    margin: 0,
    color: colors.inkMuted,
  },
});
