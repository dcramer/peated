import {
  buildBottleClassificationArtifacts,
  createAuditBottleResult,
} from "@peated/bottle-classifier/contract";
import { runBottleAudit as auditBottleWithServerAdapters } from "@peated/server/agents/bottleClassifier/service";
import config from "@peated/server/config";
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
  config.BOTTLE_CHECK_MODERATOR_VISIBILITY = false;
  config.BOTTLE_CHECK_SHADOW_GENERATION = false;
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

test("Bottle audit requires moderator access", async ({ fixtures }) => {
  config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;
  config.BOTTLE_CHECK_SHADOW_GENERATION = true;
  const bottle = await fixtures.Bottle();
  const user = await fixtures.User({ mod: false, admin: false });

  const error = await waitError(
    routerClient.bottleChecks.audit(
      { bottle: bottle.id },
      { context: { user } },
    ),
  );

  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  expect(auditBottleWithServerAdapters).not.toHaveBeenCalled();
});

test("Bottle history requires moderator access", async ({ fixtures }) => {
  config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;
  const bottle = await fixtures.Bottle();
  const user = await fixtures.User({ mod: false, admin: false });

  const error = await waitError(
    routerClient.bottleChecks.history(
      { bottle: bottle.id },
      { context: { user } },
    ),
  );

  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
});

test("Bottle audit is hidden unless visibility and shadow generation are enabled", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const moderator = await fixtures.User({ mod: true });
  config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;

  const error = await waitError(
    routerClient.bottleChecks.audit(
      { bottle: bottle.id },
      { context: { user: moderator } },
    ),
  );

  expect(error).toMatchInlineSnapshot(`[Error: The resource was not found.]`);
  expect(auditBottleWithServerAdapters).not.toHaveBeenCalled();
});

test("Bottle audit persists and returns a clean moderator check", async ({
  fixtures,
}) => {
  config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;
  config.BOTTLE_CHECK_SHADOW_GENERATION = true;
  const bottle = await fixtures.Bottle();
  const moderator = await fixtures.User({ mod: true });
  vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
    result: cleanAuditResult(),
    modelMetadata: null,
  });

  const result = await routerClient.bottleChecks.audit(
    { bottle: bottle.id, note: "Confirm the label." },
    { context: { user: moderator } },
  );

  expect(result).toMatchObject({
    intent: "audit_bottle",
    origin: "moderator",
    bottleId: bottle.id,
    output: {
      summary: "The Bottle identity and catalog fields are supported.",
      findings: [],
    },
    operations: [],
  });
  expect(result).not.toHaveProperty("inputSnapshot");
  expect(result).not.toHaveProperty("artifacts");
  expect(result).not.toHaveProperty("modelMetadata");
  expect(result).not.toHaveProperty("subjectKey");
  expect(result).not.toHaveProperty("backgroundEventKey");
  expect(auditBottleWithServerAdapters).toHaveBeenCalledWith({
    bottleId: bottle.id,
    origin: "moderator",
    note: "Confirm the label.",
  });
  expect(
    await db.query.bottleChecks.findFirst({
      where: eq(bottleChecks.id, result.id),
    }),
  ).toMatchObject({ id: result.id, origin: "moderator" });
});

test("Bottle history returns clean audits outside the actionable inbox", async ({
  fixtures,
}) => {
  config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;
  config.BOTTLE_CHECK_SHADOW_GENERATION = true;
  const bottle = await fixtures.Bottle();
  const moderator = await fixtures.User({ mod: true });
  vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
    result: cleanAuditResult(),
    modelMetadata: null,
  });

  const created = await routerClient.bottleChecks.audit(
    { bottle: bottle.id },
    { context: { user: moderator } },
  );
  const history = await routerClient.bottleChecks.history(
    { bottle: bottle.id },
    { context: { user: moderator } },
  );
  const inbox = await routerClient.bottleChecks.list(
    {},
    { context: { user: moderator } },
  );

  expect(history.results.map(({ id }) => id)).toEqual([created.id]);
  expect(inbox.results).toEqual([]);
});

test("Bottle details preserve an audit with a deleted Bottle reference", async ({
  fixtures,
}) => {
  config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;
  config.BOTTLE_CHECK_SHADOW_GENERATION = true;
  const bottle = await fixtures.Bottle();
  const moderator = await fixtures.User({ mod: true });
  vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
    result: cleanAuditResult(),
    modelMetadata: null,
  });

  const created = await routerClient.bottleChecks.audit(
    { bottle: bottle.id },
    { context: { user: moderator } },
  );
  await db
    .update(bottleChecks)
    .set({ bottleId: null })
    .where(eq(bottleChecks.id, created.id));

  const details = await routerClient.bottleChecks.details(
    { check: created.id },
    { context: { user: moderator } },
  );

  expect(details.check).toMatchObject({
    id: created.id,
    intent: "audit_bottle",
    bottleId: null,
    output: {
      summary: "The Bottle identity and catalog fields are supported.",
      findings: [],
    },
  });
  expect(details.reviewOperations).toEqual([]);
});
