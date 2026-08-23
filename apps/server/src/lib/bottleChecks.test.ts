import type { BottleClassificationArtifactsSchema } from "@peated/bottle-classifier";
import {
  type Finding,
  type ProposedOperation,
} from "@peated/bottle-classifier";
import { getBottleClassifierContext } from "@peated/server/agents/bottleClassifier/contextAdapters";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import * as schema from "@peated/server/db/schema";
import {
  bottleChecks,
  bottleOperations,
  storePriceMatchAttempts,
  storePriceMatchProposals,
} from "@peated/server/db/schema";
import {
  BottleCheckAlreadyClosedError,
  BottleCheckCloseAuthorizationError,
  BottleCheckNotClosableError,
  closeBottleCheck,
  createBottleCheck,
  getBottleCheckForReview,
  listActionableBottleChecks,
  PersistedReferenceBottleCheckOutputSchema,
} from "@peated/server/lib/bottleChecks";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { z } from "zod";

function updateBottleProposal(
  bottleId: number,
  edition: string,
): Extract<ProposedOperation, { type: "update_bottle" }> {
  return {
    type: "update_bottle",
    input: {
      bottleId,
      patch: {
        edition,
      },
    },
    rationale: `Use the ${edition} edition.`,
    evidenceRefs: [{ kind: "bottle", bottleId }],
  };
}

async function bottleArtifacts(bottleId: number) {
  const context = await getBottleClassifierContext(bottleId);
  if (!context) throw new Error(`Missing Bottle context for ${bottleId}`);
  const { imageSources: _imageSources, ...fields } = context;
  return {
    bottleContexts: [{ ...fields, publicImages: [] }],
  };
}

function auditCheckInput({
  artifacts,
  backgroundEventKey,
  bottleId,
  findings = [],
  origin = "moderator",
  operations = [],
  summary,
}: {
  artifacts?: z.input<typeof BottleClassificationArtifactsSchema>;
  backgroundEventKey?: string;
  bottleId: number;
  findings?: Finding[];
  operations?: Array<{ proposal: ProposedOperation }>;
  origin?: "moderator" | "post_user_creation";
  summary: string;
}) {
  return {
    intent: "audit_bottle" as const,
    input: {
      bottleId,
      origin,
    },
    result: {
      summary,
      proposedOperations: operations.map(({ proposal }) => proposal),
      findings,
      artifacts: artifacts ?? {
        candidates: [
          {
            bottleId,
            fullName: `Audited Bottle ${bottleId}`,
          },
        ],
      },
    },
    backgroundEventKey,
    model: "test-model",
    modelMetadata: {
      agentDurationMs: 10,
      usage: {
        requests: 1,
        inputTokens: 8,
        outputTokens: 2,
        totalTokens: 10,
      },
      toolCalls: { count: 0, names: [] },
    },
  };
}

describe("Bottle check persistence", () => {
  test("removes obsolete agent-only fields from persisted decisions", () => {
    const output = PersistedReferenceBottleCheckOutputSchema.parse({
      status: "classified",
      decision: {
        action: "no_match",
        candidateBottleIds: [],
        identityBasis: {
          bottleTraits: ["Brand and expression"],
          releaseTraits: [],
          observationTraits: [],
          yearInterpretation: "none",
          siblingEvidence: "none",
          uncertainties: [],
        },
        observation: {
          selector: null,
          caskNumber: null,
          barrelNumber: null,
          bottleNumber: null,
          outturn: 240,
          market: "US",
          exclusive: "travel retail",
        },
        confidenceBasis: {
          positiveEvidence: ["Legacy model-reported support."],
          unresolvedRisks: [],
          toolsUsed: ["search_bottles"],
          webEvidence: "not_used",
        },
        matchedBottleId: null,
        proposedBottle: null,
      },
      findings: [],
    });

    expect(output.status).toBe("classified");
    if (output.status !== "classified") throw new Error("Expected decision");
    expect(output.decision).not.toHaveProperty("identityBasis");
    expect(output.decision.observation).not.toHaveProperty("bottleNumber");
    expect(output.decision.observation).not.toHaveProperty("outturn");
    expect(output.decision.observation).not.toHaveProperty("market");
    expect(output.decision.observation).not.toHaveProperty("exclusive");
    expect(output.decision.confidenceBasis).not.toHaveProperty(
      "positiveEvidence",
    );
    expect(output.decision.confidenceBasis).not.toHaveProperty("toolsUsed");
  });

  test("rejects malformed classifier run metadata before persistence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const input = auditCheckInput({
      bottleId: bottle.id,
      summary: "The Bottle is supported.",
    });

    await expect(
      createBottleCheck({
        ...input,
        modelMetadata: { agentDurationMs: 10 },
      }),
    ).rejects.toThrow();
  });

  test("sanitizes inline images and stores output and artifacts once", async () => {
    const inlineImage = `data:image/jpeg;base64,${Buffer.from(
      "not really an image",
    ).toString("base64")}`;

    const result = await createBottleCheck({
      intent: "resolve_reference",
      sourceKind: "test_reference",
      sourceId: 11828042,
      input: {
        reference: {
          id: 11828042,
          name: "Laphroaig Càirdeas 2022",
          imageUrl: inlineImage,
        },
      },
      result: {
        status: "ignored",
        reason: "Test fixture",
        artifacts: {
          candidates: [],
          searchEvidence: [],
          resolvedEntities: [],
        },
      },
      model: "test-model",
    });

    expect(result.created).toBe(true);
    expect(result.check.inputSnapshot).toMatchObject({
      reference: {
        id: 11828042,
        name: "Laphroaig Càirdeas 2022",
        imageUrl: {
          kind: "omitted_inline_image",
          mediaType: "image/jpeg",
          byteLength: 19,
        },
      },
    });
    expect(JSON.stringify(result.check.inputSnapshot)).not.toContain(
      inlineImage,
    );
    expect(result.check.output).toEqual({
      status: "ignored",
      reason: "Test fixture",
      findings: [],
    });
    expect(result.check.output).not.toHaveProperty("artifacts");
    expect(result.check.output).not.toHaveProperty("proposedOperations");
    expect(result.check.artifacts).toMatchObject({
      extractedIdentity: null,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
    });
  });

  test("requires the exact store-price attempt and derives its proposal link", async ({
    fixtures,
  }) => {
    const price = await fixtures.StorePrice({ name: "Exact attempt listing" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "no_match",
        status: "ignored",
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal!.id,
        proposalType: "no_match",
        initialStatus: "ignored",
        finalStatus: "ignored",
      })
      .returning();

    const result = await createBottleCheck({
      intent: "resolve_reference",
      sourceKind: "store_price",
      sourceId: price.id,
      input: { reference: { id: price.id, name: price.name } },
      result: {
        status: "ignored",
        reason: "Not one Bottle.",
        artifacts: {},
      },
      storePrice: { attemptId: attempt!.id },
    });

    expect(result.check).toMatchObject({
      storePriceMatchAttemptId: attempt!.id,
      storePriceMatchProposalId: proposal!.id,
    });
  });

  test("rejects Suggested Changes from reference classification", async ({
    fixtures,
  }) => {
    const primary = await fixtures.Bottle({ name: "Primary match" });
    const duplicate = await fixtures.Bottle({ name: "Malformed duplicate" });
    const price = await fixtures.StorePrice({
      name: "Protected match listing",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        proposalType: "match_existing",
        status: "pending_review",
        suggestedBottleId: primary.id,
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: proposal!.id,
        proposalType: "match_existing",
        initialStatus: "pending_review",
        suggestedBottleId: primary.id,
      })
      .returning();
    const mergeProposal = {
      type: "merge_bottles" as const,
      input: {
        sourceBottleId: primary.id,
        destinationBottleId: duplicate.id,
      },
      rationale: "The inspected Bottles are exact duplicates.",
      evidenceRefs: [
        { kind: "bottle" as const, bottleId: primary.id },
        { kind: "bottle" as const, bottleId: duplicate.id },
      ],
    };

    await expect(
      createBottleCheck({
        intent: "resolve_reference",
        sourceKind: "store_price",
        sourceId: price.id,
        input: { reference: { id: price.id, name: price.name } },
        result: {
          status: "classified",
          decision: {
            action: "match",
            matchedBottleId: primary.id,
            proposedBottle: null,
            rationale: "The listing matches the primary Bottle.",
            candidateBottleIds: [primary.id, duplicate.id],
          },
          proposedOperations: [mergeProposal],
          artifacts: {},
        },
        storePrice: { attemptId: attempt!.id },
      }),
    ).rejects.toThrow("proposedOperations");
  });

  test("rejects missing and mismatched store-price attempts", async ({
    fixtures,
  }) => {
    const price = await fixtures.StorePrice({ name: "Expected listing" });
    const otherPrice = await fixtures.StorePrice({ name: "Other listing" });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: otherPrice.id,
        proposalType: "no_match",
        status: "ignored",
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: otherPrice.id,
        proposalId: proposal!.id,
        proposalType: "no_match",
        initialStatus: "ignored",
        finalStatus: "ignored",
      })
      .returning();
    const input = {
      intent: "resolve_reference" as const,
      sourceKind: "store_price",
      sourceId: price.id,
      input: { reference: { id: price.id, name: price.name } },
      result: {
        status: "ignored" as const,
        reason: "Not one Bottle.",
        artifacts: {},
      },
    };

    await expect(createBottleCheck(input)).rejects.toThrow(
      "require the exact match attempt",
    );
    await expect(
      createBottleCheck({
        ...input,
        storePrice: { attemptId: attempt!.id },
      }),
    ).rejects.toThrow("does not belong to price");
  });

  test("prepares and inserts Suggested Changes at the persistence boundary", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const proposal = updateBottleProposal(bottle.id, "Warehouse 1 Release");

    const result = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(bottle.id),
        bottleId: bottle.id,
        summary: "One possible correction.",
        operations: [
          {
            proposal,
          },
        ],
      }),
    );

    expect(result.check.operations).toEqual([
      expect.objectContaining({
        proposal,
        status: "pending_review",
        preparationError: null,
      }),
    ]);
    expect(result.check.operations[0]).toMatchObject({
      stateToken: {
        bottleId: bottle.id,
        exact: {
          edition: null,
        },
      },
    });
  });

  test("deduplicates concurrent background retries by event key", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const input = auditCheckInput({
      backgroundEventKey: `bottle_created:${bottle.id}`,
      bottleId: bottle.id,
      origin: "post_user_creation",
      summary: "The Bottle is clean.",
    });

    const concurrentPool = new pg.Pool({
      ...getPostgresConnectionConfig(),
      application_name: "peated-vitest",
      max: 2,
    });
    const concurrentDatabase = drizzle(concurrentPool, { schema });
    const results = await Promise.all([
      createBottleCheck(input, concurrentDatabase),
      createBottleCheck(input, concurrentDatabase),
    ]).finally(async () => {
      await concurrentPool.end();
    });

    expect(results.map(({ created }) => created).sort()).toEqual([false, true]);
    expect(results[0].check.id).toBe(results[1].check.id);

    const persisted = await db
      .select()
      .from(bottleChecks)
      .where(
        eq(bottleChecks.backgroundEventKey, `bottle_created:${bottle.id}`),
      );
    expect(persisted).toHaveLength(1);
  });

  test("rejects a background event key on moderator-forced checks", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      createBottleCheck(
        auditCheckInput({
          backgroundEventKey: `moderator:${bottle.id}`,
          bottleId: bottle.id,
          summary: "Forced moderator review.",
        }),
      ),
    ).rejects.toThrow(
      "Moderator Bottle checks must not use a background event key.",
    );
  });

  test("requires a background event key for post-user-creation checks", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      createBottleCheck(
        auditCheckInput({
          bottleId: bottle.id,
          origin: "post_user_creation",
          summary: "Background review.",
        }),
      ),
    ).rejects.toThrow(
      "Post-user-creation Bottle checks require a background event key.",
    );

    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.bottleId, bottle.id),
      }),
    ).toEqual([]);
  });

  test("persists findings only when resource evidence was inspected", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const entity = await fixtures.Entity();
    const collectedUrl = "https://example.com/collected-bottle-evidence";
    const artifacts = {
      ...(await bottleArtifacts(bottle.id)),
      candidates: [
        {
          bottleId: bottle.id,
          fullName: bottle.fullName,
        },
      ],
      searchEvidence: [
        {
          query: "collected Bottle evidence",
          results: [{ title: "Collected result", url: collectedUrl }],
        },
      ],
    };

    await expect(
      createBottleCheck(
        auditCheckInput({
          artifacts,
          bottleId: bottle.id,
          summary: "Supported finding.",
          findings: [
            {
              scope: "bottle",
              summary: "The collected evidence supports review.",
              evidenceRefs: [
                { kind: "bottle", bottleId: bottle.id },
                { kind: "web_result", url: collectedUrl },
              ],
            },
          ],
        }),
      ),
    ).resolves.toMatchObject({ created: true });

    await expect(
      createBottleCheck(
        auditCheckInput({
          artifacts: {
            candidates: [
              {
                bottleId: bottle.id,
                fullName: bottle.fullName,
              },
            ],
          },
          bottleId: bottle.id,
          summary: "Uninspected Bottle evidence.",
          findings: [
            {
              scope: "bottle",
              summary: "A candidate alone does not support a finding.",
              evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
            },
          ],
        }),
      ),
    ).rejects.toThrow("must reference an inspected Bottle context");

    await expect(
      createBottleCheck(
        auditCheckInput({
          artifacts: {
            resolvedEntities: [{ entityId: entity.id, name: entity.name }],
          },
          bottleId: bottle.id,
          summary: "Uninspected Entity evidence.",
          findings: [
            {
              scope: "entity",
              summary: "A resolved Entity alone does not support a finding.",
              evidenceRefs: [{ kind: "entity", entityId: entity.id }],
            },
          ],
        }),
      ),
    ).rejects.toThrow("must reference an inspected Entity context");

    await expect(
      createBottleCheck(
        auditCheckInput({
          artifacts,
          bottleId: bottle.id,
          summary: "Fabricated Bottle evidence.",
          findings: [
            {
              scope: "bottle",
              summary: "This cites a Bottle that was not collected.",
              evidenceRefs: [{ kind: "bottle", bottleId: bottle.id + 999_999 }],
            },
          ],
        }),
      ),
    ).rejects.toThrow("Evidence reference was not collected");

    await expect(
      createBottleCheck(
        auditCheckInput({
          artifacts,
          bottleId: bottle.id,
          summary: "Fabricated web evidence.",
          findings: [
            {
              scope: "bottle",
              summary: "This cites a URL that was not collected.",
              evidenceRefs: [
                {
                  kind: "web_result",
                  url: "https://example.com/not-collected",
                },
              ],
            },
          ],
        }),
      ),
    ).rejects.toThrow("Evidence reference was not collected");

    expect(
      await db.query.bottleChecks.findMany({
        where: eq(bottleChecks.bottleId, bottle.id),
      }),
    ).toHaveLength(1);
  });

  test("lists only open actionable Bottle audits with pagination", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const findingBottle = await fixtures.Bottle();
    const pendingBottle = await fixtures.Bottle();
    const blockedBottle = await fixtures.Bottle();
    const doneBottle = await fixtures.Bottle();
    const cleanBottle = await fixtures.Bottle();
    const closedBottle = await fixtures.Bottle();

    const findingCheck = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(findingBottle.id),
        bottleId: findingBottle.id,
        summary: "Finding only.",
        findings: [
          {
            scope: "bottle_group",
            summary: "The Bottle may belong to the wrong group.",
            evidenceRefs: [{ kind: "bottle", bottleId: findingBottle.id }],
          },
        ],
      }),
    );
    const pendingProposal = updateBottleProposal(
      pendingBottle.id,
      "Pending Release",
    );
    const pendingCheck = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(pendingBottle.id),
        bottleId: pendingBottle.id,
        summary: "Pending operation.",
        operations: [
          {
            proposal: pendingProposal,
          },
        ],
      }),
    );
    const blockedProposal = updateBottleProposal(
      blockedBottle.id,
      "Blocked Release",
    );
    const blockedCheck = await createBottleCheck(
      auditCheckInput({
        bottleId: blockedBottle.id,
        summary: "Blocked operation.",
        operations: [
          {
            proposal: blockedProposal,
          },
        ],
      }),
    );
    const doneProposal = updateBottleProposal(doneBottle.id, "Done Release");
    const doneCheck = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(doneBottle.id),
        bottleId: doneBottle.id,
        summary: "Completed operation.",
        operations: [
          {
            proposal: doneProposal,
          },
        ],
      }),
    );
    await db
      .update(bottleOperations)
      .set({ status: "applied" })
      .where(eq(bottleOperations.checkId, doneCheck.check.id));
    await createBottleCheck(
      auditCheckInput({
        bottleId: cleanBottle.id,
        summary: "Clean audit.",
      }),
    );
    const closedCheck = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(closedBottle.id),
        bottleId: closedBottle.id,
        summary: "Closed finding.",
        findings: [
          {
            scope: "bottle",
            summary: "A reviewer should inspect the label.",
            evidenceRefs: [{ kind: "bottle", bottleId: closedBottle.id }],
          },
        ],
      }),
    );
    await closeBottleCheck(
      {
        checkId: closedCheck.check.id,
        reason: "dismissed",
      },
      moderator,
    );

    const firstPage = await listActionableBottleChecks({
      cursor: 1,
      limit: 2,
    });
    const secondPage = await listActionableBottleChecks({
      cursor: 2,
      limit: 2,
    });
    const listedIds = [
      ...firstPage.results.map(({ id }) => id),
      ...secondPage.results.map(({ id }) => id),
    ];

    expect(new Set(listedIds)).toEqual(
      new Set([
        findingCheck.check.id,
        pendingCheck.check.id,
        blockedCheck.check.id,
      ]),
    );
    expect(firstPage.rel).toEqual({
      nextCursor: 2,
      prevCursor: null,
    });
    expect(secondPage.rel).toEqual({
      nextCursor: null,
      prevCursor: 1,
    });
    expect(
      [...firstPage.results, ...secondPage.results].find(
        ({ id }) => id === pendingCheck.check.id,
      )?.operations,
    ).toHaveLength(1);
  });

  test("gets an immutable Bottle check with its operations for review", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const proposal = updateBottleProposal(bottle.id, "Review Release");
    const created = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(bottle.id),
        bottleId: bottle.id,
        summary: "Review this operation.",
        operations: [
          {
            proposal,
          },
        ],
      }),
    );

    expect(await getBottleCheckForReview(created.check.id)).toMatchObject({
      id: created.check.id,
      output: { summary: "Review this operation." },
      operations: [
        {
          proposal,
          status: "pending_review",
        },
      ],
    });
    expect(await getBottleCheckForReview(999999)).toBeNull();
  });

  test("closes finding and blocked-work checks and preserves the first closure", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const created = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(bottle.id),
        bottleId: bottle.id,
        summary: "Finding needs acknowledgement.",
        findings: [
          {
            scope: "other",
            summary: "The evidence remains ambiguous.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
          },
        ],
      }),
    );

    const closed = await closeBottleCheck(
      {
        checkId: created.check.id,
        reason: "resolved_manually",
        note: "Corrected through the existing editor.",
      },
      moderator,
    );
    expect(closed).toMatchObject({
      id: created.check.id,
      closedById: moderator.id,
      closeReason: "resolved_manually",
      closeNote: "Corrected through the existing editor.",
    });
    expect(closed.closedAt).toBeInstanceOf(Date);

    await expect(
      closeBottleCheck(
        {
          checkId: created.check.id,
          reason: "dismissed",
          note: "Attempted replacement.",
        },
        moderator,
      ),
    ).rejects.toBeInstanceOf(BottleCheckAlreadyClosedError);
    expect(await getBottleCheckForReview(created.check.id)).toMatchObject({
      closedById: moderator.id,
      closeReason: "resolved_manually",
      closeNote: "Corrected through the existing editor.",
      closedAt: closed.closedAt,
    });
  });

  test("serializes concurrent close attempts on the parent check", async ({
    fixtures,
  }) => {
    const firstModerator = await fixtures.User({ mod: true });
    const secondModerator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const created = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(bottle.id),
        bottleId: bottle.id,
        summary: "Concurrent finding.",
        findings: [
          {
            scope: "bottle",
            summary: "The finding needs one disposition.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
          },
        ],
      }),
    );
    const concurrentPool = new pg.Pool({
      ...getPostgresConnectionConfig(),
      application_name: "peated-vitest",
      max: 2,
    });
    const concurrentDatabase = drizzle(concurrentPool, { schema });

    const results = await Promise.allSettled([
      closeBottleCheck(
        {
          checkId: created.check.id,
          reason: "dismissed",
          note: "First close.",
        },
        firstModerator,
        concurrentDatabase,
      ),
      closeBottleCheck(
        {
          checkId: created.check.id,
          reason: "resolved_manually",
          note: "Second close.",
        },
        secondModerator,
        concurrentDatabase,
      ),
    ]).finally(async () => {
      await concurrentPool.end();
    });

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(BottleCheckAlreadyClosedError),
    });
    const persisted = await getBottleCheckForReview(created.check.id);
    const completed = results.find(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof closeBottleCheck>>
      > => result.status === "fulfilled",
    );
    if (!completed) throw new Error("Expected one completed close request");
    expect(persisted).toMatchObject({
      closedAt: completed.value.closedAt,
      closedById: completed.value.closedById,
      closeReason: completed.value.closeReason,
      closeNote: completed.value.closeNote,
    });
  });

  test("allows closing checks with blocked, stale, or failed operations", async ({
    fixtures,
  }) => {
    for (const status of ["blocked", "stale", "failed"] as const) {
      const moderator = await fixtures.User({ mod: true });
      const bottle = await fixtures.Bottle();
      const proposal = updateBottleProposal(bottle.id, `${status} Release`);
      const created = await createBottleCheck(
        auditCheckInput({
          artifacts:
            status === "blocked" ? undefined : await bottleArtifacts(bottle.id),
          bottleId: bottle.id,
          summary: `${status} operation.`,
          operations: [{ proposal }],
        }),
      );
      if (status !== "blocked") {
        await db
          .update(bottleOperations)
          .set({ status })
          .where(eq(bottleOperations.checkId, created.check.id));
      }

      await expect(
        closeBottleCheck(
          {
            checkId: created.check.id,
            reason: "dismissed",
          },
          moderator,
        ),
      ).resolves.toMatchObject({
        id: created.check.id,
        closeReason: "dismissed",
      });
    }
  });

  test("refuses to close checks with pending or applying operations", async ({
    fixtures,
  }) => {
    for (const status of ["pending_review", "applying"] as const) {
      const moderator = await fixtures.User({ mod: true });
      const bottle = await fixtures.Bottle();
      const proposal = updateBottleProposal(bottle.id, `${status} Release`);
      const created = await createBottleCheck(
        auditCheckInput({
          artifacts: await bottleArtifacts(bottle.id),
          bottleId: bottle.id,
          summary: `${status} operation.`,
          operations: [
            {
              proposal,
            },
          ],
        }),
      );
      if (status === "applying") {
        await db
          .update(bottleOperations)
          .set({ status })
          .where(eq(bottleOperations.checkId, created.check.id));
      }

      await expect(
        closeBottleCheck(
          {
            checkId: created.check.id,
            reason: "dismissed",
          },
          moderator,
        ),
      ).rejects.toBeInstanceOf(BottleCheckNotClosableError);
      expect(await getBottleCheckForReview(created.check.id)).toMatchObject({
        closedAt: null,
        closeReason: null,
      });
    }
  });

  test("does not explicitly close clean or completed operations-only checks", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const cleanBottle = await fixtures.Bottle();
    const clean = await createBottleCheck(
      auditCheckInput({
        bottleId: cleanBottle.id,
        summary: "Clean.",
      }),
    );
    const doneBottle = await fixtures.Bottle();
    const proposal = updateBottleProposal(doneBottle.id, "Applied Release");
    const done = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(doneBottle.id),
        bottleId: doneBottle.id,
        summary: "Applied.",
        operations: [
          {
            proposal,
          },
        ],
      }),
    );
    await db
      .update(bottleOperations)
      .set({ status: "rejected" })
      .where(eq(bottleOperations.checkId, done.check.id));

    await expect(
      closeBottleCheck(
        { checkId: clean.check.id, reason: "dismissed" },
        moderator,
      ),
    ).rejects.toBeInstanceOf(BottleCheckNotClosableError);
    await expect(
      closeBottleCheck(
        { checkId: done.check.id, reason: "resolved_manually" },
        moderator,
      ),
    ).rejects.toBeInstanceOf(BottleCheckNotClosableError);
    expect(
      (await listActionableBottleChecks()).results.map(({ id }) => id),
    ).not.toEqual(expect.arrayContaining([clean.check.id, done.check.id]));
  });

  test("requires moderator authority to close a Bottle check", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ mod: false, admin: false });
    const created = await createBottleCheck(
      auditCheckInput({
        artifacts: await bottleArtifacts(bottle.id),
        bottleId: bottle.id,
        summary: "Finding.",
        findings: [
          {
            scope: "bottle",
            summary: "Review the Bottle.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
          },
        ],
      }),
    );

    await expect(
      closeBottleCheck(
        { checkId: created.check.id, reason: "dismissed" },
        user,
      ),
    ).rejects.toBeInstanceOf(BottleCheckCloseAuthorizationError);
    expect(await getBottleCheckForReview(created.check.id)).toMatchObject({
      closedAt: null,
      closedById: null,
    });
  });
});
