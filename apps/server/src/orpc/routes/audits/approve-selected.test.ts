import type { ProposedOperation } from "@peated/bottle-classifier";
import { getBottleClassifierContext } from "@peated/server/agents/bottleClassifier/contextAdapters";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import * as schema from "@peated/server/db/schema";
import {
  bottleChecks,
  bottleOperations,
  entities,
  storePriceMatchAttempts,
  storePriceMatchProposals,
} from "@peated/server/db/schema";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import { approveBottleOperations } from "@peated/server/lib/bottleOperationModeration";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { describe, expect, test } from "vitest";

async function createStorePriceUpdateEntityCheck({
  entity,
  nextName,
  price,
  storePrice,
}: {
  entity: { id: number; name: string };
  nextName: string;
  price: { id: number; name: string };
  storePrice: { attemptId: number };
}) {
  const proposal: ProposedOperation = {
    type: "update_entity",
    input: {
      entityId: entity.id,
      patch: { name: nextName },
    },
    rationale: "The evidence confirms the corrected Entity name.",
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
  return await createBottleCheck({
    intent: "resolve_reference",
    sourceKind: "store_price",
    sourceId: price.id,
    input: {
      reference: { id: price.id, name: price.name },
    },
    result: {
      status: "classified",
      decision: {
        action: "no_match",
        candidateBottleIds: [],
        matchedBottleId: null,
        proposedBottle: null,
      },
      proposedOperations: [proposal],
      findings: [],
      artifacts,
    },
    storePrice,
  });
}

async function inspectedBottleContext(bottleId: number) {
  const context = await getBottleClassifierContext(bottleId);
  if (!context) throw new Error(`Missing Bottle context for ${bottleId}`);
  const { imageSources: _imageSources, ...fields } = context;
  return { ...fields, publicImages: [] };
}

describe("POST /audits/{audit}/operations/approve", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const error = await waitError(() =>
      routerClient.audits.approveSelected(
        { audit: 1, operationIds: [1] },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
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
    const operation = created.check.operations[0]!;

    const details = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );
    expect(details.reviewOperations).toMatchObject([
      {
        operationId: operation.id,
        approvalReady: true,
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
    expect(details.reviewOperations[0]?.review).not.toHaveProperty(
      "stateToken",
    );
    expect(details.audit.operations[0]).not.toHaveProperty("stateToken");

    expect(
      await routerClient.audits.approveSelected(
        {
          audit: created.check.id,
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

  test("applies a Bottle relationship to an inspected Entity that lacks the role", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const producer = await fixtures.Entity({
      name: "Shared Producer Relationship Test",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      name: "Open Day Relationship Test",
      brandId: producer.id,
    });
    const proposal: ProposedOperation = {
      type: "update_bottle",
      input: {
        bottleId: bottle.id,
        patch: {
          shared: {
            bottler: { kind: "existing", entityId: producer.id },
          },
        },
      },
      rationale: "The inspected release is bottled by its producer.",
      evidenceRefs: [
        { kind: "bottle", bottleId: bottle.id },
        { kind: "entity", entityId: producer.id },
      ],
    };
    const created = await createBottleCheck({
      intent: "audit_bottle",
      input: { bottleId: bottle.id, origin: "moderator" },
      result: {
        summary: "Assign the evidenced bottler.",
        proposedOperations: [proposal],
        findings: [],
        artifacts: {
          bottleContexts: [await inspectedBottleContext(bottle.id)],
          resolvedEntities: [{ entityId: producer.id, name: producer.name }],
          entityContexts: [
            {
              entityId: producer.id,
              name: producer.name,
              shortName: producer.shortName,
              roles: producer.type,
              website: producer.website,
              country: null,
              region: null,
              yearEstablished: producer.yearEstablished,
              aliases: [],
              relatedBottles: [],
            },
          ],
        },
      },
    });
    expect(created.check.operations).toEqual([
      expect.objectContaining({ status: "pending_review" }),
    ]);
    const bottleOperation = created.check.operations[0]!;

    expect(
      await routerClient.audits.approveSelected(
        {
          audit: created.check.id,
          operationIds: [bottleOperation.id],
        },
        { context: { user: moderator } },
      ),
    ).toEqual({
      results: [
        {
          operationId: bottleOperation.id,
          status: "applied",
          error: null,
        },
      ],
    });
    expect(
      await db.query.bottleGroups.findFirst({
        where: (groups, { eq }) => eq(groups.id, bottle.groupId as number),
      }),
    ).toMatchObject({ bottlerId: producer.id });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, producer.id),
      }),
    ).toMatchObject({
      type: expect.arrayContaining(["brand", "bottler", "distiller"]),
    });
  });

  test("blocks a destination identity update selected with an Entity merge", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const source = await fixtures.Entity({
      name: "Route Merge Source",
      type: ["distiller"],
    });
    const destination = await fixtures.Entity({
      name: "Route Merge Destination",
      type: ["brand"],
    });
    const bottle = await fixtures.Bottle({ brandId: destination.id });
    const proposals: ProposedOperation[] = [
      {
        type: "update_entity",
        input: {
          entityId: destination.id,
          patch: { roles: ["brand", "bottler"] },
        },
        rationale: "The official source confirms the destination roles.",
        evidenceRefs: [{ kind: "entity", entityId: destination.id }],
      },
      {
        type: "merge_entities",
        input: {
          sourceEntityId: source.id,
          destinationEntityId: destination.id,
        },
        rationale: "The inspected records identify one producer.",
        evidenceRefs: [
          { kind: "entity", entityId: source.id },
          { kind: "entity", entityId: destination.id },
        ],
      },
    ];
    const artifacts = {
      resolvedEntities: [source, destination].map((entity) => ({
        entityId: entity.id,
        name: entity.name,
      })),
      entityContexts: [source, destination].map((entity) => ({
        entityId: entity.id,
        name: entity.name,
        shortName: entity.shortName,
        roles: entity.type,
        website: entity.website,
        country: null,
        region: null,
        yearEstablished: entity.yearEstablished,
        aliases: [],
        relatedBottles: [],
      })),
    };
    const created = await createBottleCheck({
      intent: "audit_bottle",
      input: { bottleId: bottle.id, origin: "moderator" },
      result: {
        summary: "The Entity proposals conflict.",
        proposedOperations: proposals,
        findings: [],
        artifacts,
      },
    });
    expect(created.check.operations).toEqual([
      expect.objectContaining({
        status: "blocked",
        preparationError: expect.objectContaining({
          code: "direct_conflict",
        }),
      }),
      expect.objectContaining({
        status: "blocked",
        preparationError: expect.objectContaining({
          code: "direct_conflict",
        }),
      }),
    ]);
    const operationIds = created.check.operations.map(({ id }) => id);

    expect(
      await routerClient.audits.approveSelected(
        { audit: created.check.id, operationIds },
        { context: { user: moderator } },
      ),
    ).toMatchObject({
      results: [
        { operationId: operationIds[0], status: "blocked" },
        { operationId: operationIds[1], status: "blocked" },
      ],
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, destination.id),
      }),
    ).toMatchObject({ type: ["brand"] });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, source.id),
      }),
    ).toMatchObject({ id: source.id });
  });

  test("keeps supplemental work advisory until the primary store-price decision is complete", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Primary Gate Before" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Primary Gate Listing",
    });
    const [primaryProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "no_match",
        status: "pending_review",
      })
      .returning();
    const [primaryAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: primaryProposal!.id,
        proposalType: "no_match",
        initialStatus: "pending_review",
      })
      .returning();
    const created = await createStorePriceUpdateEntityCheck({
      entity,
      nextName: "Primary Gate After",
      price,
      storePrice: { attemptId: primaryAttempt!.id },
    });
    const operation = created.check.operations[0]!;

    const pendingDetails = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );
    expect(pendingDetails.reviewOperations).toMatchObject([
      {
        operationId: operation.id,
        approvalReady: false,
        review: {
          status: "pending_review",
          type: "update_entity",
          preview: {
            before: { name: "Primary Gate Before" },
            after: { name: "Primary Gate After" },
          },
        },
      },
    ]);

    expect(
      await routerClient.audits.approveSelected(
        { audit: created.check.id, operationIds: [operation.id] },
        { context: { user: moderator } },
      ),
    ).toEqual({
      results: [
        {
          operationId: operation.id,
          status: "pending_review",
          error: expect.stringContaining(
            "primary store-price decision is complete",
          ),
        },
      ],
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Primary Gate Before" });
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({ status: "pending_review", reviewedById: null });

    await db
      .update(storePriceMatchProposals)
      .set({ status: "ignored" })
      .where(eq(storePriceMatchProposals.id, primaryProposal!.id));
    await db
      .update(storePriceMatchAttempts)
      .set({ finalStatus: "ignored" })
      .where(eq(storePriceMatchAttempts.id, primaryAttempt!.id));

    await db
      .update(storePriceMatchProposals)
      .set({ status: "pending_review" })
      .where(eq(storePriceMatchProposals.id, primaryProposal!.id));
    await db.insert(storePriceMatchAttempts).values({
      priceId: price.id,
      proposalId: primaryProposal!.id,
      proposalType: "no_match",
      initialStatus: "pending_review",
    });

    const terminalDetails = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );
    expect(terminalDetails.reviewOperations).toMatchObject([
      { operationId: operation.id, approvalReady: true },
    ]);
    expect(
      await routerClient.audits.approveSelected(
        { audit: created.check.id, operationIds: [operation.id] },
        { context: { user: moderator } },
      ),
    ).toEqual({
      results: [{ operationId: operation.id, status: "applied", error: null }],
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Primary Gate After" });
  });

  test("keeps an older check protected by its linked attempt after the shared proposal changes", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const duplicate = await fixtures.Bottle({ name: "Attempt Duplicate" });
    const originalTarget = await fixtures.Bottle({
      name: "Attempt Original Target",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Attempt Authority Listing",
    });
    const [sharedProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "match_existing",
        status: "approved",
        suggestedBottleId: originalTarget.id,
      })
      .returning();
    const [originalAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: sharedProposal!.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        finalStatus: "approved",
        suggestedBottleId: originalTarget.id,
      })
      .returning();
    const proposal: ProposedOperation = {
      type: "merge_bottles",
      input: {
        sourceBottleId: duplicate.id,
        destinationBottleId: originalTarget.id,
      },
      rationale: "The inspected Bottles are exact duplicates.",
      evidenceRefs: [
        { kind: "bottle", bottleId: duplicate.id },
        { kind: "bottle", bottleId: originalTarget.id },
      ],
    };
    const artifacts = {
      bottleContexts: [
        await inspectedBottleContext(duplicate.id),
        await inspectedBottleContext(originalTarget.id),
      ],
    };
    const created = await createBottleCheck({
      intent: "resolve_reference",
      sourceKind: "store_price",
      sourceId: price.id,
      input: { reference: { id: price.id, name: price.name } },
      result: {
        status: "classified",
        decision: {
          action: "match",
          candidateBottleIds: [duplicate.id, originalTarget.id],
          matchedBottleId: originalTarget.id,
          proposedBottle: null,
        },
        proposedOperations: [proposal],
        findings: [],
        artifacts,
      },
      storePrice: { attemptId: originalAttempt!.id },
    });
    const operation = created.check.operations[0]!;

    await db
      .update(storePriceMatchProposals)
      .set({ suggestedBottleId: duplicate.id })
      .where(eq(storePriceMatchProposals.id, sharedProposal!.id));
    await db.insert(storePriceMatchAttempts).values({
      priceId: price.id,
      proposalId: sharedProposal!.id,
      proposalType: "match_existing",
      initialStatus: "pending_review",
      finalStatus: "approved",
      suggestedBottleId: duplicate.id,
    });

    const details = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );
    expect(details.reviewOperations).toMatchObject([
      {
        operationId: operation.id,
        review: { status: "pending_review", type: "merge_bottles" },
      },
    ]);
  });

  test("fails closed when deleting the linked primary attempt clears the check link", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Deleted Link Before" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Deleted Link Listing",
    });
    const [primaryProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "no_match",
        status: "ignored",
      })
      .returning();
    const [primaryAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: primaryProposal!.id,
        proposalType: "no_match",
        initialStatus: "pending_review",
        finalStatus: "ignored",
      })
      .returning();
    const created = await createStorePriceUpdateEntityCheck({
      entity,
      nextName: "Deleted Link After",
      price,
      storePrice: { attemptId: primaryAttempt!.id },
    });
    const operation = created.check.operations[0]!;

    await db
      .delete(storePriceMatchAttempts)
      .where(eq(storePriceMatchAttempts.id, primaryAttempt!.id));

    expect(
      await db.query.bottleChecks.findFirst({
        where: eq(bottleChecks.id, created.check.id),
      }),
    ).toMatchObject({
      storePriceMatchAttemptId: null,
      storePriceMatchProposalId: primaryProposal!.id,
    });

    const details = await routerClient.audits.details(
      { audit: created.check.id },
      { context: { user: moderator } },
    );
    expect(details.reviewOperations).toMatchObject([
      { operationId: operation.id, approvalReady: false },
    ]);
    expect(
      await routerClient.audits.approveSelected(
        { audit: created.check.id, operationIds: [operation.id] },
        { context: { user: moderator } },
      ),
    ).toEqual({
      results: [
        {
          operationId: operation.id,
          status: "pending_review",
          error: expect.stringContaining(
            "primary store-price decision is complete",
          ),
        },
      ],
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Deleted Link Before" });
  });

  test("fails closed when the linked attempt no longer matches the check proposal and price", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Mismatched Link Before" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Original Linked Listing",
    });
    const otherPrice = await fixtures.StorePrice({
      bottleId: null,
      name: "Mismatched Linked Listing",
    });
    const [primaryProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "no_match",
        status: "ignored",
      })
      .returning();
    const [primaryAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: primaryProposal!.id,
        proposalType: "no_match",
        initialStatus: "pending_review",
        finalStatus: "ignored",
      })
      .returning();
    const [otherProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: otherPrice.id,
        proposalType: "no_match",
        status: "ignored",
      })
      .returning();
    const created = await createStorePriceUpdateEntityCheck({
      entity,
      nextName: "Mismatched Link After",
      price,
      storePrice: { attemptId: primaryAttempt!.id },
    });
    const operation = created.check.operations[0]!;

    await db
      .update(bottleChecks)
      .set({
        sourceId: String(otherPrice.id),
        storePriceMatchProposalId: otherProposal!.id,
      })
      .where(eq(bottleChecks.id, created.check.id));

    expect(
      await routerClient.audits.approveSelected(
        { audit: created.check.id, operationIds: [operation.id] },
        { context: { user: moderator } },
      ),
    ).toEqual({
      results: [
        {
          operationId: operation.id,
          status: "pending_review",
          error: expect.stringContaining(
            "primary store-price decision is complete",
          ),
        },
      ],
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Mismatched Link Before" });
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({ status: "pending_review", reviewedById: null });
  });

  test("revalidates a failed operation retry after its linked attempt is deleted", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Retry Gate Before" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Retry Gate Listing",
    });
    const [primaryProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "no_match",
        status: "ignored",
      })
      .returning();
    const [primaryAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: primaryProposal!.id,
        proposalType: "no_match",
        initialStatus: "pending_review",
        finalStatus: "ignored",
      })
      .returning();
    const created = await createStorePriceUpdateEntityCheck({
      entity,
      nextName: "Retry Gate After",
      price,
      storePrice: { attemptId: primaryAttempt!.id },
    });
    const operation = created.check.operations[0]!;
    await db
      .update(bottleOperations)
      .set({
        status: "failed",
        error: "Transient failure.",
        reviewedById: moderator.id,
        reviewedAt: new Date(),
      })
      .where(eq(bottleOperations.id, operation.id));
    await db
      .delete(storePriceMatchAttempts)
      .where(eq(storePriceMatchAttempts.id, primaryAttempt!.id));

    expect(
      await routerClient.audits.retry(
        { audit: created.check.id, operation: operation.id },
        { context: { user: moderator } },
      ),
    ).toEqual({
      operationId: operation.id,
      status: "failed",
      error: expect.stringContaining(
        "primary store-price decision is complete",
      ),
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: "Retry Gate Before" });
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({ status: "failed", reviewedById: moderator.id });
  });

  test("bounds concurrent primary deletion and operation approval without deadlock", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity({ name: "Concurrent Gate Before" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Concurrent Gate Listing",
    });
    const [primaryProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "no_match",
        status: "ignored",
      })
      .returning();
    const [primaryAttempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: primaryProposal!.id,
        proposalType: "no_match",
        initialStatus: "pending_review",
        finalStatus: "ignored",
      })
      .returning();
    const created = await createStorePriceUpdateEntityCheck({
      entity,
      nextName: "Concurrent Gate After",
      price,
      storePrice: { attemptId: primaryAttempt!.id },
    });
    const operation = created.check.operations[0]!;
    const concurrentPool = new pg.Pool({
      ...getPostgresConnectionConfig(),
      application_name: "peated-vitest",
      max: 2,
      options: "-c statement_timeout=3000",
    });
    const concurrentDatabase = drizzle(concurrentPool, { schema });

    const [approval] = await Promise.all([
      approveBottleOperations(
        {
          checkId: created.check.id,
          operationIds: [operation.id],
        },
        moderator,
        concurrentDatabase,
      ),
      concurrentDatabase
        .delete(storePriceMatchProposals)
        .where(eq(storePriceMatchProposals.id, primaryProposal!.id)),
    ]).finally(async () => {
      await concurrentPool.end();
    });

    const result = approval[0]!;
    if (result.status === "applied") {
      expect(result).toEqual({
        operationId: operation.id,
        status: "applied",
        error: null,
      });
    } else {
      expect(result).toEqual({
        operationId: operation.id,
        status: "pending_review",
        error: expect.stringMatching(
          /primary (?:store-price decision is complete|decision linkage changed)/,
        ),
      });
    }
    const [persistedEntity, persistedOperation, persistedCheck] =
      await Promise.all([
        db.query.entities.findFirst({
          where: eq(entities.id, entity.id),
        }),
        db.query.bottleOperations.findFirst({
          where: eq(bottleOperations.id, operation.id),
        }),
        db.query.bottleChecks.findFirst({
          where: eq(bottleChecks.id, created.check.id),
        }),
      ]);
    expect(persistedEntity?.name).toBe(
      result.status === "applied"
        ? "Concurrent Gate After"
        : "Concurrent Gate Before",
    );
    expect(persistedOperation?.status).toBe(result.status);
    expect(persistedCheck).toMatchObject({
      storePriceMatchAttemptId: null,
      storePriceMatchProposalId: null,
    });
    await expect(
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, primaryProposal!.id),
      }),
    ).resolves.toBeUndefined();
  });
});
