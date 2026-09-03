import {
  ExternalReviewScoringPolicySchema,
  type ExternalReviewScoringPolicy,
} from "@peated/server/schemas";
import { convertExternalReviewScore } from "./scoring";

const policy: ExternalReviewScoringPolicy = {
  enabled: true,
  rules: [
    {
      scale: 10,
      guideUrl: "https://example.com/guide",
      explanation: "Test guide",
      from: null,
      until: null,
      points: [
        { source: 0, target: 0 },
        { source: 10, target: 100 },
      ],
    },
  ],
};

test.each([
  [0, 0],
  [8.7, 87],
  [8.75, 88],
  [10, 100],
])("converts %s/10 and rounds only the result", (value, expected) => {
  expect(
    convertExternalReviewScore({ value, scale: 10 }, null, policy),
  ).toMatchObject({ value: expected, reason: "counted" });
});

test("uses the site's table and never fills in scores outside it", () => {
  const five = {
    enabled: true,
    rules: [
      {
        ...policy.rules[0],
        scale: 5,
        points: [
          { source: 2, target: 70 },
          { source: 3, target: 82 },
          { source: 5, target: 98 },
        ],
      },
    ],
  };
  expect(
    convertExternalReviewScore({ value: 3.5, scale: 5 }, null, five).value,
  ).toBe(86);
  expect(
    convertExternalReviewScore({ value: 1, scale: 5 }, null, five).reason,
  ).toBe("outside_range");
  expect(
    convertExternalReviewScore({ value: 6, scale: 5 }, null, five).reason,
  ).toBe("outside_range");
  expect(
    convertExternalReviewScore({ value: 80, scale: 100 }, null, five).reason,
  ).toBe("unsupported_scale");
  expect(convertExternalReviewScore(null, null, five).reason).toBe("no_score");
});

test("preserves existing 100-point behavior until a site is reviewed, including zero", () => {
  expect(
    convertExternalReviewScore({ value: 0, scale: 100 }, null, null).value,
  ).toBe(0);
  expect(
    convertExternalReviewScore({ value: 87.5, scale: 100 }, null, null).value,
  ).toBeNull();
  expect(
    convertExternalReviewScore({ value: 9, scale: 10 }, null, null).reason,
  ).toBe("not_configured");
  expect(
    convertExternalReviewScore({ value: 90, scale: 100 }, null, {
      enabled: false,
      rules: [],
    }).reason,
  ).toBe("excluded");
});

test("uses separate guides before and after a change, excluding unknown dates", () => {
  const dated: ExternalReviewScoringPolicy = {
    enabled: true,
    rules: [
      { ...policy.rules[0], until: "2026-01-01" },
      {
        ...policy.rules[0],
        from: "2026-01-01",
        points: [
          { source: 0, target: 50 },
          { source: 10, target: 100 },
        ],
      },
    ],
  };
  expect(ExternalReviewScoringPolicySchema.safeParse(dated).success).toBe(true);
  expect(
    convertExternalReviewScore({ value: 8, scale: 10 }, "2025-12-31", dated)
      .value,
  ).toBe(80);
  expect(
    convertExternalReviewScore({ value: 8, scale: 10 }, "2026-01-01", dated)
      .value,
  ).toBe(90);
  expect(
    convertExternalReviewScore({ value: 8, scale: 10 }, null, dated).reason,
  ).toBe("outside_dates");
});

test("rejects overlapping dates, reversed tables, empty evidence, and unsafe links", () => {
  for (const rules of [
    [policy.rules[0], policy.rules[0]],
    [
      {
        ...policy.rules[0],
        points: [
          { source: 5, target: 90 },
          { source: 10, target: 80 },
        ],
      },
    ],
    [{ ...policy.rules[0], explanation: " " }],
    [{ ...policy.rules[0], guideUrl: "javascript:alert(1)" }],
    [{ ...policy.rules[0], from: "2026-01-01", until: "2025-01-01" }],
  ])
    expect(
      ExternalReviewScoringPolicySchema.safeParse({ enabled: true, rules })
        .success,
    ).toBe(false);
});
