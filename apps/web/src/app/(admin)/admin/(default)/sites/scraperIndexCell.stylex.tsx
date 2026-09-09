import type { Outputs } from "@peated/server/orpc/router";
import ExternalSiteRunStatus from "@peated/web/components/admin/externalSiteRunStatus";
import TimeSince from "@peated/web/components/timeSince";
import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../../../../styles/foundations.stylex";
import { colors, space } from "../../../../../styles/tokens.stylex";

type Site = Outputs["externalSites"]["healthList"]["results"][number];

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

/** Shows a saved record count and the matching work that remains. */
export function ScraperRecordCount({
  total,
  unmatched,
}: {
  total: number;
  unmatched?: number;
}) {
  const detail =
    total === 0 || unmatched === undefined
      ? null
      : unmatched === 0
        ? "All matched"
        : `${formatCount(unmatched)} ${unmatched === 1 ? "needs" : "need"} matching`;

  return (
    <span {...stylex.props(styles.stack)}>
      <strong
        {...stylex.props(
          foundationStyles.compactRowTitle,
          styles.tabularNumber,
        )}
      >
        {total === 0 ? (
          <>
            <span aria-hidden="true">—</span>
            <span {...stylex.props(styles.visuallyHidden)}>None saved</span>
          </>
        ) : (
          formatCount(total)
        )}
      </strong>
      {detail ? (
        <span
          {...stylex.props(
            foundationStyles.metadata,
            styles.detail,
            unmatched !== undefined && unmatched > 0 && styles.needsAttention,
          )}
        >
          {detail}
        </span>
      ) : null}
    </span>
  );
}

/** Keeps the latest result and the next scheduled run together. */
export function ScraperRunSummary({ site }: { site: Site }) {
  return (
    <span {...stylex.props(styles.stack, styles.run)}>
      <ExternalSiteRunStatus site={site} />
      <span {...stylex.props(foundationStyles.metadata, styles.detail)}>
        {site.nextRunAt ? (
          <>
            Next <TimeSince date={site.nextRunAt} />
          </>
        ) : site.runEvery === null ? (
          "Manual only"
        ) : (
          "Due now"
        )}
      </span>
    </span>
  );
}

const styles = stylex.create({
  stack: {
    display: "inline-flex",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space.x1,
    textAlign: "left",
  },
  run: { minWidth: "180px", whiteSpace: "nowrap" },
  tabularNumber: { fontVariantNumeric: "tabular-nums" },
  detail: { color: colors.inkMuted, whiteSpace: "nowrap" },
  needsAttention: { color: colors.accentDeep, fontWeight: 600 },
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
});
