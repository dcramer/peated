import { z } from "zod";

export const REVIEW_SCORING_CONFIG_KEY = "review-scoring";

const DateSchema = z.iso.date();
const ScorePointSchema = z
  .object({
    source: z
      .number({ error: "Enter a site score." })
      .finite()
      .nonnegative("Site scores cannot be negative."),
    target: z
      .number({ error: "Enter a Peated score." })
      .int("Use a whole Peated score.")
      .min(0, "Peated scores start at 0.")
      .max(100, "Peated scores cannot exceed 100."),
  })
  .strict();

export const ExternalReviewScoreRuleSchema = z
  .object({
    scale: z
      .number({ error: "Enter how many points the site scores out of." })
      .finite()
      .positive("The site must score out of a number greater than 0."),
    guideUrl: z
      .url({ error: "Enter the site’s scoring guide URL." })
      .refine(
        (value) => /^https?:\/\//.test(value),
        "Use an HTTP or HTTPS guide URL.",
      ),
    explanation: z
      .string()
      .trim()
      .min(1, "Explain why these scores match.")
      .max(2000),
    from: DateSchema.nullable(),
    until: DateSchema.nullable(),
    points: z
      .array(ScorePointSchema)
      .min(2, "Add at least two scores to the table.")
      .max(101),
  })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.from && rule.until && rule.from >= rule.until) {
      ctx.addIssue({
        code: "custom",
        path: ["until"],
        message: "End date must be after the start date.",
      });
    }
    for (let index = 0; index < rule.points.length; index++) {
      const point = rule.points[index];
      const previous = rule.points[index - 1];
      if (
        point.source > rule.scale ||
        (previous &&
          (point.source <= previous.source || point.target < previous.target))
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["points", index],
          message:
            "List site scores from low to high. Peated scores must stay the same or increase, and site scores cannot exceed the site's scale.",
        });
      }
    }
  });

export const ExternalReviewScoringPolicySchema = z
  .object({
    enabled: z.boolean(),
    rules: z.array(ExternalReviewScoreRuleSchema).max(20),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (policy.enabled && !policy.rules.length) {
      ctx.addIssue({
        code: "custom",
        path: ["rules"],
        message:
          "Add at least one score scale before including this site's scores.",
      });
    }
    policy.rules.forEach((rule, index) => {
      if (
        policy.rules
          .slice(0, index)
          .some(
            (other) =>
              other.scale === rule.scale &&
              (!rule.from || !other.until || rule.from < other.until) &&
              (!other.from || !rule.until || other.from < rule.until),
          )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", index],
          message: "Date ranges for the same scale cannot overlap.",
        });
      }
    });
  });

export const ExternalReviewScoringSettingsSchema = z
  .object({
    version: z.number().int().nonnegative(),
    policy: ExternalReviewScoringPolicySchema.nullable(),
    recomputePending: z.boolean(),
  })
  .strict();

export const ExternalReviewScoreContributionSchema = z.object({
  value: z.number().int().min(0).max(100).nullable(),
  reason: z.enum([
    "counted",
    "no_score",
    "not_configured",
    "excluded",
    "unsupported_scale",
    "outside_dates",
    "outside_range",
    "not_public",
    "unmatched",
  ]),
  guideUrl: z.url().nullable(),
});

export type ExternalReviewScoringPolicy = z.infer<
  typeof ExternalReviewScoringPolicySchema
>;
export type ExternalReviewScoreRule = z.infer<
  typeof ExternalReviewScoreRuleSchema
>;
export type ExternalReviewScoringSettings = z.infer<
  typeof ExternalReviewScoringSettingsSchema
>;
export type ExternalReviewScoreContribution = z.infer<
  typeof ExternalReviewScoreContributionSchema
>;
