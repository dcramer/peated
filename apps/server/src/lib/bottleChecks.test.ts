import type { Finding, ProposedOperation } from "@peated/bottle-classifier";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import * as schema from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleChecks,
  bottleOperations,
  bottles,
} from "@peated/server/db/schema";
import {
  BottleCheckAlreadyClosedError,
  BottleCheckCloseAuthorizationError,
  BottleCheckNotClosableError,
  closeBottleCheck,
  createBottleCheck,
  getBottleCheckForReview,
  getBottleCheckHistory,
  getLatestBottleCheck,
  listActionableBottleChecks,
} from "@peated/server/lib/bottleChecks";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

function updateBottleProposal(
  bottleId: number,
  edition: string,
): ProposedOperation {
  return {
    type: "update_bottle",
    input: {
      bottleId,
      patch: {
        exact: {
          edition,
        },
      },
    },
    rationale: `Use the ${edition} edition.`,
    evidenceRefs: [{ kind: "bottle", bottleId }],
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
  artifacts?: Record<string, unknown>;
  backgroundEventKey?: string;
  bottleId: number;
  findings?: Finding[];
  operations?: Array<
    | {
        preparationError: {
          code: string;
          message: string;
        };
        proposal: ProposedOperation;
        status: "blocked";
      }
    | {
        proposal: ProposedOperation;
        resolvedEvidenceRefs: ProposedOperation["evidenceRefs"];
        stateToken: Record<string, unknown>;
        status: "pending_review";
      }
  >;
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
    operations,
    backgroundEventKey,
    model: "test-model",
    modelMetadata: {
      provider: "test",
    },
  };
}

describe("Bottle check persistence", () => {
  test("sanitizes inline images and stores output and artifacts once", async () => {
    const inlineImage = `data:image/jpeg;base64,${Buffer.from(
      "not really an image",
    ).toString("base64")}`;

    const result = await createBottleCheck({
      intent: "resolve_reference",
      sourceKind: "store_price",
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
        proposedOperations: [],
        findings: [],
        artifacts: {
          candidates: [],
          searchEvidence: [],
          resolvedEntities: [],
        },
      },
      operations: [],
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

  test("inserts pending and blocked operations atomically", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingProposal = updateBottleProposal(
      bottle.id,
      "Warehouse 1 Release",
    );
    const blockedProposal = updateBottleProposal(
      bottle.id,
      "Unsupported Release",
    );

    const result = await createBottleCheck(
      auditCheckInput({
        bottleId: bottle.id,
        summary: "Two possible corrections.",
        operations: [
          {
            status: "pending_review",
            proposal: pendingProposal,
            resolvedEvidenceRefs: pendingProposal.evidenceRefs,
            stateToken: {
              bottleId: bottle.id,
              exact: {
                edition: null,
              },
            },
          },
          {
            status: "blocked",
            proposal: blockedProposal,
            preparationError: {
              code: "unsupported_change",
              message: "The exact change cannot be prepared.",
            },
          },
        ],
      }),
    );

    expect(result.check.operations).toHaveLength(2);
    expect(
      result.check.operations
        .map(({ status }) => status)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(["blocked", "pending_review"]);

    const pending = result.check.operations.find(
      ({ status }) => status === "pending_review",
    );
    expect(pending).toMatchObject({
      stateToken: {
        bottleId: bottle.id,
        exact: {
          edition: null,
        },
      },
      resolvedEvidenceRefs: pendingProposal.evidenceRefs,
      preparationError: null,
    });

    const blocked = result.check.operations.find(
      ({ status }) => status === "blocked",
    );
    expect(blocked).toMatchObject({
      stateToken: null,
      resolvedEvidenceRefs: null,
      preparationError: {
        code: "unsupported_change",
        message: "The exact change cannot be prepared.",
      },
    });
  });

  test("rejects resolved evidence references that do not exactly match the proposal", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const proposal = updateBottleProposal(bottle.id, "Warehouse 1 Release");

    await expect(
      createBottleCheck(
        auditCheckInput({
          bottleId: bottle.id,
          summary: "One possible correction.",
          operations: [
            {
              status: "pending_review",
              proposal,
              resolvedEvidenceRefs: [
                { kind: "bottle", bottleId: otherBottle.id },
              ],
              stateToken: {
                bottleId: bottle.id,
                exact: {
                  edition: null,
                },
              },
            },
          ],
        }),
      ),
    ).rejects.toThrow(
      "Persisted resolved evidence references must exactly match the proposal.",
    );

    expect(
      await getBottleCheckHistory({
        intent: "audit_bottle",
        bottleId: bottle.id,
      }),
    ).toEqual([]);
  });

  test("rejects serialized state tokens before persistence", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const proposal = updateBottleProposal(bottle.id, "Warehouse 1 Release");
    const input = auditCheckInput({
      bottleId: bottle.id,
      summary: "One possible correction.",
    });

    await expect(
      createBottleCheck({
        ...input,
        result: {
          ...input.result,
          proposedOperations: [proposal],
        },
        operations: [
          {
            status: "pending_review",
            proposal,
            resolvedEvidenceRefs: proposal.evidenceRefs,
            stateToken: JSON.stringify({
              bottleId: bottle.id,
              exact: {
                edition: null,
              },
            }),
          },
        ],
      }),
    ).rejects.toThrow();

    expect(
      await getBottleCheckHistory({
        intent: "audit_bottle",
        bottleId: bottle.id,
      }),
    ).toEqual([]);
  });

  test("rejects state tokens beyond the structural bounds", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const proposal = updateBottleProposal(bottle.id, "Warehouse 1 Release");
    const input = auditCheckInput({
      bottleId: bottle.id,
      summary: "One possible correction.",
    });

    await expect(
      createBottleCheck({
        ...input,
        result: {
          ...input.result,
          proposedOperations: [proposal],
        },
        operations: [
          {
            status: "pending_review",
            proposal,
            resolvedEvidenceRefs: proposal.evidenceRefs,
            stateToken: {
              affectedIds: Array.from({ length: 101 }, (_, index) => index + 1),
            },
          },
        ],
      }),
    ).rejects.toThrow();

    expect(
      await getBottleCheckHistory({
        intent: "audit_bottle",
        bottleId: bottle.id,
      }),
    ).toEqual([]);
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

  test("keeps moderator reruns as immutable history and selects the latest", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const firstProposal = updateBottleProposal(bottle.id, "First Review");
    const first = await createBottleCheck(
      auditCheckInput({
        bottleId: bottle.id,
        summary: "First moderator review.",
        operations: [
          {
            status: "pending_review",
            proposal: firstProposal,
            resolvedEvidenceRefs: firstProposal.evidenceRefs,
            stateToken: {
              bottleId: bottle.id,
              exact: {
                edition: null,
              },
            },
          },
        ],
      }),
    );
    const second = await createBottleCheck(
      auditCheckInput({
        bottleId: bottle.id,
        summary: "Forced second moderator review.",
      }),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(second.check.id).not.toBe(first.check.id);

    const latest = await getLatestBottleCheck({
      intent: "audit_bottle",
      bottleId: bottle.id,
    });
    const history = await getBottleCheckHistory({
      intent: "audit_bottle",
      bottleId: bottle.id,
    });

    expect(latest?.id).toBe(second.check.id);
    expect(history.map(({ id }) => id)).toEqual([
      second.check.id,
      first.check.id,
    ]);
    expect(history[1]).toMatchObject({
      output: {
        summary: "First moderator review.",
      },
      operations: [
        {
          status: "pending_review",
          stateToken: {
            bottleId: bottle.id,
            exact: {
              edition: null,
            },
          },
        },
      ],
    });
  });

  test("retains audit history after the Bottle is deleted", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();
    const created = await createBottleCheck(
      auditCheckInput({
        bottleId: bottle.id,
        summary: "Audit before deletion.",
      }),
    );

    await db.delete(bottleAliases).where(eq(bottleAliases.bottleId, bottle.id));
    await db.delete(bottles).where(eq(bottles.id, bottle.id));

    const history = await getBottleCheckHistory({
      intent: "audit_bottle",
      bottleId: bottle.id,
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: created.check.id,
      bottleId: null,
      output: {
        summary: "Audit before deletion.",
      },
    });
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

    const history = await getBottleCheckHistory({
      intent: "audit_bottle",
      bottleId: bottle.id,
    });
    expect(history).toEqual([]);
  });

  test("persists findings only when every evidence reference was collected", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const collectedUrl = "https://example.com/collected-bottle-evidence";
    const artifacts = {
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
      await getBottleCheckHistory({
        intent: "audit_bottle",
        bottleId: bottle.id,
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
        bottleId: pendingBottle.id,
        summary: "Pending operation.",
        operations: [
          {
            status: "pending_review",
            proposal: pendingProposal,
            resolvedEvidenceRefs: pendingProposal.evidenceRefs,
            stateToken: { bottleId: pendingBottle.id },
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
            status: "blocked",
            proposal: blockedProposal,
            preparationError: {
              code: "invalid_current_state",
              message: "Cannot prepare the operation.",
            },
          },
        ],
      }),
    );
    const doneProposal = updateBottleProposal(doneBottle.id, "Done Release");
    const doneCheck = await createBottleCheck(
      auditCheckInput({
        bottleId: doneBottle.id,
        summary: "Completed operation.",
        operations: [
          {
            status: "pending_review",
            proposal: doneProposal,
            resolvedEvidenceRefs: doneProposal.evidenceRefs,
            stateToken: { bottleId: doneBottle.id },
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
        bottleId: bottle.id,
        summary: "Review this operation.",
        operations: [
          {
            status: "pending_review",
            proposal,
            resolvedEvidenceRefs: proposal.evidenceRefs,
            stateToken: { bottleId: bottle.id },
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
      ({ status }) => status === "fulfilled",
    ) as PromiseFulfilledResult<Awaited<ReturnType<typeof closeBottleCheck>>>;
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
          bottleId: bottle.id,
          summary: `${status} operation.`,
          operations: [
            status === "blocked"
              ? {
                  status: "blocked",
                  proposal,
                  preparationError: {
                    code: "invalid_current_state",
                    message: "Cannot prepare the operation.",
                  },
                }
              : {
                  status: "pending_review",
                  proposal,
                  resolvedEvidenceRefs: proposal.evidenceRefs,
                  stateToken: { bottleId: bottle.id },
                },
          ],
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
          bottleId: bottle.id,
          summary: `${status} operation.`,
          operations: [
            {
              status: "pending_review",
              proposal,
              resolvedEvidenceRefs: proposal.evidenceRefs,
              stateToken: { bottleId: bottle.id },
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
        bottleId: doneBottle.id,
        summary: "Applied.",
        operations: [
          {
            status: "pending_review",
            proposal,
            resolvedEvidenceRefs: proposal.evidenceRefs,
            stateToken: { bottleId: doneBottle.id },
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
