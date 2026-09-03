import type {
  ExternalReviewScoreContribution,
  ExternalReviewScoringPolicy,
} from "@peated/server/schemas/externalReviewScoring";

export type NativeReviewScore = { value: number; scale: number };

/** Ratings owns conversion; publisher values remain untouched. Date ends are exclusive. */
export function convertExternalReviewScore(
  native: NativeReviewScore | null,
  publishedAt: string | Date | null,
  policy: ExternalReviewScoringPolicy | null,
): ExternalReviewScoreContribution {
  const excluded = (
    reason: ExternalReviewScoreContribution["reason"],
  ): ExternalReviewScoreContribution => ({
    value: null,
    reason,
    guideUrl: null,
  });
  if (!native) return excluded("no_score");
  if (
    !Number.isFinite(native.value) ||
    !Number.isFinite(native.scale) ||
    native.scale <= 0 ||
    native.value < 0 ||
    native.value > native.scale
  )
    return excluded("outside_range");
  if (!policy) {
    // Ratings keeps the shipped 100-point rule until the source is reviewed.
    return native.scale === 100 && Number.isInteger(native.value)
      ? { value: native.value, reason: "counted", guideUrl: null }
      : excluded("not_configured");
  }
  if (!policy.enabled) return excluded("excluded");
  const rules = policy.rules.filter((rule) => rule.scale === native.scale);
  if (!rules.length) return excluded("unsupported_scale");
  const date =
    publishedAt === null
      ? null
      : new Date(publishedAt).toISOString().slice(0, 10);
  const rule = rules.find(
    (rule) =>
      (!rule.from && !rule.until) ||
      (date !== null &&
        (!rule.from || date >= rule.from) &&
        (!rule.until || date < rule.until)),
  );
  if (!rule) return excluded("outside_dates");
  const upperIndex = rule.points.findIndex(
    (point) => native.value <= point.source,
  );
  if (upperIndex < 0 || native.value < rule.points[0].source)
    return excluded("outside_range");
  const upper = rule.points[upperIndex];
  const lower = rule.points[Math.max(0, upperIndex - 1)];
  const value =
    upper.source === native.value
      ? upper.target
      : lower.target +
        ((native.value - lower.source) * (upper.target - lower.target)) /
          (upper.source - lower.source);
  return {
    value: Math.round(value),
    reason: "counted",
    guideUrl: rule.guideUrl,
  };
}
