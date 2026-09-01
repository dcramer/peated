import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { colors, controlMetrics, fonts, space } from "../styles/tokens.stylex";

const COMPACT = "@media (max-width: 639px)";

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
export type TastingRatingCounts = Partial<Record<RatingBand, number>>;

export type ReviewScoreProps = {
  /** Number of eligible member and external review scores in the median. */
  count: number;
  /** Highest eligible review score in the pool. */
  high?: number | null;
  /** Lowest eligible review score in the pool. */
  low?: number | null;
  /** Whole-number median of eligible review scores. */
  median?: number | null;
  /** Optional caller-owned action when the median is withheld. */
  contributionAction?: ReactNode;
};

/** Shows the median of eligible member and external review scores. */
export function ReviewScore({
  contributionAction,
  count,
  high = null,
  low = null,
  median = null,
}: ReviewScoreProps) {
  const hasScore = median !== null && count > 0;
  const hasRange = count > 1 && low !== null && high !== null;

  return (
    <div
      data-state={hasScore ? "populated" : "withheld"}
      {...stylex.props(styles.score)}
    >
      <div {...stylex.props(styles.reviewScoreLabel)}>Score</div>
      {hasScore ? (
        <>
          <div {...stylex.props(styles.scoreHeading)}>
            <strong {...stylex.props(styles.scoreValue)}>{median}</strong>
            <span {...stylex.props(styles.scoreMetadata)}>
              / 100 · median of {formatCount(count)} {countNoun(count)}
            </span>
          </div>
          <div aria-hidden="true" {...stylex.props(styles.scoreTrack)}>
            {hasRange ? (
              <span {...stylex.props(styles.scoreRange(low, high))} />
            ) : null}
            <span {...stylex.props(styles.scoreTick(median))} />
          </div>
          {hasRange ? (
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
              : `${formatCount(count)} ${countNoun(count)} so far.`}
          </span>
          {contributionAction}
        </div>
      )}
    </div>
  );
}

export type TastingRatingDistributionProps = {
  counts?: TastingRatingCounts;
  showCounts?: boolean;
};

/** Shows aggregate tasting ratings as five fixed bins. */
export function TastingRatingDistribution({
  counts = {},
  showCounts = false,
}: TastingRatingDistributionProps) {
  const bins = getTastingRatingBins(counts);
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const shares = getTastingRatingShares(bins);
  const label = bins
    .map((bin) => `${bin.label} ${formatCount(bin.count)}`)
    .join(", ");

  return (
    <div
      aria-label={label}
      data-state={total === 0 ? "empty" : "populated"}
      role="img"
      {...stylex.props(styles.tastingRatingDistribution)}
    >
      <div
        {...stylex.props(
          styles.tastingRatingTrack,
          total === 0 && styles.emptyTastingRatingTrack,
        )}
      >
        {total > 0
          ? bins.map((bin, index) => (
              <span
                key={bin.key}
                {...stylex.props(
                  styles.tastingRatingSegment(shares[index] ?? 0),
                  bandFillStyles[bin.fill],
                )}
              />
            ))
          : null}
      </div>
      {showCounts && total > 0 ? (
        <div {...stylex.props(styles.tastingRatingLabels)}>
          {bins.map((bin, index) => (
            <span
              key={bin.key}
              title={formatCount(bin.count)}
              {...stylex.props(styles.tastingRatingLabel(shares[index] ?? 0))}
            >
              {formatCount(bin.count)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type TastingRatingProps = {
  /** One canonical tasting rating. */
  band: RatingBand;
};

/** Shows one tasting rating as five cells. */
export function TastingRating({ band }: TastingRatingProps) {
  const selectedBand = RATING_BANDS.find((candidate) => candidate.key === band);
  const label = `${selectedBand?.label ?? "Unknown"} rating`;

  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      {...stylex.props(styles.tastingRating)}
    >
      {RATING_BANDS.map((candidate) => {
        const selected = candidate.key === band;

        return (
          <span
            key={candidate.key}
            {...stylex.props(
              styles.tastingRatingCell,
              selected && bandFillStyles[bandFillForKey(candidate.key)],
            )}
          />
        );
      })}
    </span>
  );
}

export type BottleRatingsProps = {
  /** Tasting rating counts in the fixed five-band order. */
  counts?: TastingRatingCounts;
  /** Highest eligible score in the median pool. */
  high?: number | null;
  /** Lowest eligible score in the median pool. */
  low?: number | null;
  /** Published median score. Keep this empty when the sample is withheld. */
  median?: number | null;
  /** Number of eligible scores in the median pool. */
  scoreCount?: number;
};

/** Combines tasting ratings and the published review score for one bottle row. */
export function BottleRatings({
  counts = {},
  high = null,
  low = null,
  median = null,
  scoreCount = 0,
}: BottleRatingsProps) {
  const bandCounts = RATING_BANDS.map((band) => counts[band.key] ?? 0);
  const tastingCount = bandCounts.reduce((sum, count) => sum + count, 0);
  const maxBandCount = Math.max(...bandCounts, 0);
  const sampleHeight = getRatingSampleHeight(tastingCount);
  const hasRange = low !== null && high !== null;
  const label = [
    median === null
      ? "No published score"
      : `Median score ${median} from ${formatCount(scoreCount)} ${countNoun(scoreCount)}`,
    `Tasting ratings: ${RATING_BANDS.map((band, index) => `${band.label} ${formatCount(bandCounts[index] ?? 0)}`).join(", ")}`,
    hasRange ? `Score range ${low} to ${high}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <span
      aria-label={label}
      data-state={tastingCount === 0 && median === null ? "empty" : "populated"}
      role="img"
      title={label}
      {...stylex.props(styles.bottleRatings)}
    >
      <span aria-hidden="true" {...stylex.props(styles.ratingPlot)}>
        <span {...stylex.props(styles.ratingBars)}>
          {bandCounts.map((count, index) => (
            <span
              key={RATING_BANDS[index]?.key}
              {...stylex.props(styles.ratingTrack)}
            >
              {count > 0 ? (
                <span
                  {...stylex.props(
                    styles.ratingBar(
                      getRatingBarHeight(count, maxBandCount, sampleHeight),
                    ),
                  )}
                />
              ) : null}
            </span>
          ))}
        </span>
        <span {...stylex.props(styles.ratingBaseline)} />
        <span {...stylex.props(styles.ratingRangeSlot)}>
          {hasRange ? (
            <span {...stylex.props(styles.ratingRange(low, high))}>
              <span {...stylex.props(styles.ratingRangeStart)} />
              <span {...stylex.props(styles.ratingRangeEnd)} />
            </span>
          ) : null}
        </span>
      </span>
      <strong {...stylex.props(styles.ratingMedian)}>
        {median === null ? null : median}
      </strong>
    </span>
  );
}

type BandFill = 1 | 2 | 3 | 4 | 5;
type TastingRatingBin = {
  count: number;
  fill: BandFill;
  key: string;
  label: string;
  range: string;
};

function bandFillForKey(key: RatingBand): BandFill {
  if (key === "mediocre") return 1;
  if (key === "good") return 2;
  if (key === "very_good") return 3;
  if (key === "outstanding") return 4;
  return 5;
}

function getTastingRatingBins(counts: TastingRatingCounts): TastingRatingBin[] {
  return RATING_BANDS.map((band) => ({
    count: counts[band.key] ?? 0,
    fill: bandFillForKey(band.key),
    key: band.key,
    label: band.label,
    range: band.shortRange,
  }));
}

function getTastingRatingShares(bins: readonly TastingRatingBin[]) {
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  if (total === 0) return bins.map(() => 0);
  return bins.map((bin) => (bin.count / total) * 100);
}

function clampPoint(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function clampRatingPoint(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(75, value));
}

function getRatingSampleHeight(total: number) {
  if (total <= 0) return 0;
  return Math.min(100, 30 + Math.log10(total + 1) * 27);
}

function getRatingBarHeight(count: number, maxCount: number, sample: number) {
  if (count <= 0 || maxCount <= 0) return 0;
  return Math.max(12, (count / maxCount) * sample);
}

function formatCount(count: number) {
  return count.toLocaleString("en-US");
}

function countNoun(count: number) {
  return count === 1 ? "score" : "scores";
}

const styles = stylex.create({
  score: {
    width: "100%",
  },
  reviewScoreLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    letterSpacing: 0,
    lineHeight: 1.4,
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
    fontSize: "56px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
  },
  scoreTrack: {
    position: "relative",
    height: "8px",
    marginTop: "12px",
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
    marginTop: "8px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.45,
  },
  scoreEmpty: {
    display: "flex",
    alignItems: "baseline",
    columnGap: space.x2,
    rowGap: space.x1,
    marginTop: space.x2,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.5,
    flexWrap: "wrap",
  },
  tastingRatingDistribution: {
    width: "100%",
  },
  tastingRatingTrack: {
    display: "flex",
    height: "10px",
    alignItems: "center",
    gap: 0,
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
  },
  emptyTastingRatingTrack: {
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.bandTrack,
  },
  tastingRatingSegment: (share: number) => ({
    boxSizing: "border-box",
    minWidth: "5px",
    height: "100%",
    flexBasis: 0,
    flexGrow: share,
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: colors.ground,
    borderRadius: 0,
  }),
  band1Fill: {
    backgroundColor: colors.band1,
  },
  band2Fill: {
    backgroundColor: colors.band2,
  },
  band3Fill: {
    backgroundColor: colors.band3,
  },
  band4Fill: {
    backgroundColor: colors.band4,
  },
  band5Fill: {
    backgroundColor: colors.band5,
  },
  tastingRatingLabels: {
    display: "flex",
    gap: "2px",
    marginTop: "5px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.35,
  },
  tastingRatingLabel: (share: number) => ({
    minWidth: 0,
    overflow: "hidden",
    flexBasis: 0,
    flexGrow: share,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  tastingRating: {
    display: "inline-flex",
    flexShrink: 0,
    gap: "2px",
  },
  tastingRatingCell: {
    position: "relative",
    display: "inline-block",
    width: "12px",
    height: "8px",
    flexShrink: 0,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.bandTrack,
  },
  bottleRatings: {
    display: "inline-flex",
    width: "152px",
    minWidth: 0,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x2,
    [COMPACT]: {
      width: "104px",
      gap: space.x1,
    },
  },
  ratingPlot: {
    display: "flex",
    width: "108px",
    minWidth: 0,
    flexDirection: "column",
    [COMPACT]: {
      width: "68px",
    },
  },
  ratingBars: {
    display: "grid",
    height: "20px",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    alignItems: "end",
    gap: "3px",
    [COMPACT]: {
      height: "16px",
      gap: "2px",
    },
  },
  ratingTrack: {
    position: "relative",
    display: "flex",
    height: "100%",
    alignItems: "flex-end",
    borderTopLeftRadius: controlMetrics.radiusSmall,
    borderTopRightRadius: controlMetrics.radiusSmall,
    backgroundImage: `linear-gradient(to top, ${colors.ratingTrack} 1px, transparent 1px)`,
  },
  ratingBar: (height: number) => ({
    display: "block",
    width: "100%",
    height: `${height}%`,
    minHeight: "2px",
    borderTopLeftRadius: controlMetrics.radiusSmall,
    borderTopRightRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.ratingFill,
  }),
  ratingBaseline: {
    display: "block",
    height: "1px",
    backgroundColor: colors.ratingTrack,
  },
  ratingRangeSlot: {
    position: "relative",
    display: "block",
    height: "6px",
  },
  ratingRange: (low: number, high: number) => ({
    position: "absolute",
    top: "2px",
    right: `${100 - ((clampRatingPoint(high) - 75) / 25) * 100}%`,
    left: `${((clampRatingPoint(low) - 75) / 25) * 100}%`,
    height: "1px",
    backgroundColor: colors.inkMuted,
  }),
  ratingRangeStart: {
    position: "absolute",
    top: "-1px",
    left: 0,
    width: "1px",
    height: "3px",
    backgroundColor: colors.inkMuted,
  },
  ratingRangeEnd: {
    position: "absolute",
    top: "-1px",
    right: 0,
    width: "1px",
    height: "3px",
    backgroundColor: colors.inkMuted,
  },
  ratingMedian: {
    display: "block",
    width: "36px",
    minHeight: "22px",
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    textAlign: "right",
    [COMPACT]: {
      width: "32px",
      fontSize: "16px",
    },
  },
  scoreMetadata: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
});

const bandFillStyles = {
  1: styles.band1Fill,
  2: styles.band2Fill,
  3: styles.band3Fill,
  4: styles.band4Fill,
  5: styles.band5Fill,
} satisfies Record<BandFill, stylex.StyleXStyles>;
