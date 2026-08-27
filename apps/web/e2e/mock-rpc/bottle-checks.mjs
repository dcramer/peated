export function createBottleCheckMock({
  exactMatchedBottleId,
  exactMergeOtherBottle,
  existingBottle,
  testBrand,
  testUser,
}) {
  const approvedTokens = new Set();
  const rejectedTokens = new Set();
  const linkedStorePriceCheckId = 92;
  const linkedStorePriceOperationId = 703;
  const linkedStorePriceDistillersEdition2023BottleId = 9313;
  const exactMergeOtherBottleId = exactMergeOtherBottle.id;
  const existingBottleId = existingBottle.id;

  function response(value) {
    return { type: "response", value };
  }

  function error(message) {
    return { type: "error", message };
  }

  function handleRpcRequest({ path, input, token }) {
    switch (path) {
      case "admin/moderation/listTasks": {
        const tasks = moderationTasks(token);
        if (tasks === null) return null;
        return response(taskList(tasks));
      }
      case "admin/moderation/task": {
        const tasks = moderationTasks(token);
        if (tasks === null) return null;
        const task = tasks.find(({ key }) => key === input?.key);
        return task ? response({ task }) : error("Moderation task not found");
      }
      case "audits/create":
        if (
          !token.includes("bottle-audit") ||
          input?.bottle !== existingBottleId
        ) {
          return error("Unexpected Bottle audit payload");
        }
        if (input?.note === "Review proposed catalog work.") {
          return response({
            status: "needs_review",
            audit: buildBottleCheckDetails({
              approved: approvedTokens.has(token),
              rejected: rejectedTokens.has(token),
            }).audit,
          });
        }
        if (input?.note !== "Verify the label and catalog identity.") {
          return error("Unexpected Bottle audit note");
        }
        return response({
          status: "clean",
          summary:
            "The Bottle identity is supported by the inspected evidence.",
        });
      case "audits/details":
        if (
          isLinkedStorePriceRequest(token) &&
          Number(input?.audit) === linkedStorePriceCheckId
        ) {
          return response(
            buildLinkedStorePriceCheckDetails({
              approved: approvedTokens.has(token),
            }),
          );
        }
        if (
          !token.includes("bottle-check-review") ||
          Number(input?.audit) !== 91
        ) {
          return null;
        }
        return response(
          buildBottleCheckDetails({
            approved: approvedTokens.has(token),
            rejected: rejectedTokens.has(token),
          }),
        );
      case "audits/list":
        if (isLinkedStorePriceRequest(token)) {
          return response({
            results: [
              buildLinkedStorePriceCheckDetails({
                approved: approvedTokens.has(token),
              }).audit,
            ],
            rel: { nextCursor: null, prevCursor: null },
          });
        }
        if (token.includes("bottle-check-review")) {
          const details = buildBottleCheckDetails({
            approved: approvedTokens.has(token),
            rejected: rejectedTokens.has(token),
          });
          return response({
            results:
              approvedTokens.has(token) && rejectedTokens.has(token)
                ? []
                : [details.audit],
            rel: { nextCursor: null, prevCursor: null },
          });
        }
        return null;
      case "audits/approveSelected":
        if (
          isLinkedStorePriceRequest(token) &&
          input?.audit === linkedStorePriceCheckId &&
          Array.isArray(input?.operations) &&
          input.operations.length === 1 &&
          input.operations[0]?.operationId === linkedStorePriceOperationId
        ) {
          approvedTokens.add(token);
          return response({
            results: [
              {
                operationId: linkedStorePriceOperationId,
                status: "applied",
                error: null,
              },
            ],
          });
        }
        if (
          !token.includes("bottle-check-review") ||
          input?.audit !== 91 ||
          !Array.isArray(input?.operations) ||
          input.operations.length !== 1 ||
          input.operations[0]?.operationId !== 701
        ) {
          return error("Unexpected Bottle Check approval payload");
        }
        approvedTokens.add(token);
        return response({
          results: [{ operationId: 701, status: "applied", error: null }],
        });
      case "audits/rejectSelected":
        if (!token.includes("bottle-check-review")) {
          return null;
        }
        if (
          input?.audit !== 91 ||
          !Array.isArray(input?.operationIds) ||
          input.operationIds.length !== 1 ||
          input.operationIds[0] !== 702 ||
          input.reason !== "wrong_change" ||
          input.note !== undefined
        ) {
          return error("Unexpected Bottle Check rejection payload");
        }
        rejectedTokens.add(token);
        return response({
          results: [{ operationId: 702, status: "rejected", error: null }],
        });
      default:
        return null;
    }
  }

  function isLinkedStorePriceRequest(token) {
    return token.includes("queue-linked-check");
  }

  function moderationTasks(token) {
    if (isLinkedStorePriceRequest(token)) {
      const details = buildLinkedStorePriceCheckDetails({
        approved: approvedTokens.has(token),
      });
      return details.audit.operations
        .filter(({ status }) => ["blocked", "pending_review"].includes(status))
        .map((operation) => operationTask(details.audit, operation));
    }
    if (!token.includes("bottle-check-review")) return null;
    const details = buildBottleCheckDetails({
      approved: approvedTokens.has(token),
      rejected: rejectedTokens.has(token),
    });
    return details.audit.operations
      .filter(({ status }) => ["blocked", "pending_review"].includes(status))
      .map((operation) => operationTask(details.audit, operation));
  }

  function taskList(tasks) {
    return {
      results: tasks,
      counts: {
        all: tasks.length,
        listing: 0,
        catalog: tasks.length,
        blocked: tasks.filter(({ state }) => state === "blocked").length,
        inconclusive: 0,
      },
      rel: { nextCursor: null, prevCursor: null },
    };
  }

  function operationTask(audit, operation) {
    const copy =
      operation.proposal.type === "merge_bottles"
        ? {
            question: "Merge these Bottle records?",
            title: `Merge Bottle #${operation.proposal.input.sourceBottleId} into #${operation.proposal.input.destinationBottleId}`,
          }
        : {
            question: "Apply these changes to the Entity?",
            title: `Update Entity #${operation.proposal.input.entityId}`,
          };
    return {
      key: `operation:${operation.id}`,
      kind: "operation",
      category: "catalog",
      state: operation.status === "blocked" ? "blocked" : "ready",
      inconclusive: false,
      title: copy.title,
      sourceLabel:
        audit.intent === "resolve_reference"
          ? "Incoming listing follow-up"
          : "Moderator audit",
      question: copy.question,
      statusLabel:
        operation.status === "blocked" ? "Blocked" : "Suggested change",
      attentionAt: operation.createdAt,
      source: {
        kind: "operation",
        checkId: audit.id,
        operationId: operation.id,
      },
    };
  }

  function buildLinkedStorePriceCheckDetails({ approved }) {
    const timestamp = "2026-07-30T00:00:00.000Z";
    const proposal = {
      type: "merge_bottles",
      input: {
        sourceBottleId: exactMergeOtherBottleId,
        destinationBottleId: existingBottleId,
      },
      rationale:
        "The inspected listing matched the canonical Bottle, while this second inspected Bottle is an exact duplicate.",
      evidenceRefs: [
        { kind: "bottle", bottleId: exactMergeOtherBottleId },
        { kind: "bottle", bottleId: existingBottleId },
      ],
    };
    const exact = {
      edition: null,
      statedAge: null,
      abv: null,
      singleCask: null,
      caskStrength: null,
      vintageYear: null,
      releaseYear: null,
      caskNumber: null,
      maturation: null,
      outturn: null,
    };
    const brand = {
      kind: "existing",
      entityId: testBrand.id,
      name: testBrand.name,
      shortName: testBrand.shortName,
      entityKind: testBrand.kind,
    };
    const source = {
      bottleId: exactMergeOtherBottleId,
      groupId: 301,
      fullName: exactMergeOtherBottle.fullName,
      shared: {
        name: exactMergeOtherBottle.name,
        statedAge: null,
        seriesId: null,
        category: "single_malt",
        brand,
        distillers: [brand],
        bottler: null,
      },
      exact,
    };
    const destination = {
      bottleId: existingBottleId,
      groupId: 302,
      fullName: existingBottle.fullName,
      shared: {
        name: existingBottle.name,
        statedAge: null,
        seriesId: null,
        category: "single_malt",
        brand,
        distillers: [brand],
        bottler: null,
      },
      exact,
    };
    const operation = {
      id: linkedStorePriceOperationId,
      checkId: linkedStorePriceCheckId,
      proposal,
      excludedFields: [],
      preparationError: null,
      status: approved ? "applied" : "pending_review",
      reviewedById: approved ? testUser.id : null,
      reviewedAt: approved ? timestamp : null,
      rejectionReason: null,
      reviewerNote: null,
      result: approved
        ? {
            type: "merge_bottles",
            status: "applied",
            sourceBottleId: exactMergeOtherBottleId,
            destinationBottleId: existingBottleId,
            changed: true,
          }
        : null,
      error: null,
      executionStartedAt: approved ? timestamp : null,
      executionCompletedAt: approved ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return {
      audit: {
        id: linkedStorePriceCheckId,
        intent: "resolve_reference",
        origin: null,
        sourceKind: "store_price",
        sourceId: "9912",
        bottleId: null,
        schemaVersion: 2,
        schemaSupported: true,
        output: {
          status: "classified",
          decision: {
            action: "match",
            rationale:
              "The store listing is matched; one duplicate Bottle still needs moderator disposition.",
            candidateBottleIds: [existingBottleId],
            identityScope: "product",
            aliasScope: null,
            observation: null,
            confidenceBasis: null,
            matchedBottleId: existingBottleId,
            proposedBottle: null,
          },
          findings: [
            {
              scope: "bottle_group",
              summary:
                "The surviving 2023 and 2024 Distillers Edition Bottles share the same stable expression but appear split across separate Bottle groups.",
              evidenceRefs: [
                {
                  kind: "bottle",
                  bottleId: linkedStorePriceDistillersEdition2023BottleId,
                },
                { kind: "bottle", bottleId: exactMatchedBottleId },
              ],
            },
          ],
        },
        model: "playwright-model",
        modelMetadata: {
          agentDurationMs: 2_400,
          usage: {
            requests: 2,
            inputTokens: 10_000,
            outputTokens: 800,
            totalTokens: 10_800,
          },
          toolCalls: { count: 3, names: ["search_bottles"] },
          cost: {
            scope: "agent_loop_only",
            costCoverage: "priced_model_tokens",
            estimatedAgentLoopCostUsd: 0.044,
            pricingModel: "gpt-5.6-terra",
            pricingEffectiveDate: "2026-08-01",
            pricingSource: "https://developers.openai.com/api/docs/pricing",
            pricingBasis: "standard_short_context",
          },
        },
        error: null,
        storePriceMatchProposalId: 9911,
        storePriceMatchAttemptId: 9914,
        closedById: null,
        closeReason: null,
        closeNote: null,
        createdAt: timestamp,
        completedAt: timestamp,
        closedAt: null,
        operations: [operation],
      },
      reviewOperations: [
        {
          operationId: linkedStorePriceOperationId,
          approvalReady: !approved,
          review: approved
            ? null
            : {
                id: linkedStorePriceOperationId,
                type: "merge_bottles",
                status: "pending_review",
                proposal,
                preview: {
                  source,
                  destination,
                  outcome: {
                    retiredBottleId: exactMergeOtherBottleId,
                    survivorBottleId: existingBottleId,
                    tombstoneDestinationBottleId: existingBottleId,
                  },
                  consumers: {
                    tastings: 1,
                    externalReviews: 0,
                    storePrices: 1,
                    observations: 0,
                    collectionMemberships: 0,
                    flightMemberships: 0,
                    aliases: 1,
                  },
                  membershipCollisions: {
                    collections: 0,
                    flights: 0,
                  },
                  warnings: [],
                },
              },
        },
      ],
    };
  }

  function buildBottleCheckDetails({ approved, rejected }) {
    const timestamp = "2026-07-30T00:00:00.000Z";
    const operations = [
      {
        id: 701,
        checkId: 91,
        excludedFields: [],
        proposal: {
          type: "update_entity",
          input: {
            entityId: 42,
            patch: { name: "Correct Brand" },
          },
          rationale: "Rename the inspected Brand from current evidence.",
          evidenceRefs: [{ kind: "entity", entityId: 42 }],
        },
        preparationError: null,
        status: approved ? "applied" : "pending_review",
        reviewedById: approved ? testUser.id : null,
        reviewedAt: approved ? timestamp : null,
        rejectionReason: null,
        reviewerNote: null,
        result: approved
          ? {
              type: "update_entity",
              status: "applied",
              entityId: 42,
              changed: true,
            }
          : null,
        error: null,
        executionStartedAt: approved ? timestamp : null,
        executionCompletedAt: approved ? timestamp : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 702,
        checkId: 91,
        excludedFields: [],
        proposal: {
          type: "update_entity",
          input: {
            entityId: 43,
            patch: { name: "Second Correct Brand" },
          },
          rationale: "Review the second inspected Brand independently.",
          evidenceRefs: [{ kind: "entity", entityId: 43 }],
        },
        preparationError: null,
        status: rejected ? "rejected" : "pending_review",
        reviewedById: rejected ? testUser.id : null,
        reviewedAt: rejected ? timestamp : null,
        rejectionReason: rejected ? "wrong_change" : null,
        reviewerNote: null,
        result: null,
        error: null,
        executionStartedAt: null,
        executionCompletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];
    const entityReview = ({ id, entityId, beforeName, afterName }) => ({
      id,
      type: "update_entity",
      status: "pending_review",
      proposal: operations.find((operation) => operation.id === id).proposal,
      preview: {
        before: {
          entityId,
          name: beforeName,
          shortName: null,
          kind: "brand",
          website: null,
          location: { country: null, region: null },
          yearEstablished: null,
        },
        after: {
          entityId,
          name: afterName,
          shortName: null,
          kind: "brand",
          website: null,
          location: { country: null, region: null },
          yearEstablished: null,
        },
        changedFields: ["name"],
        impact: {
          bottles: 1,
          brandGroups: 1,
          bottlerGroups: 0,
          distillerGroups: 0,
          series: 0,
          aliases: 0,
        },
        warnings: [],
      },
    });

    return {
      audit: {
        id: 91,
        intent: "audit_bottle",
        origin: "moderator",
        sourceKind: null,
        sourceId: null,
        bottleId: existingBottleId,
        schemaVersion: 2,
        schemaSupported: true,
        output: {
          summary: "Review two independent Entity corrections.",
          findings: [],
        },
        model: "playwright-model",
        modelMetadata: {
          agentDurationMs: 2_400,
          usage: {
            requests: 2,
            inputTokens: 10_000,
            outputTokens: 800,
            totalTokens: 10_800,
          },
          toolCalls: { count: 3, names: ["search_bottles"] },
          cost: {
            scope: "agent_loop_only",
            costCoverage: "priced_model_tokens",
            estimatedAgentLoopCostUsd: 0.044,
            pricingModel: "gpt-5.6-terra",
            pricingEffectiveDate: "2026-08-01",
            pricingSource: "https://developers.openai.com/api/docs/pricing",
            pricingBasis: "standard_short_context",
          },
        },
        error: null,
        storePriceMatchProposalId: null,
        storePriceMatchAttemptId: null,
        closedById: null,
        closeReason: null,
        closeNote: null,
        createdAt: timestamp,
        completedAt: timestamp,
        closedAt: null,
        operations,
      },
      reviewOperations: [
        {
          operationId: 701,
          approvalReady: !approved,
          review: approved
            ? null
            : entityReview({
                id: 701,
                entityId: 42,
                beforeName: "Wrong Brand",
                afterName: "Correct Brand",
              }),
        },
        {
          operationId: 702,
          approvalReady: false,
          review: rejected
            ? null
            : entityReview({
                id: 702,
                entityId: 43,
                beforeName: "Second Brand Changed Elsewhere",
                afterName: "Second Correct Brand",
              }),
        },
      ],
    };
  }

  return {
    handleRpcRequest,
    isLinkedStorePriceRequest,
  };
}
