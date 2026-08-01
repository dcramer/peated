import type { ProposedOperation } from "@peated/bottle-classifier";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  actors,
  bottleOperations,
  bottleTombstones,
  bottles,
  changes,
  entities,
} from "@peated/server/db/schema";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import {
  BottleOperationExecutionResultSchema,
  executePreparedOperationInTransaction,
} from "@peated/server/lib/bottleOperationExecution";
import {
  prepareOperation,
  prepareOperationForExecution,
} from "@peated/server/lib/bottleOperationReview";
import * as workerClient from "@peated/server/worker/client";
import { and, desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

function artifacts({
  bottleIds = [],
  inspectedEntities = [],
}: {
  bottleIds?: number[];
  inspectedEntities?: Array<{ id: number; name: string }>;
}) {
  return {
    candidates: bottleIds.map((bottleId) => ({
      bottleId,
      fullName: `Inspected Bottle ${bottleId}`,
    })),
    resolvedEntities: inspectedEntities.map((entity) => ({
      entityId: entity.id,
      name: entity.name,
    })),
    entityContexts: inspectedEntities.map((entity) => ({
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
    })),
    searchEvidence: [],
    bottleContexts: bottleIds.map((bottleId) => ({
      bottleId,
      fullName: `Inspected Bottle ${bottleId}`,
      groupId: 1,
      shared: {
        name: `Bottle ${bottleId}`,
        statedAge: null,
        series: null,
        category: null,
        brand: { entityId: 1, name: "Test Brand" },
        distillers: [],
        bottler: null,
      },
      exact: {
        edition: null,
        statedAge: null,
        abv: null,
        singleCask: null,
        caskStrength: null,
        vintageYear: null,
        releaseYear: null,
        caskSize: null,
        caskType: null,
        caskFill: null,
      },
      siblings: [],
      aliases: [],
      observations: [],
      publicImages: [],
    })),
  };
}

async function persistApplyingOperation({
  approvingModeratorId,
  bottleId,
  context,
  proposal,
}: {
  approvingModeratorId: number;
  bottleId: number;
  context: {
    artifacts: ReturnType<typeof artifacts>;
  };
  proposal: ProposedOperation;
}) {
  const created = await createBottleCheck({
    intent: "audit_bottle",
    input: {
      bottleId,
      origin: "moderator",
    },
    result: {
      summary: "Execute the approved catalog operation.",
      proposedOperations: [proposal],
      findings: [],
      artifacts: context.artifacts,
    },
    model: "test-model",
  });
  const operation = created.check.operations[0]!;
  if (operation.status === "blocked") {
    throw new Error(
      `Expected operation preparation to succeed: ${JSON.stringify(operation)}`,
    );
  }
  const [applying] = await db
    .update(bottleOperations)
    .set({
      status: "applying",
      reviewedById: approvingModeratorId,
      reviewedAt: new Date(),
    })
    .where(eq(bottleOperations.id, operation.id))
    .returning();
  if (!applying) throw new Error("Expected persisted applying operation.");

  return {
    id: applying.id,
    proposal: applying.proposal,
  };
}

async function executePersistedOperation({
  approvingModerator,
  context,
  operation,
}: {
  approvingModerator: User;
  context: {
    artifacts: ReturnType<typeof artifacts>;
  };
  operation: { id: number; proposal: unknown };
}) {
  return await db.transaction(async (transaction) => {
    const prepared = await prepareOperationForExecution({
      operation,
      ...context,
      database: transaction,
    });
    return await executePreparedOperationInTransaction({
      transaction,
      operationId: operation.id,
      prepared,
      approvingModerator,
    });
  });
}

describe("Bottle operation execution", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
    vi.mocked(workerClient.pushUniqueJob)
      .mockReset()
      .mockResolvedValue(undefined);
  });

  test("keeps persisted execution results strict", () => {
    expect(
      BottleOperationExecutionResultSchema.safeParse({
        type: "update_entity",
        status: "applied",
        entityId: 1,
        changed: true,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  test("executes a Bottle update from the same canonical input used by its preview", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({
      mod: true,
      username: "bottle-operation-approver",
    });
    const bottle = await fixtures.Bottle({
      name: "Operation Expression",
    });
    const proposal: ProposedOperation = {
      type: "update_bottle",
      input: {
        bottleId: bottle.id,
        patch: {
          shared: {
            brand: {
              kind: "create",
              entity: {
                name: "Execution Created Brand",
                roles: ["brand"],
              },
            },
          },
        },
      },
      rationale: "The label identifies a missing Brand.",
      evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
    };
    const context = {
      artifacts: artifacts({ bottleIds: [bottle.id] }),
    };
    const operation = await persistApplyingOperation({
      approvingModeratorId: moderator.id,
      bottleId: bottle.id,
      context,
      proposal,
    });
    const preview = await prepareOperation({ operation, ...context });
    if (preview.status === "blocked" || preview.type !== "update_bottle") {
      throw new Error("Expected a prepared Bottle update.");
    }

    const execution = await executePersistedOperation({
      operation,
      approvingModerator: moderator,
      context,
    });
    await execution.afterCommit();
    const { result } = execution;

    expect(result).toMatchObject({
      type: "update_bottle",
      status: "applied",
      bottleId: bottle.id,
      groupId: bottle.groupId,
      changed: true,
    });
    expect(preview.preview.entityCreations).toEqual([
      expect.objectContaining({
        kind: "create",
        entity: expect.objectContaining({ name: "Execution Created Brand" }),
      }),
    ]);
    const createdBrand = await db.query.entities.findFirst({
      where: eq(entities.name, "Execution Created Brand"),
    });
    expect(createdBrand).toMatchObject({ type: ["brand"] });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({
      brandId: createdBrand!.id,
      fullName: preview.preview.after.fullName,
    });
  });

  test("executes an exact Bottle merge and returns the canonical survivor", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const source = await fixtures.Bottle({ name: "Execution Merge Source" });
    const destination = await fixtures.Bottle({
      name: "Execution Merge Destination",
    });
    const proposal: ProposedOperation = {
      type: "merge_bottles",
      input: {
        sourceBottleId: source.id,
        destinationBottleId: destination.id,
      },
      rationale: "The inspected records are the same marketed Bottle.",
      evidenceRefs: [
        { kind: "bottle", bottleId: source.id },
        { kind: "bottle", bottleId: destination.id },
      ],
    };
    const context = {
      artifacts: artifacts({ bottleIds: [source.id, destination.id] }),
    };
    const operation = await persistApplyingOperation({
      approvingModeratorId: moderator.id,
      bottleId: destination.id,
      context,
      proposal,
    });
    const preview = await prepareOperation({ operation, ...context });
    if (preview.status === "blocked" || preview.type !== "merge_bottles") {
      throw new Error("Expected a prepared Bottle merge.");
    }

    const execution = await executePersistedOperation({
      operation,
      approvingModerator: moderator,
      context,
    });
    await execution.afterCommit();
    const { result } = execution;

    expect(result).toEqual({
      type: "merge_bottles",
      status: "applied",
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      changed: true,
    });
    if (result.type !== "merge_bottles") {
      throw new Error("Expected a Bottle merge result.");
    }
    expect(result.destinationBottleId).toBe(
      preview.preview.outcome.survivorBottleId,
    );
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, source.id),
      }),
    ).toMatchObject({ newBottleId: destination.id });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, destination.id),
      }),
    ).toMatchObject({ id: destination.id });
  });

  test("executes an Entity update with the approving moderator as actor", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({
      mod: true,
      username: "entity-operation-approver",
    });
    const entity = await fixtures.Entity({
      name: "Execution Entity Before",
      type: ["brand"],
    });
    const subjectBottle = await fixtures.Bottle({ brandId: entity.id });
    const proposal: ProposedOperation = {
      type: "update_entity",
      input: {
        entityId: entity.id,
        patch: { name: "Execution Entity After" },
      },
      rationale: "The inspected evidence confirms the canonical Entity name.",
      evidenceRefs: [{ kind: "entity", entityId: entity.id }],
    };
    const context = {
      artifacts: artifacts({ inspectedEntities: [entity] }),
    };
    const operation = await persistApplyingOperation({
      approvingModeratorId: moderator.id,
      bottleId: subjectBottle.id,
      context,
      proposal,
    });
    const preview = await prepareOperation({ operation, ...context });
    if (preview.status === "blocked" || preview.type !== "update_entity") {
      throw new Error("Expected a prepared Entity update.");
    }

    const execution = await executePersistedOperation({
      operation,
      approvingModerator: moderator,
      context,
    });
    await execution.afterCommit();
    const { result } = execution;

    expect(result).toEqual({
      type: "update_entity",
      status: "applied",
      entityId: entity.id,
      changed: true,
    });
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, entity.id),
      }),
    ).toMatchObject({ name: preview.preview.after.name });
    const change = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectType, "entity"),
        eq(changes.objectId, entity.id),
      ),
      orderBy: desc(changes.id),
    });
    expect(
      await db.query.actors.findFirst({
        where: eq(actors.id, change!.actorId),
      }),
    ).toMatchObject({
      type: "user",
      userId: moderator.id,
      displayName: moderator.username,
    });
  });

  test("dispatches an approved Entity merge and leaves it applying", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const source = await fixtures.Entity({
      name: "Execution Entity Merge Source",
      type: ["distiller"],
    });
    const destination = await fixtures.Entity({
      name: "Execution Entity Merge Destination",
      type: ["brand"],
    });
    const subjectBottle = await fixtures.Bottle({
      brandId: destination.id,
      distillerIds: [source.id],
    });
    const proposal: ProposedOperation = {
      type: "merge_entities",
      input: {
        sourceEntityId: source.id,
        destinationEntityId: destination.id,
      },
      rationale: "The inspected Entities are exact duplicates.",
      evidenceRefs: [
        { kind: "entity", entityId: source.id },
        { kind: "entity", entityId: destination.id },
      ],
    };
    const context = {
      artifacts: artifacts({ inspectedEntities: [source, destination] }),
    };
    const operation = await persistApplyingOperation({
      approvingModeratorId: moderator.id,
      bottleId: subjectBottle.id,
      context,
      proposal,
    });

    const execution = await executePersistedOperation({
      operation,
      approvingModerator: moderator,
      context,
    });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
    await execution.afterCommit();
    const { result } = execution;

    expect(result).toEqual({
      type: "merge_entities",
      status: "applying",
      operationId: operation.id,
      sourceEntityId: source.id,
      destinationEntityId: destination.id,
      approvingModeratorId: moderator.id,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "MergeEntity",
      {
        operationId: operation.id,
        approvingModeratorId: moderator.id,
      },
      {
        jobId: `MergeEntity-operation-${operation.id}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    expect(
      await db.query.bottleOperations.findFirst({
        where: eq(bottleOperations.id, operation.id),
      }),
    ).toMatchObject({
      status: "applying",
      reviewedById: moderator.id,
      result: null,
    });
  });
});
