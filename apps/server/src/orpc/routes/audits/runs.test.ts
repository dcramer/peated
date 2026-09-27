import {
  BottleClassificationResultSchema,
  type ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier";
import { persistReviewBottleCheck } from "@peated/server/lib/bottleReferenceResolution";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { expect, test } from "vitest";

function buildRun(name: string, candidateBottleId: number) {
  const input: ClassifyBottleReferenceInput = {
    reference: { name, url: "https://example.com/review" },
    candidateExpansion: "open",
  };
  return {
    input,
    result: BottleClassificationResultSchema.parse({
      status: "classified",
      decision: {
        action: "no_match",
        rationale: "test fixture",
        candidateBottleIds: [candidateBottleId],
        identityScope: "product",
        observation: null,
      },
      artifacts: {
        extractedIdentity: null,
        candidates: [
          { bottleId: candidateBottleId, fullName: "Candidate Bottle" },
        ],
        searchEvidence: [],
        resolvedEntities: [],
      },
    }),
  };
}

test("requires a moderator", async ({ fixtures }) => {
  const user = await fixtures.User();

  const err = await waitError(
    routerClient.audits.runs(
      { sourceKind: "review", sourceId: 1 },
      { context: { user } },
    ),
  );

  expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
});

test("returns the saved runs for one source, newest first", async ({
  fixtures,
}) => {
  const mod = await fixtures.User({ mod: true });
  const bottle = await fixtures.Bottle();

  await persistReviewBottleCheck({
    reviewId: 501,
    classification: buildRun("First Title", bottle.id),
  });
  await persistReviewBottleCheck({
    reviewId: 501,
    classification: buildRun("Second Title", bottle.id),
  });
  await persistReviewBottleCheck({
    reviewId: 502,
    classification: buildRun("Other Review", bottle.id),
  });

  const { results } = await routerClient.audits.runs(
    { sourceKind: "review", sourceId: 501 },
    { context: { user: mod } },
  );

  expect(results.map((run) => run.input.reference)).toEqual([
    expect.objectContaining({ name: "Second Title" }),
    expect.objectContaining({ name: "First Title" }),
  ]);
  expect(results[0]).toMatchObject({
    intent: "resolve_reference",
    sourceKind: "review",
    sourceId: "501",
    output: expect.objectContaining({
      decision: expect.objectContaining({ action: "no_match" }),
    }),
    artifacts: expect.objectContaining({
      candidates: [expect.objectContaining({ bottleId: bottle.id })],
    }),
  });
});
