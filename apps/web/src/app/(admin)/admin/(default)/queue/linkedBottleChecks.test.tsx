import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { LinkedBottleCheckDetails } from "./linkedBottleChecks";

type Details = Parameters<typeof LinkedBottleCheckDetails>[0]["details"];

test("renders a linked Bottle check as a read-only review link", () => {
  const details = {
    check: {
      id: 41,
      intent: "resolve_reference",
      origin: null,
      sourceKind: "store_price",
      sourceId: "510",
      bottleId: null,
      subjectKey: "resolve_reference:store_price:510",
      backgroundEventKey: null,
      schemaSupported: true,
      schemaVersion: 1,
      output: {
        status: "classified",
        decision: {
          action: "match",
          rationale: "The listing matched without supplemental cleanup.",
          candidateBottleIds: [202],
          identityScope: "product",
          observation: null,
          matchedBottleId: 202,
          proposedBottle: null,
        },
        findings: [],
      },
      model: "test-model",
      error: null,
      storePriceMatchProposalId: 12,
      storePriceMatchAttemptId: 13,
      closedById: null,
      closeReason: null,
      closeNote: null,
      createdAt: "2026-07-30T12:00:00.000Z",
      completedAt: "2026-07-30T12:01:00.000Z",
      closedAt: null,
      operations: [],
    },
    reviewOperations: [],
  } satisfies Details;

  const html = renderToStaticMarkup(
    <LinkedBottleCheckDetails details={details} />,
  );

  expect(html).toContain('data-bottle-check-id="41"');
  expect(html).toContain("Supplemental Bottle check");
  expect(html).toContain("/bottle-checks/41");
  expect(html).toContain("The listing matched without supplemental cleanup.");
  expect(html).not.toContain(">Select<");
});
