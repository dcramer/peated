import type { ProposedOperation } from "@peated/bottle-classifier";
import { buildBottleClassificationArtifacts } from "@peated/bottle-classifier/contract";
import { getBottleClassifierContext } from "@peated/server/agents/bottleClassifier/contextAdapters";
import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  entities,
} from "@peated/server/db/schema";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("Audit review action routes", () => {
  async function createEntityUpdateCheck(
    fixtures: {
      Entity: (input: { name: string }) => Promise<{
        id: number;
        kind: typeof entities.$inferSelect.kind;
        name: string;
      }>;
      Bottle: (input: { brandId: number }) => Promise<{ id: number }>;
    },
    name = "Reviewed Entity",
  ) {
    const entity = await fixtures.Entity({ name });
    const bottle = await fixtures.Bottle({ brandId: entity.id });
    const proposal: ProposedOperation = {
      type: "update_entity",
      input: {
        entityId: entity.id,
        patch: { name: `${name} Corrected` },
      },
      rationale: "The evidence confirms the corrected Entity name.",
      evidenceRefs: [{ kind: "entity", entityId: entity.id }],
    };
    const artifacts = {
      resolvedEntities: [
        { entityId: entity.id, name: entity.name, kind: entity.kind! },
      ],
      entityContexts: [
        {
          entityId: entity.id,
          name: entity.name,
          shortName: null,
          kind: entity.kind!,
          website: null,
          country: null,
          region: null,
          yearEstablished: null,
          aliases: [],
          relatedBottles: [],
        },
      ],
    };
    const created = await createBottleCheck({
      intent: "audit_bottle",
      input: { bottleId: bottle.id, origin: "moderator" },
      result: {
        summary: "Update the Entity.",
        proposedOperations: [proposal],
        findings: [],
        artifacts,
      },
    });
    return {
      check: created.check,
      entity,
      operation: created.check.operations[0]!,
    };
  }

  test("keeps version-1 checks visible, opaque, and closable", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const created = await createEntityUpdateCheck(fixtures, "Legacy Entity");
    await db
      .update(bottleChecks)
      .set({
        schemaVersion: 1,
        output: {
          findings: { legacyFinding: true },
          legacySummary: ["not", "the", "current", "shape"],
        },
      })
      .where(eq(bottleChecks.id, created.check.id));
    await db
      .update(bottleOperations)
      .set({
        // SAFETY: This test stores a retired proposal shape to exercise version handling.
        proposal: {
          legacyOperation: "rename_entity",
          arguments: [created.entity.id, "Legacy Entity Corrected"],
        } as never,
      })
      .where(eq(bottleOperations.id, created.operation.id));

    const details = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );

    expect(details.audit).toMatchObject({
      id: created.check.id,
      schemaSupported: false,
      schemaVersion: 1,
      canClose: true,
      operationCount: 1,
      operations: [],
    });
    expect("output" in details.audit).toBe(false);
    expect(details.reviewOperations).toEqual([]);

    const listed = await routerClient.audits.list(
      {},
      { context: { user: moderator } },
    );
    expect(listed.results).toContainEqual(
      expect.objectContaining({
        id: created.check.id,
        schemaSupported: false,
      }),
    );

    const closed = await routerClient.audits.close(
      {
        audit: created.check.id,
        reason: "dismissed",
        note: "The old check cannot be reviewed with the current schema.",
      },
      { context: { user: moderator } },
    );
    expect(closed).toMatchObject({
      id: created.check.id,
      schemaSupported: false,
      closeReason: "dismissed",
      operations: [],
    });
    expect(closed.closedAt).not.toBeNull();
  });

  test("reject-selected preserves its structured reason and note", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const created = await createEntityUpdateCheck(fixtures);

    const result = await routerClient.audits.rejectSelected(
      {
        audit: created.check.id,
        operationIds: [created.operation.id],
        reason: "resolved_manually",
        note: "Fixed in the Entity editor.",
      },
      { context: { user: moderator } },
    );
    const details = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );

    expect(result).toEqual({
      results: [
        {
          operationId: created.operation.id,
          status: "rejected",
          error: null,
        },
      ],
    });
    expect(details.audit.operations[0]).toMatchObject({
      status: "rejected",
      rejectionReason: "resolved_manually",
      reviewerNote: "Fixed in the Entity editor.",
    });
    expect(details.reviewOperations).toEqual([
      {
        operationId: created.operation.id,
        review: null,
        approvalReady: false,
      },
    ]);
  });

  test("keeps a newly blocked live preview advisory without mutating its pending status", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const created = await createEntityUpdateCheck(
      fixtures,
      "Blocked Preview Entity",
    );
    await db
      .update(entities)
      .set({ name: "Blocked Preview Entity Corrected" })
      .where(eq(entities.id, created.entity.id));

    const details = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );

    expect(details.reviewOperations).toMatchObject([
      {
        operationId: created.operation.id,
        approvalReady: false,
        review: {
          status: "blocked",
          preparationError: { code: "no_changes" },
        },
      },
    ]);
    expect(details.audit.operations).toMatchObject([
      { id: created.operation.id, status: "pending_review" },
    ]);
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, created.operation.id),
      }),
    ).toMatchObject({ status: "pending_review" });
  });

  test("close records one structured disposition for finding-only work", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const bottleContext = await getBottleClassifierContext(bottle.id);
    if (!bottleContext) throw new Error("Expected Bottle context.");
    const { imageSources: _imageSources, ...bottleContextFields } =
      bottleContext;
    const created = await createBottleCheck({
      intent: "audit_bottle",
      input: { bottleId: bottle.id, origin: "moderator" },
      result: {
        summary: "The Bottle Group needs manual review.",
        proposedOperations: [],
        findings: [
          {
            scope: "bottle_group",
            summary: "The Bottle may belong in another group.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
          },
        ],
        artifacts: buildBottleClassificationArtifacts({
          bottleContexts: [{ ...bottleContextFields, publicImages: [] }],
        }),
      },
    });

    const result = await routerClient.audits.close(
      {
        audit: created.check.id,
        reason: "resolved_manually",
        note: "Moved through the existing Bottle editor.",
      },
      { context: { user: moderator } },
    );

    expect(result).toMatchObject({
      id: created.check.id,
      closeReason: "resolved_manually",
      closeNote: "Moved through the existing Bottle editor.",
      closedById: moderator.id,
      closedAt: expect.any(String),
    });
  });

  test("close rejects a check while an operation is pending", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const created = await createEntityUpdateCheck(fixtures);

    const error = await waitError(
      routerClient.audits.close(
        { audit: created.check.id, reason: "dismissed" },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle check 1 still has pending or applying operations.]`,
    );
  });

  test("retry dispatches the same failed operation id and reports its result", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const created = await createEntityUpdateCheck(
      fixtures,
      "Retry Route Entity",
    );
    await db
      .update(bottleOperations)
      .set({
        status: "failed",
        error: "Transient failure.",
        reviewedById: moderator.id,
        reviewedAt: new Date(),
      })
      .where(eq(bottleOperations.id, created.operation.id));

    const result = await routerClient.audits.retry(
      { audit: created.check.id, operation: created.operation.id },
      { context: { user: moderator } },
    );

    expect(result).toEqual({
      operationId: created.operation.id,
      status: "applied",
      error: null,
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, created.entity.id),
      }),
    ).toMatchObject({ name: "Retry Route Entity Corrected" });
  });
});
