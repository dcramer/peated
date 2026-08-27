import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../../styles/tokens.stylex";

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

function formatCount(count: number) {
  return count.toLocaleString("en-US");
}

const styles = stylex.create({
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
