import {
  buildBottleClassificationArtifacts,
  createAuditBottleResult,
} from "@peated/bottle-classifier/contract";
import { runBottleAudit as auditBottleWithServerAdapters } from "@peated/server/agents/bottleClassifier/service";
import { db } from "@peated/server/db";
import { bottleChecks } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@peated/server/agents/bottleClassifier/service", () => ({
  runBottleAudit: vi.fn(),
  classifyBottleReference: vi.fn(),
  identifyExistingBottleReference: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

function cleanAuditResult() {
  return createAuditBottleResult({
    summary: "The Bottle identity and catalog fields are supported.",
    proposedOperations: [],
    findings: [],
    artifacts: buildBottleClassificationArtifacts({}),
  });
}

async function findingAuditResult(bottleId: number) {
  const { getBottleClassifierContext } =
    await import("@peated/server/agents/bottleClassifier/contextAdapters");
  const bottleContext = await getBottleClassifierContext(bottleId);
  if (!bottleContext) {
    throw new Error(`Bottle ${bottleId} context was not found.`);
  }
  const { imageSources: _imageSources, ...contextFields } = bottleContext;

  return createAuditBottleResult({
    summary: "The Bottle needs moderator review.",
    proposedOperations: [],
    findings: [
      {
        scope: "bottle_group",
        summary: "The Bottle may belong to a different group.",
        evidenceRefs: [{ kind: "bottle", bottleId }],
      },
    ],
    artifacts: buildBottleClassificationArtifacts({
      bottleContexts: [{ ...contextFields, publicImages: [] }],
    }),
  });
}

test("Bottle audit requires moderator access", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  const user = await fixtures.User({ mod: false, admin: false });

  const error = await waitError(
    routerClient.audits.create({ bottle: bottle.id }, { context: { user } }),
  );

  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  expect(auditBottleWithServerAdapters).not.toHaveBeenCalled();
});

test("clean Bottle audit returns a transient result without persistence", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const moderator = await fixtures.User({ mod: true });
  vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
    result: cleanAuditResult(),
    modelMetadata: null,
  });

  const result = await routerClient.audits.create(
    { bottle: bottle.id, note: "Confirm the label." },
    { context: { user: moderator } },
  );

  expect(result).toEqual({
    status: "clean",
    summary: "The Bottle identity and catalog fields are supported.",
  });
  expect(auditBottleWithServerAdapters).toHaveBeenCalledWith({
    bottleId: bottle.id,
    origin: "moderator",
    note: "Confirm the label.",
  });
  expect(
    await db.query.bottleChecks.findMany({
      where: eq(bottleChecks.bottleId, bottle.id),
    }),
  ).toEqual([]);
});

test("actionable Bottle audit persists one current review", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const moderator = await fixtures.User({ mod: true });
  vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
    result: await findingAuditResult(bottle.id),
    modelMetadata: null,
  });

  const first = await routerClient.audits.create(
    { bottle: bottle.id },
    { context: { user: moderator } },
  );
  const second = await routerClient.audits.create(
    { bottle: bottle.id },
    { context: { user: moderator } },
  );

  expect(first).toMatchObject({
    status: "needs_review",
    audit: {
      intent: "audit_bottle",
      origin: "moderator",
      bottleId: bottle.id,
      output: {
        summary: "The Bottle needs moderator review.",
      },
    },
  });
  expect(second).toMatchObject({
    status: "needs_review",
    audit: { id: first.status === "needs_review" ? first.audit.id : -1 },
  });
  expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(1);
  expect(
    await db.query.bottleChecks.findMany({
      where: eq(bottleChecks.bottleId, bottle.id),
    }),
  ).toHaveLength(1);
});
