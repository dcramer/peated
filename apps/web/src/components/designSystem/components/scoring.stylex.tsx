import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

export const RATING_BANDS = [
  {
    key: "mediocre",
    label: "Mediocre",
    range: "under 80",
    shortRange: "–79",
    min: 0,
    max: 79,
  },
  {
    key: "good",
    label: "Good",
    range: "80–84",
    shortRange: "80–84",
    min: 80,
    max: 84,
  },
  {
    key: "very_good",
    label: "Very good",
    range: "85–89",
    shortRange: "85–89",
    min: 85,
    max: 89,
  },
  {
    key: "outstanding",
    label: "Outstanding",
    range: "90–94",
    shortRange: "90–94",
    min: 90,
    max: 94,
  },
  {
    key: "unicorn",
    label: "Unicorn",
    range: "95 and up",
    shortRange: "95+",
    min: 95,
    max: 100,
  },
] as const;

export type RatingBand = (typeof RATING_BANDS)[number]["key"];
export type BandCounts = Partial<Record<RatingBand, number>>;

export type ScoreProps = {
  /** Number of eligible member and external review scores in the median. */
  count: number;
  /** Highest eligible review score in the pool. */
  high?: number | null;
  /** Lowest eligible review score in the pool. */
  low?: number | null;
  /** Whole-number median of eligible review scores. */
  median?: number | null;
  /** Minimum score count before the median is shown. */
  minimumCount?: number;
  /** Optional caller-owned action when the median is withheld. */
  contributionAction?: ReactNode;
};

/** Shows the median of eligible member and external review scores. */
export function Score({
  contributionAction,
  count,
  high = null,
  low = null,
  median = null,
  minimumCount = 20,
}: ScoreProps) {
  const hasScore = median !== null && count >= minimumCount;

  return (
    <div
      data-state={hasScore ? "populated" : "withheld"}
      {...stylex.props(styles.score)}
    >
      <div {...stylex.props(styles.measureLabel)}>Score</div>
      {hasScore ? (
        <>
          <div {...stylex.props(styles.scoreHeading)}>
            <strong {...stylex.props(styles.scoreValue)}>{median}</strong>
            <span {...stylex.props(styles.measureMetadata)}>
              / 100 · median of {formatCount(count)} scores
            </span>
          </div>
          <div aria-hidden="true" {...stylex.props(styles.scoreTrack)}>
            {low !== null && high !== null ? (
              <span {...stylex.props(styles.scoreRange(low, high))} />
            ) : null}
            <span {...stylex.props(styles.scoreTick(median))} />
          </div>
          {low !== null && high !== null ? (
            <div {...stylex.props(styles.scoreCaption)}>
              low {low} · median {median} · high {high}
            </div>
          ) : null}
        </>
      ) : (
        <div {...stylex.props(styles.scoreEmpty)}>
          <span>
            {count === 0
              ? "No review scores yet."
              : `Only ${formatCount(count)} ${count === 1 ? "score" : "scores"} so far.`}
          </span>
          {contributionAction}
        </div>
      )}
    </div>
  );
}

export type BandStackProps = {
  counts?: BandCounts;
  showCounts?: boolean;
  showRanges?: boolean;
  variant?: "full" | "compact";
};

/** Shows tasting ratings as five fixed bins, or three drawing blocks in narrow rows. */
export function BandStack({
  counts = {},
  showCounts = false,
  showRanges = false,
  variant = "full",
}: BandStackProps) {
  const bins = getBandStackBins(counts, variant);
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const shares = getBandStackShares(bins, variant);
  const label = bins
    .map((bin) => `${bin.label} ${formatCount(bin.count)}`)
    .join(", ");

  return (
    <div
      aria-label={label}
      data-state={total === 0 ? "empty" : "populated"}
      role="img"
      {...stylex.props(
        styles.bandStack,
        variant === "compact" && styles.compactBandStack,
      )}
    >
      <div
        {...stylex.props(
          styles.bandStackTrack,
          variant === "compact" && styles.compactBandStackTrack,
          total === 0 && styles.emptyBandStackTrack,
        )}
      >
        {total > 0
          ? bins.map((bin, index) => (
              <span
                key={bin.key}
                {...stylex.props(
                  styles.bandStackSegment(shares[index] ?? 0),
                  bandFillStyles[bin.fill],
                )}
              />
            ))
          : null}
      </div>
      {showCounts && total > 0 ? (
        <div {...stylex.props(styles.bandStackLabels)}>
          {bins.map((bin, index) => (
            <span
              key={bin.key}
              {...stylex.props(styles.bandStackLabel(shares[index] ?? 0))}
            >
              {formatCount(bin.count)}
            </span>
          ))}
        </div>
      ) : null}
      {showRanges && total > 0 ? (
        <div {...stylex.props(styles.bandStackLabels, styles.bandStackRanges)}>
          {bins.map((bin, index) => (
            <span
              key={bin.key}
              {...stylex.props(styles.bandStackLabel(shares[index] ?? 0))}
            >
              {bin.range}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type BandMarkProps = {
  /** One canonical tasting rating. */
  band: RatingBand;
};

/** Shows one tasting rating as five cells. */
export function BandMark({ band }: BandMarkProps) {
  const selectedBand = RATING_BANDS.find((candidate) => candidate.key === band);
  const label = `${selectedBand?.label ?? "Unknown"} rating`;

  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      {...stylex.props(styles.bandMark)}
    >
      {RATING_BANDS.map((candidate) => {
        const selected = candidate.key === band;

        return (
          <span
            key={candidate.key}
            {...stylex.props(
              styles.bandMarkCell,
              selected && bandFillStyles[bandFillForKey(candidate.key)],
            )}
          />
        );
      })}
    </span>
  );
}

type BandFill = "high" | "low" | "mid";
type BandStackBin = {
  count: number;
  fill: BandFill;
  key: string;
  label: string;
  range: string;
};

function bandFillForKey(key: RatingBand): BandFill {
  if (key === "mediocre" || key === "good") return "low";
  if (key === "very_good") return "mid";
  return "high";
}

function getBandStackBins(
  counts: BandCounts,
  variant: NonNullable<BandStackProps["variant"]>,
): BandStackBin[] {
  if (variant === "compact") {
    return [
      {
        count: (counts.mediocre ?? 0) + (counts.good ?? 0),
        fill: "low",
        key: "low",
        label: "Under 85",
        range: "under 85",
      },
      {
        count: counts.very_good ?? 0,
        fill: "mid",
        key: "mid",
        label: "85–89",
        range: "85–89",
      },
      {
        count: (counts.outstanding ?? 0) + (counts.unicorn ?? 0),
        fill: "high",
        key: "high",
        label: "90 and up",
        range: "90+",
      },
    ];
  }

  return RATING_BANDS.map((band) => ({
    count: counts[band.key] ?? 0,
    fill: bandFillForKey(band.key),
    key: band.key,
    label: band.label,
    range: band.shortRange,
  }));
}

function getBandStackShares(
  bins: readonly BandStackBin[],
  variant: NonNullable<BandStackProps["variant"]>,
) {
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  if (total === 0) return bins.map(() => 0);

  const shares = bins.map((bin) => (bin.count / total) * 100);
  if (variant !== "compact") return shares;

  const minimumShare = 12;
  let debt = 0;
  const adjusted = shares.map((share) => {
    if (share === 0 || share >= minimumShare) return share;
    debt += minimumShare - share;
    return minimumShare;
  });

  while (debt > 0.01) {
    const largest = Math.max(...adjusted);
    const index = adjusted.indexOf(largest);
    const available = Math.max(0, largest - minimumShare);
    const payment = Math.min(available, debt);
    if (payment === 0) break;
    adjusted[index] -= payment;
    debt -= payment;
  }

  return adjusted;
}

function clampPoint(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatCount(count: number) {
  return count.toLocaleString("en-US");
}

const styles = stylex.create({
  score: {
    width: "100%",
  },
  measureLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  scoreHeading: {
    display: "flex",
    alignItems: "baseline",
    columnGap: space.x2,
    rowGap: space.x1,
    marginTop: space.x1,
    flexWrap: "wrap",
  },
  scoreValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "44px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  scoreTrack: {
    position: "relative",
    height: "8px",
    marginTop: "10px",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
  },
  scoreRange: (low: number, high: number) => ({
    position: "absolute",
    top: 0,
    right: `${100 - clampPoint(high)}%`,
    bottom: 0,
    left: `${clampPoint(low)}%`,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.dataRange,
  }),
  scoreTick: (median: number) => ({
    position: "absolute",
    top: "-3px",
    left: `calc(${clampPoint(median)}% - 1px)`,
    width: "2px",
    height: "14px",
    backgroundColor: colors.ink,
  }),
  scoreCaption: {
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.45,
  },
  scoreEmpty: {
    display: "flex",
    alignItems: "baseline",
    columnGap: space.x2,
    rowGap: space.x1,
    marginTop: space.x1,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.45,
    flexWrap: "wrap",
  },
  bandStack: {
    width: "100%",
  },
  compactBandStack: {
    width: "52px",
    flexShrink: 0,
  },
  bandStackTrack: {
    display: "flex",
    height: "10px",
    alignItems: "center",
    gap: "2px",
  },
  compactBandStackTrack: {
    height: "8px",
  },
  emptyBandStackTrack: {
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.bandTrack,
  },
  bandStackSegment: (share: number) => ({
    minWidth: 0,
    height: "100%",
    flexBasis: 0,
    flexGrow: share,
    borderRadius: controlMetrics.radiusSmall,
  }),
  lowBandFill: {
    backgroundColor: colors.bandLow,
  },
  midBandFill: {
    backgroundColor: colors.bandMid,
  },
  highBandFill: {
    backgroundColor: colors.bandHigh,
  },
  bandStackLabels: {
    display: "flex",
    gap: "2px",
    marginTop: "5px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.35,
  },
  bandStackRanges: {
    marginTop: "2px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  bandStackLabel: (share: number) => ({
    minWidth: 0,
    overflow: "hidden",
    flexBasis: 0,
    flexGrow: share,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  bandMark: {
    display: "inline-flex",
    flexShrink: 0,
    gap: "2px",
  },
  bandMarkCell: {
    position: "relative",
    display: "inline-block",
    width: "12px",
    height: "8px",
    flexShrink: 0,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
  },
  measureMetadata: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.45,
  },
});

const bandFillStyles = {
  high: styles.highBandFill,
  low: styles.lowBandFill,
  mid: styles.midBandFill,
} satisfies Record<BandFill, stylex.StyleXStyles>;
