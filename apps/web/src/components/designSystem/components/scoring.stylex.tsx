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
    key: "veryGood",
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
export type RatingGrain = "band" | "point";
export type RatingValue =
  | { band: RatingBand; grain: "band" }
  | { grain: "point"; point: number }
  | null;
export type BandCounts = Partial<Record<RatingBand, number>>;

export function getRatingBandForPoint(point: number) {
  return RATING_BANDS.find((band) => point >= band.min && point <= band.max);
}

export type ScoreProps = {
  /** Number of real typed points in the median. */
  count: number;
  /** Highest real typed point in the pool. */
  high?: number | null;
  /** Lowest real typed point in the pool. */
  low?: number | null;
  /** Whole-number median of real typed points. */
  median?: number | null;
  /** Minimum point count before the median is shown. */
  minimumCount?: number;
  /** Optional caller-owned action when the median is withheld. */
  contributionAction?: ReactNode;
};

/** Shows the median of real typed points. Band picks never create a number. */
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
              / 100 · median of {formatCount(count)} points
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
              ? "No points yet."
              : `Only ${formatCount(count)} ${count === 1 ? "point" : "points"} so far.`}
          </span>
          {contributionAction}
          <span {...stylex.props(styles.scoreRule)}>
            Band picks are ranges. They never convert into points.
          </span>
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

/** Shows band picks as five fixed bins, or three drawing blocks in narrow rows. */
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
  /** A picked band or exact typed point. */
  value: Exclude<RatingValue, null>;
};

/** Shows one rating as five cells. Exact points add a tick inside the lit cell. */
export function BandMark({ value }: BandMarkProps) {
  const point = value.grain === "point" ? clampPoint(value.point) : null;
  const band =
    value.grain === "band"
      ? RATING_BANDS.find((candidate) => candidate.key === value.band)
      : getRatingBandForPoint(clampPoint(value.point));
  const label =
    point === null ? `${band?.label} · ${band?.range}` : `${point} / 100`;

  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      {...stylex.props(styles.bandMark)}
    >
      {RATING_BANDS.map((candidate) => {
        const selected = candidate.key === band?.key;
        const tickPosition =
          selected && point !== null
            ? ((point - candidate.min) /
                Math.max(1, candidate.max - candidate.min)) *
              100
            : null;

        return (
          <span
            key={candidate.key}
            {...stylex.props(
              styles.bandMarkCell,
              selected && bandFillStyles[bandFillForKey(candidate.key)],
            )}
          >
            {tickPosition !== null ? (
              <span {...stylex.props(styles.bandMarkTick(tickPosition))} />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export type CommunityScoreProps = {
  /** Number of member scores included in the average. */
  count: number;
  /** Average of member scores recorded on Peated's 100-point scale. */
  score: number;
};

/** Displays Peated's numeric 100-point community measure. */
export function CommunityScore({ count, score }: CommunityScoreProps) {
  return (
    <div
      aria-label={`Community score ${score.toFixed(1)} out of 100 from ${count} ${count === 1 ? "score" : "scores"}`}
      role="img"
      {...stylex.props(styles.measure)}
    >
      <div {...stylex.props(styles.measureHeading)}>
        <strong {...stylex.props(styles.communityScoreValue)}>
          {score.toFixed(1)}
        </strong>
        <span {...stylex.props(styles.measureMetadata)}>
          / 100 · {formatCount(count)} {count === 1 ? "score" : "scores"}
        </span>
      </div>
    </div>
  );
}

export type Verdict = "pass" | "sip" | "savor";

export type VerdictDistributionProps = Record<Verdict, number>;

const VERDICTS = ["pass", "sip", "savor"] as const;

const labels = {
  pass: "Pass",
  sip: "Sip",
  savor: "Savor",
} satisfies Record<Verdict, string>;

/** Displays the fixed pass-to-savor distribution without creating an average. */
export function VerdictDistribution({
  pass,
  sip,
  savor,
}: VerdictDistributionProps) {
  const counts = { pass, sip, savor } satisfies Record<Verdict, number>;
  const total = pass + sip + savor;

  return (
    <div
      data-state={total === 0 ? "empty" : "populated"}
      {...stylex.props(styles.measure)}
    >
      <div {...stylex.props(styles.measureHeading)}>
        <strong {...stylex.props(styles.verdictTotal)}>
          {formatCount(total)}
        </strong>
        <span {...stylex.props(styles.measureMetadata)}>
          community {total === 1 ? "rating" : "ratings"}
        </span>
      </div>
      <div
        aria-label={VERDICTS.map(
          (verdict) => `${labels[verdict]} ${formatCount(counts[verdict])}`,
        ).join(", ")}
        role="img"
        {...stylex.props(
          styles.distribution,
          total === 0 && styles.emptyDistribution,
        )}
      >
        {total > 0
          ? VERDICTS.map((verdict) => (
              <span
                key={verdict}
                {...stylex.props(
                  styles.distributionSegment(counts[verdict]),
                  distributionStyles[verdict],
                )}
              />
            ))
          : null}
      </div>
      <div {...stylex.props(styles.verdictCounts)}>
        {VERDICTS.map((verdict) => (
          <span
            key={verdict}
            {...stylex.props(styles.verdictCount, verdictCountStyles[verdict])}
          >
            {labels[verdict].toLowerCase()} {formatCount(counts[verdict])}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Shows the same verdict aggregate in a compact table or list cell. */
export function VerdictDistributionBar({
  pass,
  sip,
  savor,
}: VerdictDistributionProps) {
  const counts = { pass, sip, savor } satisfies Record<Verdict, number>;
  const total = pass + sip + savor;

  return (
    <span
      aria-label={VERDICTS.map(
        (verdict) => `${labels[verdict]} ${formatCount(counts[verdict])}`,
      ).join(", ")}
      data-state={total === 0 ? "empty" : "populated"}
      role="img"
      {...stylex.props(
        styles.compactDistribution,
        total === 0 && styles.emptyDistribution,
      )}
    >
      {total > 0
        ? VERDICTS.map((verdict) => (
            <span
              key={verdict}
              {...stylex.props(
                styles.distributionSegment(counts[verdict]),
                distributionStyles[verdict],
              )}
            />
          ))
        : null}
    </span>
  );
}

export type VerdictMarkProps = {
  showLabel?: boolean;
  verdict: Verdict;
};

/** Marks one member's verdict by position on the shared pass-to-savor track. */
export function VerdictMark({ showLabel = false, verdict }: VerdictMarkProps) {
  return (
    <span
      aria-label={`Community verdict: ${labels[verdict]}`}
      data-verdict={verdict}
      role="img"
      {...stylex.props(styles.verdictMark)}
    >
      <span aria-hidden="true" {...stylex.props(styles.verdictTrack)}>
        <span
          {...stylex.props(styles.activeVerdict, verdictMarkStyles[verdict])}
        />
      </span>
      {showLabel ? (
        <span {...stylex.props(styles.verdictLabel)}>{labels[verdict]}</span>
      ) : null}
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
  if (key === "veryGood") return "mid";
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
        count: counts.veryGood ?? 0,
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
  scoreRule: {
    width: "100%",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.45,
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
  bandMarkTick: (position: number) => ({
    position: "absolute",
    top: "-2px",
    bottom: "-2px",
    left: `calc(${Math.min(100, Math.max(0, position))}% - 1px)`,
    width: "2px",
    backgroundColor: colors.ink,
  }),
  measure: {
    width: "100%",
  },
  measureHeading: {
    display: "flex",
    alignItems: "baseline",
    columnGap: space.x2,
    rowGap: space.x1,
    flexWrap: "wrap",
  },
  measureMetadata: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.45,
  },
  communityScoreValue: {
    color: colors.accent,
    fontFamily: fonts.display,
    fontSize: "34px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  verdictTotal: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  distribution: {
    display: "flex",
    height: "10px",
    gap: "2px",
    marginTop: space.x3,
  },
  compactDistribution: {
    display: "flex",
    width: "64px",
    height: "8px",
    gap: "2px",
  },
  emptyDistribution: {
    borderRadius: "1px",
    backgroundColor: colors.verdictTrack,
  },
  distributionSegment: (count: number) => ({
    minWidth: 0,
    flexBasis: 0,
    flexGrow: count,
    borderRadius: "1px",
  }),
  passSegment: {
    backgroundColor: colors.verdictPass,
  },
  sipSegment: {
    backgroundColor: colors.accentDeep,
  },
  savorSegment: {
    backgroundColor: colors.accent,
  },
  verdictCounts: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    columnGap: space.x2,
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.45,
  },
  verdictCount: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  passCount: {
    textAlign: "left",
  },
  sipCount: {
    textAlign: "center",
  },
  savorCount: {
    textAlign: "right",
  },
  verdictMark: {
    display: "inline-flex",
    alignItems: "center",
    columnGap: space.x3,
  },
  verdictTrack: {
    position: "relative",
    display: "inline-block",
    width: "60px",
    height: "6px",
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: "1px",
    backgroundColor: colors.verdictTrack,
  },
  activeVerdict: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "20px",
    borderRadius: "1px",
  },
  passMark: {
    left: 0,
    backgroundColor: colors.verdictPass,
  },
  sipMark: {
    left: "20px",
    backgroundColor: colors.accentDeep,
  },
  savorMark: {
    left: "40px",
    backgroundColor: colors.accent,
  },
  verdictLabel: {
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
  },
});

const bandFillStyles = {
  high: styles.highBandFill,
  low: styles.lowBandFill,
  mid: styles.midBandFill,
} satisfies Record<BandFill, stylex.StyleXStyles>;

const distributionStyles = {
  pass: styles.passSegment,
  sip: styles.sipSegment,
  savor: styles.savorSegment,
} satisfies Record<Verdict, stylex.StyleXStyles>;

const verdictMarkStyles = {
  pass: styles.passMark,
  sip: styles.sipMark,
  savor: styles.savorMark,
} satisfies Record<Verdict, stylex.StyleXStyles>;

const verdictCountStyles = {
  pass: styles.passCount,
  sip: styles.sipCount,
  savor: styles.savorCount,
} satisfies Record<Verdict, stylex.StyleXStyles>;
