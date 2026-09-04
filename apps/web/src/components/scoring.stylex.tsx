import { RATING_BANDS as SERVER_RATING_BANDS } from "@peated/server/constants";
import * as stylex from "@stylexjs/stylex";
import { useId } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, controlMetrics, fonts, space } from "../styles/tokens.stylex";
import { SectionHeading } from "./sectionHeading.stylex";

const COMPACT = "@media (max-width: 639px)";

export const RATING_BANDS = SERVER_RATING_BANDS.map((band) => ({
  key: band.id,
  label: band.label,
  range: `${band.min}–${band.max}`,
  min: band.min,
  max: band.max,
}));

export type RatingBand = (typeof SERVER_RATING_BANDS)[number]["id"];
export type RatingCounts = Partial<Record<RatingBand, number>>;
export type TastingRatingCounts = RatingCounts;

export type TastingRatingDistributionProps = {
  counts?: RatingCounts;
  showCounts?: boolean;
};

/** Shows ratings grouped into Peated's five fixed ranges. */
export function TastingRatingDistribution({
  counts = {},
  showCounts = false,
}: TastingRatingDistributionProps) {
  return <RatingDistribution counts={counts} showCounts={showCounts} />;
}

export type TastingRatingProps = {
  /** One tasting rating. */
  band: RatingBand;
  size?: "sm" | "md" | "lg";
};

/** Shows one tasting's named rating and range, never a five-point score. */
export function TastingRating({ band, size = "md" }: TastingRatingProps) {
  const selectedBand = RATING_BANDS.find((candidate) => candidate.key === band);
  const label = selectedBand?.label ?? "Unknown";
  const range = selectedBand?.range ?? "Unknown";

  return (
    <span {...stylex.props(styles.ratingLockup)}>
      <span {...stylex.props(styles.visuallyHidden)}>
        {label} rating, {range} range
      </span>
      <span
        aria-hidden="true"
        {...stylex.props(
          styles.ratingLabel,
          size === "sm" && styles.smallRatingLabel,
          size === "lg" && styles.largeRatingLabel,
        )}
      >
        {label}
      </span>
      <span
        aria-hidden="true"
        {...stylex.props(
          styles.tastingRatingRange,
          size === "sm" && styles.smallTastingRatingRange,
          size === "lg" && styles.largeTastingRatingRange,
        )}
      >
        {range} range
      </span>
    </span>
  );
}

export type ReviewScoreProps = {
  /** The original score shown by the review. */
  score: number;
  /** The original scoring scale. Only 100-point scores use Peated's rating names. */
  scale?: number;
  size?: "sm" | "md" | "lg";
};

/** Shows an exact review score and names its Peated rating on a 100-point scale. */
export function ReviewScore({
  score,
  scale = 100,
  size = "md",
}: ReviewScoreProps) {
  const rating = scale === 100 ? getRatingBandForScore(score) : undefined;
  const accessibleLabel = rating
    ? `${rating.label} review score, ${score} out of ${scale}`
    : `Review score, ${score} out of ${scale}`;

  return (
    <span {...stylex.props(styles.ratingLockup, styles.reviewScore)}>
      <span {...stylex.props(styles.visuallyHidden)}>{accessibleLabel}</span>
      {rating ? (
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.ratingLabel,
            size === "sm" && styles.smallRatingLabel,
            size === "lg" && styles.largeRatingLabel,
          )}
        >
          {rating.label}
        </span>
      ) : null}
      <span aria-hidden="true" {...stylex.props(styles.reviewScoreValueGroup)}>
        <strong
          {...stylex.props(
            styles.reviewScoreValue,
            size === "sm" && styles.smallReviewScoreValue,
            size === "lg" && styles.largeReviewScoreValue,
          )}
        >
          {score}
        </strong>
        <span
          {...stylex.props(
            styles.reviewScoreScale,
            size === "sm" && styles.smallReviewScoreScale,
          )}
        >
          /{scale}
        </span>
      </span>
    </span>
  );
}

export type BottleRatingSummaryProps = {
  /** Critic review scores included in the bottle score. */
  externalScoreCount?: number;
  /** Member review scores included in the bottle score. */
  memberScoreCount?: number;
  /** Median of the included member and critic review scores. */
  median?: number | null;
  /** Included review scores grouped into the five rating ranges. */
  reviewCounts?: RatingCounts;
  /** Tastings grouped into the five rating ranges. */
  tastingCounts?: RatingCounts;
};

/**
 * Shows one bottle rating, its exact review score or tasting range, and how
 * reviews and tastings are spread across the five ratings.
 */
export function BottleRatingSummary({
  externalScoreCount = 0,
  memberScoreCount = 0,
  median = null,
  reviewCounts = {},
  tastingCounts = {},
}: BottleRatingSummaryProps) {
  const headingId = useId();
  const rating = getBottleRating({
    median,
    scoreCount: memberScoreCount + externalScoreCount,
    tastingCounts,
  });
  if (!rating) return null;

  const combinedCounts = combineRatingCounts(reviewCounts, tastingCounts);
  const sources = formatSources({
    externalScoreCount,
    memberScoreCount,
    tastingCount: totalRatings(tastingCounts),
  });

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId}>Bottle rating</SectionHeading>
      <div {...stylex.props(styles.summaryHeadline)}>
        <strong {...stylex.props(styles.summaryLabel)}>{rating.label}</strong>
        <span {...stylex.props(styles.summaryValueGroup)}>
          <strong {...stylex.props(styles.summaryValue)}>{rating.value}</strong>
          {rating.exact ? (
            <span
              {...stylex.props(foundationStyles.metadata, styles.summaryScale)}
            >
              / 100
            </span>
          ) : null}
        </span>
      </div>
      {sources ? (
        <p {...stylex.props(foundationStyles.metadata, styles.sources)}>
          {sources}
        </p>
      ) : null}
      <div {...stylex.props(styles.distributionGroup)}>
        <div
          {...stylex.props(
            foundationStyles.fieldLabel,
            styles.distributionLabel,
          )}
        >
          How people rated
        </div>
        <RatingDistribution counts={combinedCounts} />
      </div>
    </section>
  );
}

export type BottleRatingsProps = Pick<
  BottleRatingSummaryProps,
  "median" | "reviewCounts" | "tastingCounts"
> & {
  /** Number of included member and critic review scores. */
  scoreCount?: number;
};

/** Compact, trailing rating summary for one bottle row. */
export function BottleRatings({
  median = null,
  reviewCounts = {},
  scoreCount = 0,
  tastingCounts = {},
}: BottleRatingsProps) {
  const rating = getBottleRating({ median, scoreCount, tastingCounts });
  if (!rating) return null;

  const combinedCounts = combineRatingCounts(reviewCounts, tastingCounts);
  const label = `${rating.label}, ${rating.value}${rating.exact ? " out of 100" : " range"}. ${formatRatingCounts(combinedCounts)}`;

  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      {...stylex.props(styles.bottleRatings)}
    >
      <span aria-hidden="true" {...stylex.props(styles.compactCopy)}>
        <span {...stylex.props(styles.compactLabel)}>{rating.label}</span>
        <span {...stylex.props(styles.compactValue)}>{rating.value}</span>
      </span>
      <span aria-hidden="true" {...stylex.props(styles.compactDistribution)}>
        <RatingDistribution compact counts={combinedCounts} />
      </span>
    </span>
  );
}

type BottleRating = { exact: boolean; label: string; value: string };
type BandFill = 1 | 2 | 3 | 4 | 5;
type RatingBin = {
  count: number;
  fill: BandFill;
  key: RatingBand;
  label: string;
};

function getBottleRating({
  median,
  scoreCount,
  tastingCounts,
}: {
  median: number | null;
  scoreCount: number;
  tastingCounts: RatingCounts;
}): BottleRating | null {
  if (median !== null && scoreCount > 0) {
    const band = getRatingBandForScore(median);
    if (band) return { exact: true, label: band.label, value: `${median}` };
  }

  const band = getMedianTastingBand(tastingCounts);
  return band ? { exact: false, label: band.label, value: band.range } : null;
}

function getRatingBandForScore(score: number) {
  return RATING_BANDS.find(
    (candidate) => score >= candidate.min && score <= candidate.max,
  );
}

function getMedianTastingBand(counts: RatingCounts) {
  const total = totalRatings(counts);
  if (total === 0) return null;

  const middle = Math.ceil(total / 2);
  let seen = 0;
  for (const band of RATING_BANDS) {
    seen += counts[band.key] ?? 0;
    if (seen >= middle) return band;
  }
  return null;
}

function combineRatingCounts(...counts: RatingCounts[]) {
  const total = (key: RatingBand) =>
    counts.reduce((sum, group) => sum + (group[key] ?? 0), 0);
  return {
    mediocre: total("mediocre"),
    good: total("good"),
    very_good: total("very_good"),
    outstanding: total("outstanding"),
    unicorn: total("unicorn"),
  };
}

function totalRatings(counts: RatingCounts) {
  return RATING_BANDS.reduce(
    (total, band) => total + (counts[band.key] ?? 0),
    0,
  );
}

function formatSources({
  externalScoreCount,
  memberScoreCount,
  tastingCount,
}: {
  externalScoreCount: number;
  memberScoreCount: number;
  tastingCount: number;
}) {
  const parts = [
    memberScoreCount > 0 ? "Member reviews" : null,
    externalScoreCount > 0 ? "Critic reviews" : null,
    tastingCount > 0 ? "Tastings" : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(" · ") : null;
}

function formatRatingCounts(counts: RatingCounts) {
  return RATING_BANDS.map(
    (band) => `${band.label} ${counts[band.key] ?? 0}`,
  ).join(", ");
}

function RatingDistribution({
  compact = false,
  counts,
  showCounts = false,
}: {
  compact?: boolean;
  counts: RatingCounts;
  showCounts?: boolean;
}) {
  const bins = getRatingBins(counts);
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const shares = bins.map((bin) =>
    total === 0 ? 0 : (bin.count / total) * 100,
  );

  return (
    <span
      aria-label={formatRatingCounts(counts)}
      data-state={total === 0 ? "empty" : "populated"}
      role="img"
      {...stylex.props(styles.ratingDistribution)}
    >
      <span
        {...stylex.props(
          styles.ratingDistributionTrack,
          compact && styles.compactRatingDistributionTrack,
          total === 0 && styles.emptyRatingDistributionTrack,
        )}
      >
        {total > 0
          ? bins.map((bin, index) => (
              <span
                key={bin.key}
                {...stylex.props(
                  styles.ratingDistributionSegment(shares[index] ?? 0),
                  bandFillStyles[bin.fill],
                )}
              />
            ))
          : null}
      </span>
      {showCounts && total > 0 ? (
        <span
          {...stylex.props(
            foundationStyles.metadata,
            styles.ratingDistributionCounts,
          )}
        >
          {bins.map((bin, index) => (
            <span
              key={bin.key}
              title={`${bin.count}`}
              {...stylex.props(
                styles.ratingDistributionCount(shares[index] ?? 0),
              )}
            >
              {bin.count.toLocaleString("en-US")}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function bandFillForKey(key: RatingBand): BandFill {
  if (key === "mediocre") return 1;
  if (key === "good") return 2;
  if (key === "very_good") return 3;
  if (key === "outstanding") return 4;
  return 5;
}

function getRatingBins(counts: RatingCounts): RatingBin[] {
  return RATING_BANDS.map((band) => ({
    count: counts[band.key] ?? 0,
    fill: bandFillForKey(band.key),
    key: band.key,
    label: band.label,
  }));
}

const styles = stylex.create({
  summaryHeadline: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    marginTop: space.x3,
  },
  summaryLabel: {
    minWidth: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.05,
  },
  summaryValueGroup: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "baseline",
    gap: space.x1,
  },
  summaryValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "48px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
  },
  summaryScale: { color: colors.inkMuted },
  sources: {
    marginTop: space.x2,
    marginBottom: 0,
    color: colors.inkMuted,
  },
  distributionGroup: { marginTop: space.x4 },
  distributionLabel: { marginBottom: space.x2, color: colors.inkMuted },
  ratingDistribution: { display: "block", width: "100%" },
  ratingDistributionTrack: {
    display: "flex",
    height: "10px",
    alignItems: "center",
    gap: 0,
    overflow: "hidden",
    borderRadius: controlMetrics.radiusSmall,
  },
  emptyRatingDistributionTrack: { backgroundColor: colors.bandTrack },
  compactRatingDistributionTrack: { height: "4px" },
  ratingDistributionSegment: (share: number) => ({
    boxSizing: "border-box",
    minWidth: "3px",
    height: "100%",
    flexBasis: 0,
    flexGrow: share,
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: colors.ground,
  }),
  ratingDistributionCounts: {
    display: "flex",
    gap: "2px",
    marginTop: "5px",
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  ratingDistributionCount: (share: number) => ({
    minWidth: 0,
    overflow: "hidden",
    flexBasis: 0,
    flexGrow: share,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  ratingLockup: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "flex-end",
    flexDirection: "column",
    gap: "2px",
    whiteSpace: "nowrap",
  },
  ratingLabel: {
    color: colors.accentDeep,
    fontFamily: fonts.display,
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  smallRatingLabel: {
    fontSize: "13px",
    lineHeight: 1.2,
  },
  largeRatingLabel: {
    fontSize: "20px",
    lineHeight: 1.1,
  },
  tastingRatingRange: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
    letterSpacing: "normal",
    lineHeight: 1.3,
  },
  smallTastingRatingRange: { fontSize: "12px" },
  largeTastingRatingRange: { fontSize: "15px" },
  reviewScore: { marginLeft: "auto" },
  reviewScoreValueGroup: {
    display: "inline-flex",
    alignItems: "baseline",
    color: colors.ink,
    fontFamily: fonts.display,
  },
  reviewScoreValue: {
    fontSize: "32px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
    [COMPACT]: { fontSize: "26px" },
  },
  smallReviewScoreValue: {
    fontSize: "18px",
    [COMPACT]: { fontSize: "18px" },
  },
  largeReviewScoreValue: {
    fontSize: "40px",
    [COMPACT]: { fontSize: "36px" },
  },
  reviewScoreScale: {
    marginLeft: "3px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: "normal",
    lineHeight: 1.45,
  },
  smallReviewScoreScale: { fontSize: "12px" },
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
  bottleRatings: {
    display: "inline-flex",
    width: "92px",
    minWidth: 0,
    flexShrink: 0,
    flexDirection: "column",
    alignItems: "flex-end",
    gap: space.x1,
    textAlign: "right",
    [COMPACT]: { width: "80px" },
  },
  compactCopy: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: "2px",
  },
  compactLabel: {
    width: "100%",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.15,
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  compactValue: {
    flexShrink: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
    [COMPACT]: { fontSize: "18px" },
  },
  compactDistribution: {
    display: "block",
    width: "100%",
  },
  band1Fill: { backgroundColor: colors.band1 },
  band2Fill: { backgroundColor: colors.band2 },
  band3Fill: { backgroundColor: colors.band3 },
  band4Fill: { backgroundColor: colors.band4 },
  band5Fill: { backgroundColor: colors.band5 },
});

const bandFillStyles = {
  1: styles.band1Fill,
  2: styles.band2Fill,
  3: styles.band3Fill,
  4: styles.band4Fill,
  5: styles.band5Fill,
} satisfies Record<BandFill, stylex.StyleXStyles>;
