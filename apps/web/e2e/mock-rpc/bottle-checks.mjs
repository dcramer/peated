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
      case "bottleChecks/audit":
        if (
          !token.includes("bottle-audit") ||
          input?.bottle !== existingBottleId
        ) {
          return error("Unexpected Bottle audit payload");
        }
        if (input?.note === "Review proposed catalog work.") {
          return response({
            status: "needs_review",
            check: buildBottleCheckDetails({
              approved: approvedTokens.has(token),
              rejected: rejectedTokens.has(token),
            }).check,
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
      case "bottleChecks/details":
        if (
          isLinkedStorePriceRequest(token) &&
          Number(input?.check) === linkedStorePriceCheckId
        ) {
          return response(
            buildLinkedStorePriceCheckDetails({
              approved: approvedTokens.has(token),
            }),
          );
        }
        if (
          !token.includes("bottle-check-review") ||
          Number(input?.check) !== 91
        ) {
          return null;
        }
        return response(
          buildBottleCheckDetails({
            approved: approvedTokens.has(token),
            rejected: rejectedTokens.has(token),
          }),
        );
      case "bottleChecks/approveSelected":
        if (
          isLinkedStorePriceRequest(token) &&
          input?.check === linkedStorePriceCheckId &&
          Array.isArray(input?.operationIds) &&
          input.operationIds.length === 1 &&
          input.operationIds[0] === linkedStorePriceOperationId
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
          input?.check !== 91 ||
          !Array.isArray(input?.operationIds) ||
          input.operationIds.length !== 1 ||
          input.operationIds[0] !== 701
        ) {
          return error("Unexpected Bottle Check approval payload");
        }
        approvedTokens.add(token);
        return response({
          results: [{ operationId: 701, status: "applied", error: null }],
        });
      case "bottleChecks/rejectSelected":
        if (!token.includes("bottle-check-review")) {
          return null;
        }
        if (
          input?.check !== 91 ||
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
      caskSize: null,
      caskType: null,
      caskFill: null,
    };
    const brand = {
      kind: "existing",
      entityId: testBrand.id,
      name: testBrand.name,
      shortName: testBrand.shortName,
      roles: testBrand.type,
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
      check: {
        id: linkedStorePriceCheckId,
        intent: "resolve_reference",
        origin: null,
        sourceKind: "store_price",
        sourceId: "9912",
        bottleId: null,
        schemaVersion: 1,
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
            identityBasis: null,
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
                    reviews: 0,
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
          roles: ["brand"],
          website: null,
          location: { country: null, region: null },
          yearEstablished: null,
        },
        after: {
          entityId,
          name: afterName,
          shortName: null,
          roles: ["brand"],
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
      check: {
        id: 91,
        intent: "audit_bottle",
        origin: "moderator",
        sourceKind: null,
        sourceId: null,
        bottleId: existingBottleId,
        schemaVersion: 1,
        schemaSupported: true,
        output: {
          summary: "Review two independent Entity corrections.",
          findings: [],
        },
        model: "playwright-model",
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

  function buildLinkedStorePriceQueueProposal(proposal) {
    return {
      ...proposal,
      id: 9911,
      status: "approved",
      proposalType: "match_existing",
      proposedBottle: null,
      bottleCheckIds: [linkedStorePriceCheckId],
      price: {
        ...proposal.price,
        id: 9912,
        name: "Playwright Store matched listing with supplemental work",
        bottle: existingBottle,
      },
      currentBottle: existingBottle,
      suggestedBottle: existingBottle,
    };
  }

  return {
    buildLinkedStorePriceQueueProposal,
    handleRpcRequest,
    isLinkedStorePriceRequest,
  };
}
