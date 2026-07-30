import type { ProposedOperation } from "@peated/bottle-classifier";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import { prepareProposals } from "@peated/server/lib/bottleOperationReview";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

describe("POST /bottle-checks/{check}/operations/approve", () => {
  const originalExecutionFlag = config.BOTTLE_CHECK_EXECUTION;
  const originalVisibilityFlag = config.BOTTLE_CHECK_MODERATOR_VISIBILITY;

  beforeEach(() => {
    config.BOTTLE_CHECK_EXECUTION = true;
    config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;
  });

  afterEach(() => {
    config.BOTTLE_CHECK_EXECUTION = originalExecutionFlag;
    config.BOTTLE_CHECK_MODERATOR_VISIBILITY = originalVisibilityFlag;
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const error = await waitError(() =>
      routerClient.bottleChecks.approveSelected(
        { check: 1, operationIds: [1] },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("honors the execution feature flag", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    config.BOTTLE_CHECK_EXECUTION = false;

    await expect(
      routerClient.bottleChecks.approveSelected(
        { check: 1, operationIds: [1] },
        { context: { user: moderator } },
      ),
    ).rejects.toThrow("Bottle operation execution is not enabled");
  });

  test("returns a live preview and then applies through the moderation service", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Route Entity Before" });
    const bottle = await fixtures.Bottle({ brandId: entity.id });
    const proposal: ProposedOperation = {
      type: "update_entity",
      input: {
        entityId: entity.id,
        patch: { name: "Route Entity After" },
      },
      rationale: "The inspected evidence confirms the canonical Entity name.",
      evidenceRefs: [{ kind: "entity", entityId: entity.id }],
    };
    const artifacts = {
      resolvedEntities: [{ entityId: entity.id, name: entity.name }],
      entityContexts: [
        {
          entityId: entity.id,
          name: entity.name,
          shortName: null,
          roles: [],
          website: null,
          country: null,
          region: null,
          yearEstablished: null,
          aliases: [],
          relatedBottles: [],
        },
      ],
    };
    const [prepared] = await prepareProposals({
      proposals: [proposal],
      artifacts,
      capabilities: {
        update_bottle: true,
        merge_bottles: true,
        update_entity: true,
        merge_entities: true,
      },
    });
    const created = await createBottleCheck({
      intent: "audit_bottle",
      input: { bottleId: bottle.id, origin: "moderator" },
      result: {
        summary: "Update the Entity.",
        proposedOperations: [proposal],
        findings: [],
        artifacts,
      },
      operations: [prepared!],
    });
    const operation = created.check.operations[0]!;

    const details = await routerClient.bottleChecks.details(
      { check: created.check.id },
      { context: { user: moderator } },
    );
    expect(details.reviewOperations).toMatchObject([
      {
        operationId: operation.id,
        review: {
          id: operation.id,
          status: "pending_review",
          type: "update_entity",
          preview: {
            before: { name: "Route Entity Before" },
            after: { name: "Route Entity After" },
          },
        },
      },
    ]);

    expect(
      await routerClient.bottleChecks.approveSelected(
        {
          check: created.check.id,
          operationIds: [operation.id],
        },
        { context: { user: moderator } },
      ),
    ).toEqual({
      results: [{ operationId: operation.id, status: "applied", error: null }],
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Route Entity After" });
  });
});
