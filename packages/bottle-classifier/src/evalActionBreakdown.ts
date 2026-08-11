export const EVAL_ACTIONS = [
  "match",
  "create_bottle",
  "no_match",
  "ignored",
] as const;

export type EvalAction = (typeof EVAL_ACTIONS)[number];

export type EvalActionBreakdown = {
  compared: number;
  matrix: Record<EvalAction, Record<EvalAction, number>>;
};

function emptyActionCounts(): Record<EvalAction, number> {
  return {
    match: 0,
    create_bottle: 0,
    no_match: 0,
    ignored: 0,
  };
}

export function createEvalActionBreakdown(): EvalActionBreakdown {
  return {
    compared: 0,
    matrix: {
      match: emptyActionCounts(),
      create_bottle: emptyActionCounts(),
      no_match: emptyActionCounts(),
      ignored: emptyActionCounts(),
    },
  };
}

export function recordEvalAction(
  breakdown: EvalActionBreakdown,
  expected: EvalAction,
  actual: EvalAction,
): void {
  breakdown.compared += 1;
  breakdown.matrix[expected][actual] += 1;
}

export function formatEvalActionBreakdown(
  breakdown: EvalActionBreakdown,
): string | null {
  if (breakdown.compared === 0) {
    return null;
  }

  const falseNoMatches =
    breakdown.matrix.match.no_match + breakdown.matrix.create_bottle.no_match;
  const falsePositiveAcceptances =
    breakdown.matrix.no_match.match +
    breakdown.matrix.no_match.create_bottle +
    breakdown.matrix.ignored.match +
    breakdown.matrix.ignored.create_bottle;
  const rows = EVAL_ACTIONS.map(
    (expected) =>
      `| ${expected} | ${EVAL_ACTIONS.map((actual) => breakdown.matrix[expected][actual]).join(" | ")} |`,
  );

  return [
    "Classifier action confusion",
    "",
    `Compared cases with an explicit expected action: ${breakdown.compared}`,
    `False no_match results: ${falseNoMatches}`,
    `False-positive accepted results: ${falsePositiveAcceptances}`,
    "",
    "| Expected \\ Actual | match | create_bottle | no_match | ignored |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows,
  ].join("\n");
}
