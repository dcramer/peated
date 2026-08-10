import { getBottleClassifierContext } from "@peated/server/agents/bottleClassifier/contextAdapters";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  collectionBottles,
  entities,
} from "@peated/server/db/schema";
import {
  prepareOperation,
  prepareOperationForExecution,
  prepareOperations,
  prepareProposals,
} from "@peated/server/lib/bottleOperationReview";
import { eq } from "drizzle-orm";

function artifacts({
  bottleIds = [],
  entities: inspectedEntities = [],
  candidateBottleIds = [],
  resolvedEntities = [],
  urls = [],
  bottleContexts = [],
}: {
  bottleIds?: number[];
  entities?: Array<{ id: number; name: string }>;
  candidateBottleIds?: number[];
  resolvedEntities?: Array<{ id: number; name: string }>;
  urls?: string[];
  bottleContexts?: Record<string, unknown>[];
}) {
  const inspectedBottleContexts = bottleIds.map((bottleId) => ({
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
  }));
  return {
    candidates: [...bottleIds, ...candidateBottleIds].map((bottleId) => ({
      bottleId,
      fullName: `Inspected Bottle ${bottleId}`,
    })),
    resolvedEntities: [...inspectedEntities, ...resolvedEntities].map(
      (entity) => ({
        entityId: entity.id,
        name: entity.name,
      }),
    ),
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
    searchEvidence: urls.length
      ? [
          {
            query: "review evidence",
            results: urls.map((url) => ({
              title: "Collected result",
              url,
            })),
          },
        ]
      : [],
    bottleContexts: [...inspectedBottleContexts, ...bottleContexts],
  };
}

async function bottleContext(bottleId: number) {
  const context = await getBottleClassifierContext(bottleId);
  if (!context) throw new Error(`Missing Bottle context for ${bottleId}`);
  const { imageSources: _imageSources, ...fields } = context;
  return { ...fields, publicImages: [] };
}

describe("Bottle operation review preparation", () => {
  test("prepares all four operation variants with correlated live previews", async ({
    fixtures,
  }) => {
    const bottleToUpdate = await fixtures.Bottle({
      name: "Original Expression",
    });
    const groupMember = await fixtures.BottleGroupMember({
      groupId: bottleToUpdate.groupId as number,
      edition: "Second Batch",
    });
    const mergeSource = await fixtures.Bottle({ name: "Merge Source" });
    const mergeDestination = await fixtures.Bottle({
      name: "Merge Destination",
    });
    const entityToUpdate = await fixtures.Entity({
      name: "Entity Before",
      shortName: null,
      type: ["brand"],
    });
    const entityMergeSource = await fixtures.Entity({
      name: "Entity Merge Source",
      type: ["distiller"],
    });
    const entityMergeDestination = await fixtures.Entity({
      name: "Entity Merge Destination",
      type: ["brand"],
    });

    const result = await prepareOperations({
      operations: [
        {
          id: 1,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: bottleToUpdate.id,
              patch: {
                brand: {
                  kind: "create",
                  entity: {
                    name: "Review Created Brand",
                    roles: ["brand"],
                  },
                },
              },
            },
            rationale: "The inspected label identifies the producer.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottleToUpdate.id }],
          },
        },
        {
          id: 2,
          proposal: {
            type: "merge_bottles",
            input: {
              sourceBottleId: mergeSource.id,
              destinationBottleId: mergeDestination.id,
            },
            rationale: "These records represent one exact marketed release.",
            evidenceRefs: [
              { kind: "bottle", bottleId: mergeSource.id },
              { kind: "bottle", bottleId: mergeDestination.id },
            ],
          },
        },
        {
          id: 3,
          proposal: {
            type: "update_entity",
            input: {
              entityId: entityToUpdate.id,
              patch: { shortName: "Entity After" },
            },
            rationale: "The official source uses this short name.",
            evidenceRefs: [{ kind: "entity", entityId: entityToUpdate.id }],
          },
        },
        {
          id: 4,
          proposal: {
            type: "merge_entities",
            input: {
              sourceEntityId: entityMergeSource.id,
              destinationEntityId: entityMergeDestination.id,
            },
            rationale: "Both inspected records identify the same producer.",
            evidenceRefs: [
              { kind: "entity", entityId: entityMergeSource.id },
              { kind: "entity", entityId: entityMergeDestination.id },
            ],
          },
        },
      ],
      artifacts: artifacts({
        bottleIds: [bottleToUpdate.id, mergeSource.id, mergeDestination.id],
        entities: [entityToUpdate, entityMergeSource, entityMergeDestination],
      }),
    });

    expect(result).toHaveLength(4);
    expect(result.map(({ status }) => status)).toEqual([
      "pending_review",
      "pending_review",
      "pending_review",
      "pending_review",
    ]);

    const bottleUpdate = result[0]!;
    expect(bottleUpdate).toMatchObject({
      type: "update_bottle",
      preview: {
        affectedBottles: {
          total: 2,
          sampleIds: expect.arrayContaining([
            bottleToUpdate.id,
            groupMember.id,
          ]),
          truncated: false,
        },
        entityCreations: [
          {
            kind: "create",
            entity: { name: "Review Created Brand", roles: ["brand"] },
          },
        ],
        warnings: expect.arrayContaining([
          expect.objectContaining({ code: "shared_group_fan_out" }),
          expect.objectContaining({ code: "creates_entity" }),
        ]),
      },
    });
    expect(result[1]).toMatchObject({
      type: "merge_bottles",
      preview: {
        outcome: {
          retiredBottleId: mergeSource.id,
          survivorBottleId: mergeDestination.id,
        },
      },
    });
    expect(result[2]).toMatchObject({
      type: "update_entity",
      preview: {
        before: { shortName: null },
        after: { shortName: "Entity After" },
        changedFields: ["shortName"],
      },
    });
    expect(result[3]).toMatchObject({
      type: "merge_entities",
      preview: {
        after: { roles: ["brand", "distiller"] },
        warnings: [
          expect.objectContaining({
            code: "role_union",
          }),
        ],
      },
    });
  });

  test("supports legacy blank distiller short names in Bottle update review state", async ({
    fixtures,
  }) => {
    const distiller = await fixtures.Entity({
      name: "Legacy Blank Short Name Distillery",
      shortName: "",
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      name: "Legacy Distiller Preview",
      distillerIds: [distiller.id],
    });

    const result = await prepareOperation({
      operation: {
        id: 5,
        proposal: {
          type: "update_bottle",
          input: {
            bottleId: bottle.id,
            patch: {
              category: "single_malt",
              distillers: [{ kind: "existing", entityId: distiller.id }],
            },
          },
          rationale:
            "The inspected evidence confirms the category and distiller.",
          evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
        },
      },
      artifacts: artifacts({
        bottleIds: [bottle.id],
        entities: [distiller],
      }),
    });

    expect(result).toMatchObject({
      status: "pending_review",
      type: "update_bottle",
      preview: {
        before: {
          shared: { distillers: [{ shortName: null }] },
        },
        after: {
          shared: { distillers: [{ shortName: null }] },
        },
      },
      stateToken: {
        referencedEntities: expect.arrayContaining([
          expect.objectContaining({
            entityId: distiller.id,
            shortName: "",
          }),
        ]),
      },
    });
  });

  test("supports legacy blank short names in Entity merge review state", async ({
    fixtures,
  }) => {
    const source = await fixtures.Entity({
      name: "Legacy Blank Merge Source",
      shortName: "",
      type: ["distiller"],
    });
    const destination = await fixtures.Entity({
      name: "Legacy Blank Merge Destination",
      type: ["brand"],
    });

    const result = await prepareOperation({
      operation: {
        id: 6,
        proposal: {
          type: "merge_entities",
          input: {
            sourceEntityId: source.id,
            destinationEntityId: destination.id,
          },
          rationale: "The inspected records identify the same producer.",
          evidenceRefs: [
            { kind: "entity", entityId: source.id },
            { kind: "entity", entityId: destination.id },
          ],
        },
      },
      artifacts: artifacts({ entities: [source, destination] }),
    });

    expect(result).toMatchObject({
      status: "pending_review",
      type: "merge_entities",
      preview: {
        source: { entityId: source.id, shortName: null },
      },
      stateToken: {
        source: { entityId: source.id, shortName: "" },
      },
    });
  });

  test("supports legacy blank short names in Entity update review state", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Legacy Blank Update Entity",
      shortName: "",
      type: ["brand"],
    });
    const context = { artifacts: artifacts({ entities: [entity] }) };

    const shortNameUpdate = await prepareOperation({
      operation: {
        id: 7,
        proposal: {
          type: "update_entity",
          input: {
            entityId: entity.id,
            patch: { shortName: "Legacy Update" },
          },
          rationale: "The inspected Entity uses this short name.",
          evidenceRefs: [{ kind: "entity", entityId: entity.id }],
        },
      },
      ...context,
    });
    const websiteUpdate = await prepareOperation({
      operation: {
        id: 8,
        proposal: {
          type: "update_entity",
          input: {
            entityId: entity.id,
            patch: { website: "https://legacy-update.example" },
          },
          rationale: "The inspected Entity uses this website.",
          evidenceRefs: [{ kind: "entity", entityId: entity.id }],
        },
      },
      ...context,
    });

    expect(shortNameUpdate).toMatchObject({
      status: "pending_review",
      type: "update_entity",
      preview: {
        before: { shortName: null },
        after: { shortName: "Legacy Update" },
      },
      stateToken: {
        fields: { shortName: "" },
      },
    });
    expect(websiteUpdate).toMatchObject({
      status: "pending_review",
      type: "update_entity",
      preview: {
        before: { shortName: null },
        after: { shortName: null },
      },
    });
  });

  test("reports merge membership and identity collisions as canonical merge warnings", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Membership Source" });
    const destination = await fixtures.Bottle({
      name: "Membership Destination",
    });
    const collection = await fixtures.Collection();
    await db.insert(collectionBottles).values([
      { collectionId: collection.id, bottleId: source.id },
      { collectionId: collection.id, bottleId: destination.id },
    ]);
    await fixtures.Flight({ bottles: [source.id, destination.id] });

    const sourceEntity = await fixtures.Entity({
      name: "Old Collision Brand",
      type: ["brand"],
    });
    const destinationEntity = await fixtures.Entity({
      name: "Surviving Collision Brand",
      type: ["brand"],
    });
    await fixtures.Bottle({
      brandId: sourceEntity.id,
      name: "Shared Identity",
    });
    await fixtures.Bottle({
      brandId: destinationEntity.id,
      name: "Shared Identity",
    });
    await fixtures.BottleSeries({
      brandId: sourceEntity.id,
      name: "Shared Series",
    });
    await fixtures.BottleSeries({
      brandId: destinationEntity.id,
      name: "Shared Series",
    });

    const result = await prepareOperations({
      operations: [
        {
          id: 10,
          proposal: {
            type: "merge_bottles",
            input: {
              sourceBottleId: source.id,
              destinationBottleId: destination.id,
            },
            rationale: "The inspected records are exact duplicates.",
            evidenceRefs: [
              { kind: "bottle", bottleId: source.id },
              { kind: "bottle", bottleId: destination.id },
            ],
          },
        },
        {
          id: 11,
          proposal: {
            type: "merge_entities",
            input: {
              sourceEntityId: sourceEntity.id,
              destinationEntityId: destinationEntity.id,
            },
            rationale: "The two Brand records identify one producer.",
            evidenceRefs: [
              { kind: "entity", entityId: sourceEntity.id },
              { kind: "entity", entityId: destinationEntity.id },
            ],
          },
        },
      ],
      artifacts: artifacts({
        bottleIds: [source.id, destination.id],
        entities: [sourceEntity, destinationEntity],
      }),
    });

    expect(result[0]).toMatchObject({
      type: "merge_bottles",
      preview: {
        membershipCollisions: { collections: 1, flights: 1 },
        warnings: [
          expect.objectContaining({ code: "consumer_memberships_collapse" }),
        ],
      },
    });
    expect(result[1]).toMatchObject({
      type: "merge_entities",
      preview: {
        collisions: { bottleIdentities: 1, series: 1 },
        warnings: expect.arrayContaining([
          expect.objectContaining({
            code: "bottle_identity_collision_resolved",
          }),
          expect.objectContaining({ code: "series_collision_resolved" }),
        ]),
      },
    });
  });

  test("blocks only canonical alias owners outside both merge groups", async ({
    fixtures,
  }) => {
    const sourceGroupBottle = await fixtures.Bottle({
      name: "Alias Review Source Group",
    });
    const source = await fixtures.BottleGroupMember({
      groupId: sourceGroupBottle.groupId!,
      edition: "Duplicate Release",
    });
    const destinationGroupBottle = await fixtures.Bottle({
      name: "Alias Review Destination Group",
    });
    const destination = await fixtures.BottleGroupMember({
      groupId: destinationGroupBottle.groupId!,
      edition: "Canonical Release",
    });
    const foreignOwner = await fixtures.Bottle({
      name: "Alias Review Foreign Owner",
    });
    const operation = {
      id: 12,
      proposal: {
        type: "merge_bottles",
        input: {
          sourceBottleId: source.id,
          destinationBottleId: destination.id,
        },
        rationale: "The inspected records are exact duplicates.",
        evidenceRefs: [
          { kind: "bottle", bottleId: source.id },
          { kind: "bottle", bottleId: destination.id },
        ],
      },
    } as const;
    const context = {
      artifacts: artifacts({ bottleIds: [source.id, destination.id] }),
    };

    const allowedStateTokens: string[] = [];
    for (const allowedOwner of [sourceGroupBottle, destinationGroupBottle]) {
      await db
        .update(bottleAliases)
        .set({ bottleId: allowedOwner.id })
        .where(eq(bottleAliases.name, source.fullName));
      const prepared = await prepareOperation({ operation, ...context });
      expect(prepared).toMatchObject({ status: "pending_review" });
      if (prepared.status !== "blocked" && prepared.type === "merge_bottles") {
        allowedStateTokens.push(prepared.stateToken.relationshipDigest);
      }
    }
    expect(allowedStateTokens[0]).not.toBe(allowedStateTokens[1]);

    await db
      .update(bottleAliases)
      .set({ bottleId: foreignOwner.id })
      .where(eq(bottleAliases.name, source.fullName));
    await expect(
      prepareOperation({ operation, ...context }),
    ).resolves.toMatchObject({
      status: "blocked",
      preparationError: { code: "identity_collision" },
    });
  });

  test("blocks only invalid or conflicting proposals and keeps valid siblings", async ({
    fixtures,
  }) => {
    const validEntity = await fixtures.Entity({
      name: "Valid Reviewed Entity",
      shortName: null,
    });
    const uninspectedEntity = await fixtures.Entity({
      name: "Uninspected Entity",
      shortName: null,
    });
    const badEvidenceEntity = await fixtures.Entity({
      name: "Bad Evidence Entity",
      shortName: null,
    });
    const conflictingEntity = await fixtures.Entity({
      name: "Conflicting Entity",
      shortName: null,
    });

    const result = await prepareOperations({
      operations: [
        {
          id: 20,
          proposal: {
            type: "update_entity",
            input: {
              entityId: validEntity.id,
              patch: { shortName: "Valid" },
            },
            rationale: "The inspected Entity has a canonical short name.",
            evidenceRefs: [{ kind: "entity", entityId: validEntity.id }],
          },
        },
        {
          id: 21,
          proposal: {
            type: "update_entity",
            input: {
              entityId: uninspectedEntity.id,
              patch: { shortName: "Not Inspected" },
            },
            rationale: "This target was not actually inspected.",
            evidenceRefs: [{ kind: "entity", entityId: validEntity.id }],
          },
        },
        {
          id: 22,
          proposal: {
            type: "update_entity",
            input: {
              entityId: badEvidenceEntity.id,
              patch: { shortName: "Bad Evidence" },
            },
            rationale: "This cites a result that was not collected.",
            evidenceRefs: [
              {
                kind: "web_result",
                url: "https://not-collected.example/review",
              },
            ],
          },
        },
        {
          id: 23,
          proposal: {
            type: "update_entity",
            input: {
              entityId: conflictingEntity.id,
              patch: { shortName: "First" },
            },
            rationale: "First conflicting write.",
            evidenceRefs: [{ kind: "entity", entityId: conflictingEntity.id }],
          },
        },
        {
          id: 24,
          proposal: {
            type: "update_entity",
            input: {
              entityId: conflictingEntity.id,
              patch: { shortName: "Second" },
            },
            rationale: "Second conflicting write.",
            evidenceRefs: [{ kind: "entity", entityId: conflictingEntity.id }],
          },
        },
      ],
      artifacts: artifacts({
        entities: [validEntity, badEvidenceEntity, conflictingEntity],
      }),
    });

    expect(result.map(({ status }) => status)).toEqual([
      "pending_review",
      "blocked",
      "blocked",
      "blocked",
      "blocked",
    ]);
    expect(result[1]).toMatchObject({
      preparationError: { code: "target_not_inspected" },
    });
    expect(result[2]).toMatchObject({
      preparationError: { code: "evidence_not_found" },
    });
    expect(result[3]).toMatchObject({
      preparationError: { code: "direct_conflict" },
    });
    expect(result[4]).toMatchObject({
      preparationError: { code: "direct_conflict" },
    });
  });

  test("uses discovered ids as evidence without treating them as inspected operation targets", async ({
    fixtures,
  }) => {
    const discoveredBottle = await fixtures.Bottle();
    const inspectedBottle = await fixtures.Bottle();
    const discoveredEntity = await fixtures.Entity();
    const inspectedEntity = await fixtures.Entity({ shortName: null });

    const result = await prepareOperations({
      operations: [
        {
          id: 25,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: discoveredBottle.id,
              patch: { edition: "Candidate Only" },
            },
            rationale: "A search candidate is not a fully inspected target.",
            evidenceRefs: [{ kind: "bottle", bottleId: discoveredBottle.id }],
          },
        },
        {
          id: 26,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: inspectedBottle.id,
              patch: { edition: "Inspected Target" },
            },
            rationale:
              "Collected candidate evidence may support another target.",
            evidenceRefs: [{ kind: "bottle", bottleId: discoveredBottle.id }],
          },
        },
        {
          id: 27,
          proposal: {
            type: "update_entity",
            input: {
              entityId: discoveredEntity.id,
              patch: { shortName: "Candidate Only" },
            },
            rationale: "A resolved search hit is not a fully inspected target.",
            evidenceRefs: [{ kind: "entity", entityId: discoveredEntity.id }],
          },
        },
        {
          id: 28,
          proposal: {
            type: "update_entity",
            input: {
              entityId: inspectedEntity.id,
              patch: { shortName: "Inspected Target" },
            },
            rationale:
              "Collected Entity search evidence may support another target.",
            evidenceRefs: [{ kind: "entity", entityId: discoveredEntity.id }],
          },
        },
      ],
      artifacts: artifacts({
        bottleIds: [inspectedBottle.id],
        candidateBottleIds: [discoveredBottle.id],
        entities: [inspectedEntity],
        resolvedEntities: [discoveredEntity],
      }),
    });

    expect(result.map(({ status }) => status)).toEqual([
      "blocked",
      "pending_review",
      "blocked",
      "pending_review",
    ]);
    expect(result[0]).toMatchObject({
      preparationError: { code: "target_not_inspected" },
    });
    expect(result[2]).toMatchObject({
      preparationError: { code: "target_not_inspected" },
    });
  });

  test("blocks no-op operations with no invented preview", async ({
    fixtures,
  }) => {
    const noOpEntity = await fixtures.Entity({
      name: "No-op Entity",
      shortName: "Already Set",
    });
    const reviewArtifacts = artifacts({
      entities: [noOpEntity],
    });
    const noOp = await prepareOperation({
      operation: {
        id: 30,
        proposal: {
          type: "update_entity",
          input: {
            entityId: noOpEntity.id,
            patch: { shortName: "Already Set" },
          },
          rationale: "This is already current.",
          evidenceRefs: [{ kind: "entity", entityId: noOpEntity.id }],
        },
      },
      artifacts: reviewArtifacts,
    });

    expect(noOp).toEqual(
      expect.objectContaining({
        status: "blocked",
        preparationError: expect.objectContaining({ code: "no_changes" }),
      }),
    );
    expect(noOp).not.toHaveProperty("preview");
    expect(noOp).not.toHaveProperty("stateToken");
  });

  test("allows an unassigned alias but blocks an alias owned by another Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      name: "Alias Claim Review",
      edition: null,
    });
    const aliasOwner = await fixtures.Bottle({
      name: "Assigned Alias Owner",
    });
    const operation = {
      id: 31,
      proposal: {
        type: "update_bottle",
        input: {
          bottleId: bottle.id,
          patch: { edition: "Claimable Edition" },
        },
        rationale: "The inspected evidence confirms this edition.",
        evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
      },
    } as const;
    const context = {
      artifacts: artifacts({
        bottleContexts: [await bottleContext(bottle.id)],
      }),
    };
    const initial = await prepareOperation({ operation, ...context });
    if (initial.status === "blocked" || initial.type !== "update_bottle") {
      throw new Error("Expected the Bottle update to prepare.");
    }
    const desiredFullName = initial.preview.after.fullName;
    await fixtures.BottleAlias({
      bottleId: null,
      name: desiredFullName,
    });

    await expect(prepareOperation({ operation, ...context })).resolves.toEqual(
      expect.objectContaining({
        status: "pending_review",
        type: "update_bottle",
      }),
    );

    await db
      .update(bottleAliases)
      .set({ bottleId: aliasOwner.id })
      .where(eq(bottleAliases.name, desiredFullName));

    await expect(prepareOperation({ operation, ...context })).resolves.toEqual(
      expect.objectContaining({
        status: "blocked",
        preparationError: expect.objectContaining({
          code: "identity_collision",
        }),
      }),
    );
  });

  test("state tokens ignore unrelated counters and timestamps", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Stable Token Entity",
      shortName: null,
      totalTastings: 2,
    });
    const operation = {
      id: 40,
      proposal: {
        type: "update_entity",
        input: {
          entityId: entity.id,
          patch: { shortName: "Stable Token" },
        },
        rationale: "The inspected Entity has this short name.",
        evidenceRefs: [{ kind: "entity", entityId: entity.id }],
      },
    } as const;
    const context = {
      artifacts: artifacts({ entities: [entity] }),
    };

    const before = await prepareOperation({ operation, ...context });
    await db
      .update(entities)
      .set({
        totalTastings: 99,
        updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      })
      .where(eq(entities.id, entity.id));
    const after = await prepareOperation({ operation, ...context });

    expect(before.status).toBe("pending_review");
    expect(after.status).toBe("pending_review");
    if (before.status !== "blocked" && after.status !== "blocked") {
      expect(after.stateToken).toEqual(before.stateToken);
    }
  });

  test("maps agent seriesId to canonical series for setting and clearing", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Series Review Brand",
      type: ["brand"],
    });
    const series = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Review Series",
    });
    const bottleToSet = await fixtures.Bottle({
      brandId: brand.id,
      name: "Without Series",
      seriesId: null,
    });
    const bottleToClear = await fixtures.Bottle({
      brandId: brand.id,
      name: "With Series",
      seriesId: series.id,
    });

    const result = await prepareOperations({
      operations: [
        {
          id: 50,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: bottleToSet.id,
              patch: { seriesId: series.id },
            },
            rationale: "The inspected catalog context identifies the series.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottleToSet.id }],
          },
        },
        {
          id: 51,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: bottleToClear.id,
              patch: { seriesId: null },
            },
            rationale: "The inspected Bottle is not part of this series.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottleToClear.id }],
          },
        },
      ],
      artifacts: artifacts({
        bottleIds: [bottleToSet.id],
        bottleContexts: [await bottleContext(bottleToClear.id)],
      }),
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      status: "pending_review",
      type: "update_bottle",
      preview: { after: { shared: { seriesId: series.id } } },
    });
    expect(result[1]).toMatchObject({
      status: "pending_review",
      type: "update_bottle",
      preview: { after: { shared: { seriesId: null } } },
    });
  });

  test("blocks a Brand-only update when the retained series belongs to another Brand", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Current Series Brand",
      type: ["brand"],
    });
    const proposedBrand = await fixtures.Entity({
      name: "Proposed Series Brand",
      type: ["brand"],
    });
    const retainedSeries = await fixtures.BottleSeries({
      brandId: currentBrand.id,
      name: "Retained Series",
    });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Brand-only Series Change",
      seriesId: retainedSeries.id,
    });

    const result = await prepareOperation({
      operation: {
        id: 52,
        proposal: {
          type: "update_bottle",
          input: {
            bottleId: bottle.id,
            patch: {
              brand: { kind: "existing", entityId: proposedBrand.id },
            },
          },
          rationale: "Moves the Bottle to the inspected Brand.",
          evidenceRefs: [
            { kind: "bottle", bottleId: bottle.id },
            { kind: "entity", entityId: proposedBrand.id },
          ],
        },
      },
      artifacts: artifacts({
        bottleIds: [bottle.id],
        entities: [proposedBrand],
      }),
    });

    expect(result).toMatchObject({
      status: "blocked",
      preparationError: { code: "invalid_current_state" },
    });
  });

  test("detects sibling shared writes and Entity merge-owned field conflicts", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle({ name: "Sibling Conflict" });
    const sibling = await fixtures.BottleGroupMember({
      groupId: firstBottle.groupId as number,
      edition: "Sibling",
    });
    const sourceEntity = await fixtures.Entity({
      name: "Role Merge Source",
      type: ["distiller"],
    });
    const destinationEntity = await fixtures.Entity({
      name: "Role Merge Destination",
      type: ["brand"],
    });
    const context = {
      artifacts: artifacts({
        bottleIds: [firstBottle.id, sibling.id],
        entities: [sourceEntity, destinationEntity],
      }),
    };

    const siblingResult = await prepareOperations({
      ...context,
      operations: [
        {
          id: 60,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: firstBottle.id,
              patch: { name: "First Shared Name" },
            },
            rationale: "First write to shared authority.",
            evidenceRefs: [{ kind: "bottle", bottleId: firstBottle.id }],
          },
        },
        {
          id: 61,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: sibling.id,
              patch: { statedAge: 12 },
            },
            rationale: "Writes the selected Bottle age.",
            evidenceRefs: [{ kind: "bottle", bottleId: sibling.id }],
          },
        },
      ],
    });
    expect(siblingResult).toEqual([
      expect.objectContaining({ status: "pending_review" }),
      expect.objectContaining({ status: "pending_review" }),
    ]);

    const destinationIdentityConflict = await prepareOperations({
      ...context,
      operations: [
        {
          id: 62,
          proposal: {
            type: "update_entity",
            input: {
              entityId: destinationEntity.id,
              patch: { name: "Renamed Merge Destination" },
            },
            rationale: "Updates the name used by merge materialization.",
            evidenceRefs: [{ kind: "entity", entityId: destinationEntity.id }],
          },
        },
        {
          id: 63,
          proposal: {
            type: "update_entity",
            input: {
              entityId: destinationEntity.id,
              patch: { shortName: "Renamed" },
            },
            rationale: "Updates the short name used by merge materialization.",
            evidenceRefs: [{ kind: "entity", entityId: destinationEntity.id }],
          },
        },
        {
          id: 64,
          proposal: {
            type: "update_entity",
            input: {
              entityId: destinationEntity.id,
              patch: { roles: ["brand", "bottler"] },
            },
            rationale: "Updates a merge-owned role set.",
            evidenceRefs: [{ kind: "entity", entityId: destinationEntity.id }],
          },
        },
        {
          id: 65,
          proposal: {
            type: "merge_entities",
            input: {
              sourceEntityId: sourceEntity.id,
              destinationEntityId: destinationEntity.id,
            },
            rationale: "Merges roles into the destination.",
            evidenceRefs: [
              { kind: "entity", entityId: sourceEntity.id },
              { kind: "entity", entityId: destinationEntity.id },
            ],
          },
        },
      ],
    });
    expect(destinationIdentityConflict.map(({ status }) => status)).toEqual([
      "blocked",
      "blocked",
      "blocked",
      "blocked",
    ]);

    const sourceUpdateConflict = await prepareOperations({
      ...context,
      operations: [
        {
          id: 66,
          proposal: {
            type: "update_entity",
            input: {
              entityId: sourceEntity.id,
              patch: { website: "https://example.com/role-source" },
            },
            rationale: "Updates the Entity that the merge retires.",
            evidenceRefs: [{ kind: "entity", entityId: sourceEntity.id }],
          },
        },
        {
          id: 67,
          proposal: {
            type: "merge_entities",
            input: {
              sourceEntityId: sourceEntity.id,
              destinationEntityId: destinationEntity.id,
            },
            rationale: "Merges the duplicate Entity into that destination.",
            evidenceRefs: [
              { kind: "entity", entityId: sourceEntity.id },
              { kind: "entity", entityId: destinationEntity.id },
            ],
          },
        },
      ],
    });
    expect(sourceUpdateConflict.map(({ status }) => status)).toEqual([
      "blocked",
      "blocked",
    ]);
  });

  test("allows a disjoint update to an Entity merge destination", async ({
    fixtures,
  }) => {
    const sourceEntity = await fixtures.Entity({
      name: "Metadata Merge Source",
      type: ["distiller"],
    });
    const destinationEntity = await fixtures.Entity({
      name: "Metadata Merge Destination",
      type: ["brand"],
    });
    const country = await fixtures.Country({ name: "Metadata Country" });
    const region = await fixtures.Region({
      countryId: country.id,
      name: "Metadata Region",
    });

    const result = await prepareOperations({
      operations: [
        {
          id: 68,
          proposal: {
            type: "update_entity",
            input: {
              entityId: destinationEntity.id,
              patch: {
                website: "https://example.com/metadata-destination",
                country: country.name,
                region: region.name,
                yearEstablished: 1815,
              },
            },
            rationale: "Corrects metadata that the merge does not overwrite.",
            evidenceRefs: [{ kind: "entity", entityId: destinationEntity.id }],
          },
        },
        {
          id: 69,
          proposal: {
            type: "merge_entities",
            input: {
              sourceEntityId: sourceEntity.id,
              destinationEntityId: destinationEntity.id,
            },
            rationale: "Merges the duplicate Entity into that destination.",
            evidenceRefs: [
              { kind: "entity", entityId: sourceEntity.id },
              { kind: "entity", entityId: destinationEntity.id },
            ],
          },
        },
      ],
      artifacts: artifacts({ entities: [sourceEntity, destinationEntity] }),
    });

    expect(result).toEqual([
      expect.objectContaining({
        status: "pending_review",
        type: "update_entity",
        preview: expect.objectContaining({
          changedFields: ["website", "country", "region", "yearEstablished"],
        }),
      }),
      expect.objectContaining({
        status: "pending_review",
        type: "merge_entities",
      }),
    ]);
  });

  test("blocks an update to a Bottle retired by a merge in the same batch", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Retired Update Source" });
    const destination = await fixtures.Bottle({
      name: "Retired Update Destination",
    });

    const prepared = await prepareOperations({
      operations: [
        {
          id: 66,
          proposal: {
            type: "update_bottle",
            input: {
              bottleId: source.id,
              patch: { abv: 51.2 },
            },
            rationale: "Corrects the malformed duplicate row.",
            evidenceRefs: [{ kind: "bottle", bottleId: source.id }],
          },
        },
        {
          id: 67,
          proposal: {
            type: "merge_bottles",
            input: {
              sourceBottleId: source.id,
              destinationBottleId: destination.id,
            },
            rationale: "Retires the duplicate in favor of the survivor.",
            evidenceRefs: [
              { kind: "bottle", bottleId: source.id },
              { kind: "bottle", bottleId: destination.id },
            ],
          },
        },
      ],
      artifacts: artifacts({ bottleIds: [source.id, destination.id] }),
    });

    expect(prepared).toEqual([
      expect.objectContaining({
        status: "blocked",
        preparationError: expect.objectContaining({ code: "direct_conflict" }),
      }),
      expect.objectContaining({
        status: "blocked",
        preparationError: expect.objectContaining({ code: "direct_conflict" }),
      }),
    ]);
  });

  test("blocks merge batches that are not independently executable", async ({
    fixtures,
  }) => {
    const bottleSourceOne = await fixtures.Bottle({
      name: "Bottle Fan-in Source One",
    });
    const bottleSourceTwo = await fixtures.Bottle({
      name: "Bottle Fan-in Source Two",
    });
    const bottleDestination = await fixtures.Bottle({
      name: "Bottle Fan-in Destination",
    });
    const entitySourceOne = await fixtures.Entity({
      name: "Entity Fan-in Source One",
    });
    const entitySourceTwo = await fixtures.Entity({
      name: "Entity Fan-in Source Two",
    });
    const entityDestination = await fixtures.Entity({
      name: "Entity Fan-in Destination",
    });
    const context = {
      artifacts: artifacts({
        bottleIds: [
          bottleSourceOne.id,
          bottleSourceTwo.id,
          bottleDestination.id,
        ],
        entities: [entitySourceOne, entitySourceTwo, entityDestination],
      }),
    };
    const bottleMerge = (
      id: number,
      sourceBottleId: number,
      destinationBottleId: number,
    ) => ({
      id,
      proposal: {
        type: "merge_bottles" as const,
        input: { sourceBottleId, destinationBottleId },
        rationale: "The inspected Bottles are exact duplicates.",
        evidenceRefs: [
          { kind: "bottle" as const, bottleId: sourceBottleId },
          { kind: "bottle" as const, bottleId: destinationBottleId },
        ],
      },
    });
    const entityMerge = (
      id: number,
      sourceEntityId: number,
      destinationEntityId: number,
    ) => ({
      id,
      proposal: {
        type: "merge_entities" as const,
        input: { sourceEntityId, destinationEntityId },
        rationale: "The inspected Entities identify one producer.",
        evidenceRefs: [
          { kind: "entity" as const, entityId: sourceEntityId },
          { kind: "entity" as const, entityId: destinationEntityId },
        ],
      },
    });

    let operationId = 66;
    const expectBlockedPair = async ({
      bottlePairs,
      entityPairs,
      name,
    }: {
      bottlePairs: [[number, number], [number, number]];
      entityPairs: [[number, number], [number, number]];
      name: string;
    }) => {
      const operations = [
        ...bottlePairs.map(([sourceId, destinationId]) =>
          bottleMerge(operationId++, sourceId, destinationId),
        ),
        ...entityPairs.map(([sourceId, destinationId]) =>
          entityMerge(operationId++, sourceId, destinationId),
        ),
      ];
      const prepared = await prepareOperations({ ...context, operations });
      expect(
        prepared.map(({ status }) => status),
        name,
      ).toEqual(["blocked", "blocked", "blocked", "blocked"]);
    };

    await expectBlockedPair({
      name: "shared destination",
      bottlePairs: [
        [bottleSourceOne.id, bottleDestination.id],
        [bottleSourceTwo.id, bottleDestination.id],
      ],
      entityPairs: [
        [entitySourceOne.id, entityDestination.id],
        [entitySourceTwo.id, entityDestination.id],
      ],
    });
    await expectBlockedPair({
      name: "reused source",
      bottlePairs: [
        [bottleSourceOne.id, bottleDestination.id],
        [bottleSourceOne.id, bottleSourceTwo.id],
      ],
      entityPairs: [
        [entitySourceOne.id, entityDestination.id],
        [entitySourceOne.id, entitySourceTwo.id],
      ],
    });
    await expectBlockedPair({
      name: "merge chain",
      bottlePairs: [
        [bottleSourceOne.id, bottleSourceTwo.id],
        [bottleSourceTwo.id, bottleDestination.id],
      ],
      entityPairs: [
        [entitySourceOne.id, entitySourceTwo.id],
        [entitySourceTwo.id, entityDestination.id],
      ],
    });
    await expectBlockedPair({
      name: "merge crossover",
      bottlePairs: [
        [bottleSourceTwo.id, bottleDestination.id],
        [bottleSourceOne.id, bottleSourceTwo.id],
      ],
      entityPairs: [
        [entitySourceTwo.id, entityDestination.id],
        [entitySourceOne.id, entitySourceTwo.id],
      ],
    });
    await expectBlockedPair({
      name: "opposite direction",
      bottlePairs: [
        [bottleSourceOne.id, bottleSourceTwo.id],
        [bottleSourceTwo.id, bottleSourceOne.id],
      ],
      entityPairs: [
        [entitySourceOne.id, entitySourceTwo.id],
        [entitySourceTwo.id, entitySourceOne.id],
      ],
    });
  });

  test("includes shared stated age in the token for a name update", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      name: "Name Token Before",
      statedAge: null,
    });
    const operation = {
      id: 66,
      proposal: {
        type: "update_bottle",
        input: {
          bottleId: bottle.id,
          patch: { name: "Name Token After" },
        },
        rationale: "Repairs the shared Bottle name.",
        evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
      },
    } as const;
    const context = {
      artifacts: artifacts({ bottleIds: [bottle.id] }),
    };

    const before = await prepareOperation({ operation, ...context });
    await db
      .update(bottleGroups)
      .set({ statedAge: 12 })
      .where(eq(bottleGroups.id, bottle.groupId as number));
    const after = await prepareOperation({ operation, ...context });

    expect(before.status).toBe("pending_review");
    expect(after.status).toBe("pending_review");
    if (before.status !== "blocked" && after.status !== "blocked") {
      expect(before.stateToken).toMatchObject({
        shared: { statedAge: null },
      });
      expect(after.stateToken).toMatchObject({
        shared: { statedAge: 12 },
      });
      expect(after.stateToken).not.toEqual(before.stateToken);
    }
  });

  test("relationship digests change for affected membership drift", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      name: "Group Membership Token",
      category: null,
    });
    const sharedOperation = {
      id: 70,
      proposal: {
        type: "update_bottle",
        input: {
          bottleId: bottle.id,
          patch: { category: "single_malt" },
        },
        rationale: "Repairs a shared category.",
        evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
      },
    } as const;
    const bottleContextInput = {
      artifacts: artifacts({ bottleIds: [bottle.id] }),
    };
    const beforeGroupDrift = await prepareOperation({
      operation: sharedOperation,
      ...bottleContextInput,
    });
    await fixtures.BottleGroupMember({
      groupId: bottle.groupId as number,
      edition: "New Member",
    });
    const afterGroupDrift = await prepareOperation({
      operation: sharedOperation,
      ...bottleContextInput,
    });
    expect(beforeGroupDrift.status).toBe("pending_review");
    expect(afterGroupDrift.status).toBe("pending_review");
    if (
      beforeGroupDrift.status !== "blocked" &&
      afterGroupDrift.status !== "blocked"
    ) {
      expect(afterGroupDrift.stateToken.relationshipDigest).not.toBe(
        beforeGroupDrift.stateToken.relationshipDigest,
      );
    }

    const mergeSource = await fixtures.Bottle({ name: "Consumer Source" });
    const mergeDestination = await fixtures.Bottle({
      name: "Consumer Destination",
    });
    const mergeOperation = {
      id: 71,
      proposal: {
        type: "merge_bottles",
        input: {
          sourceBottleId: mergeSource.id,
          destinationBottleId: mergeDestination.id,
        },
        rationale: "The two Bottles are exact duplicates.",
        evidenceRefs: [
          { kind: "bottle", bottleId: mergeSource.id },
          { kind: "bottle", bottleId: mergeDestination.id },
        ],
      },
    } as const;
    const mergeContext = {
      artifacts: artifacts({
        bottleIds: [mergeSource.id, mergeDestination.id],
      }),
    };
    const beforeConsumerDrift = await prepareOperation({
      operation: mergeOperation,
      ...mergeContext,
    });
    await fixtures.Tasting({ bottleId: mergeSource.id });
    const afterConsumerDrift = await prepareOperation({
      operation: mergeOperation,
      ...mergeContext,
    });
    expect(beforeConsumerDrift.status).toBe("pending_review");
    expect(afterConsumerDrift.status).toBe("pending_review");
    if (
      beforeConsumerDrift.status !== "blocked" &&
      afterConsumerDrift.status !== "blocked"
    ) {
      expect(afterConsumerDrift.stateToken.relationshipDigest).not.toBe(
        beforeConsumerDrift.stateToken.relationshipDigest,
      );
    }

    const entity = await fixtures.Entity({
      name: "Relationship Entity Before",
      type: ["brand"],
    });
    const entityOperation = {
      id: 72,
      proposal: {
        type: "update_entity",
        input: {
          entityId: entity.id,
          patch: { name: "Relationship Entity After" },
        },
        rationale: "Repairs the Entity name and affected Bottles.",
        evidenceRefs: [{ kind: "entity", entityId: entity.id }],
      },
    } as const;
    const entityContextInput = {
      artifacts: artifacts({ entities: [entity] }),
    };
    const beforeEntityDrift = await prepareOperation({
      operation: entityOperation,
      ...entityContextInput,
    });
    await fixtures.Bottle({
      brandId: entity.id,
      name: "New Relationship",
    });
    const afterEntityDrift = await prepareOperation({
      operation: entityOperation,
      ...entityContextInput,
    });
    expect(beforeEntityDrift.status).toBe("pending_review");
    expect(afterEntityDrift.status).toBe("pending_review");
    if (
      beforeEntityDrift.status !== "blocked" &&
      afterEntityDrift.status !== "blocked"
    ) {
      expect(afterEntityDrift.stateToken.relationshipDigest).not.toBe(
        beforeEntityDrift.stateToken.relationshipDigest,
      );
    }
  });

  test("normalizes duplicate and reordered distillers using set semantics", async ({
    fixtures,
  }) => {
    const firstDistiller = await fixtures.Entity({
      name: "First Set Distiller",
      type: ["distiller"],
    });
    const secondDistiller = await fixtures.Entity({
      name: "Second Set Distiller",
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      name: "Distiller Set Bottle",
      distillerIds: [firstDistiller.id, secondDistiller.id],
    });

    const result = await prepareOperation({
      operation: {
        id: 80,
        proposal: {
          type: "update_bottle",
          input: {
            bottleId: bottle.id,
            patch: {
              distillers: [
                { kind: "existing", entityId: secondDistiller.id },
                { kind: "existing", entityId: firstDistiller.id },
                { kind: "existing", entityId: secondDistiller.id },
              ],
            },
          },
          rationale: "Only reorders and duplicates the same distiller set.",
          evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
        },
      },
      artifacts: artifacts({
        bottleIds: [bottle.id],
        entities: [firstDistiller, secondDistiller],
      }),
    });

    expect(result).toMatchObject({
      status: "blocked",
      preparationError: { code: "no_changes" },
    });
  });

  test("batches Entity merge Bottle collision scans beyond one preview page", async ({
    fixtures,
  }) => {
    const source = await fixtures.Entity({
      name: "Batched Collision Source",
      type: ["brand"],
    });
    const destination = await fixtures.Entity({
      name: "Batched Collision Destination",
      type: ["brand"],
    });
    for (let index = 0; index <= 20; index += 1) {
      await fixtures.Bottle({
        brandId: source.id,
        name: `Batch Expression ${index}`,
      });
    }
    await fixtures.Bottle({
      brandId: destination.id,
      name: "Batch Expression 0",
    });
    await fixtures.Bottle({
      brandId: destination.id,
      name: "Batch Expression 20",
    });

    const result = await prepareOperation({
      operation: {
        id: 90,
        proposal: {
          type: "merge_entities",
          input: {
            sourceEntityId: source.id,
            destinationEntityId: destination.id,
          },
          rationale: "The two Brand records identify one producer.",
          evidenceRefs: [
            { kind: "entity", entityId: source.id },
            { kind: "entity", entityId: destination.id },
          ],
        },
      },
      artifacts: artifacts({ entities: [source, destination] }),
    });

    expect(result).toMatchObject({
      status: "pending_review",
      type: "merge_entities",
      preview: {
        collisions: { bottleIdentities: 2 },
      },
    });
  });

  test("prepares id-less proposals for atomic persistence", async ({
    fixtures,
  }) => {
    const valid = await fixtures.Entity({
      name: "Id-less Valid Entity",
      shortName: null,
    });
    const uninspected = await fixtures.Entity({
      name: "Id-less Uninspected Entity",
      shortName: null,
    });

    const result = await prepareProposals({
      proposals: [
        {
          type: "update_entity",
          input: {
            entityId: valid.id,
            patch: { shortName: "Valid" },
          },
          rationale: "Uses a collected Entity.",
          evidenceRefs: [{ kind: "entity", entityId: valid.id }],
        },
        {
          type: "update_entity",
          input: {
            entityId: uninspected.id,
            patch: { shortName: "Invalid" },
          },
          rationale: "Does not use a collected Entity.",
          evidenceRefs: [{ kind: "entity", entityId: valid.id }],
        },
      ],
      artifacts: artifacts({ entities: [valid] }),
    });

    expect(result).toEqual([
      expect.objectContaining({
        status: "pending_review",
        proposal: expect.objectContaining({ type: "update_entity" }),
        stateToken: expect.any(Object),
      }),
      expect.objectContaining({
        status: "blocked",
        preparationError: expect.objectContaining({
          code: "target_not_inspected",
        }),
      }),
    ]);
    expect(result[0]).not.toHaveProperty("id");
    expect(result[0]).not.toHaveProperty("preview");
  });

  test("protects the primary Bottle only from being retired as a merge source", async ({
    fixtures,
  }) => {
    const primary = await fixtures.Bottle({ name: "Primary Resolution" });
    const duplicate = await fixtures.Bottle({ name: "Duplicate Resolution" });
    const reviewArtifacts = artifacts({
      bottleIds: [primary.id, duplicate.id],
    });
    const context = {
      artifacts: reviewArtifacts,
      protectedBottleIds: [primary.id],
    };
    const mergeProposal = (
      sourceBottleId: number,
      destinationBottleId: number,
    ) => ({
      type: "merge_bottles" as const,
      input: { sourceBottleId, destinationBottleId },
      rationale: "The inspected Bottles are exact duplicates.",
      evidenceRefs: [
        { kind: "bottle" as const, bottleId: sourceBottleId },
        { kind: "bottle" as const, bottleId: destinationBottleId },
      ],
    });

    const [protectedSource] = await prepareProposals({
      ...context,
      proposals: [mergeProposal(primary.id, duplicate.id)],
    });
    const [protectedDestination] = await prepareProposals({
      ...context,
      proposals: [mergeProposal(duplicate.id, primary.id)],
    });
    const [protectedUpdate] = await prepareProposals({
      ...context,
      proposals: [
        {
          type: "update_bottle",
          input: {
            bottleId: primary.id,
            patch: { edition: "Corrected Edition" },
          },
          rationale: "The primary Bottle needs a supported field correction.",
          evidenceRefs: [{ kind: "bottle", bottleId: primary.id }],
        },
      ],
    });

    expect(protectedSource).toMatchObject({
      status: "blocked",
      preparationError: { code: "direct_conflict" },
    });
    expect(protectedDestination).toMatchObject({ status: "pending_review" });
    expect(protectedUpdate).toMatchObject({ status: "pending_review" });
  });
});
