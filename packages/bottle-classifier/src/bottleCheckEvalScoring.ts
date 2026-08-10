import type {
  BottleOperationEntityChoice,
  EvidenceRef,
  Finding,
  ProposedOperation,
} from "./bottleCheckContract";
import type { BottleClassificationArtifacts } from "./contract";
import { webEvidenceUrlsMatch } from "./webEvidenceUrl";

export type BottleCheckSetScore = {
  score: number;
  precision: number;
  recall: number;
  matchedCount: number;
  expectedCount: number;
  actualCount: number;
  missingCount: number;
  extraCount: number;
};

export type BottleCheckSemanticScore = {
  operations: BottleCheckSetScore;
  findings: BottleCheckSetScore;
};

export type BottleCheckGroundingScore = {
  score: number;
  uninspectedTargets: Array<{
    operationIndex: number;
    kind: "bottle" | "entity" | "series";
    id: number;
  }>;
  uncollectedEvidence: Array<{
    owner: "operation" | "finding";
    itemIndex: number;
    evidenceRef: EvidenceRef;
  }>;
  missingRequiredEvidence: Array<{
    operationType: ProposedOperation["type"];
    missingEvidenceRefs: EvidenceRef[];
  }>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }

  return value;
}

function stableKey(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function scoreExactSet(
  expectedKeys: string[],
  actualKeys: string[],
  extraWeight: number,
): BottleCheckSetScore {
  const remainingExpected = new Map<string, number>();
  for (const key of expectedKeys) {
    remainingExpected.set(key, (remainingExpected.get(key) ?? 0) + 1);
  }

  let matchedCount = 0;
  let extraCount = 0;
  for (const key of actualKeys) {
    const remaining = remainingExpected.get(key) ?? 0;
    if (remaining > 0) {
      matchedCount += 1;
      remainingExpected.set(key, remaining - 1);
    } else {
      extraCount += 1;
    }
  }

  const missingCount = expectedKeys.length - matchedCount;
  const precision =
    actualKeys.length === 0
      ? expectedKeys.length === 0
        ? 1
        : 0
      : matchedCount / actualKeys.length;
  const recall =
    expectedKeys.length === 0 ? 1 : matchedCount / expectedKeys.length;
  const score =
    expectedKeys.length === 0 && actualKeys.length === 0
      ? 1
      : Math.max(
          0,
          (matchedCount - extraWeight * extraCount) /
            Math.max(expectedKeys.length, 1),
        );

  return {
    score,
    precision,
    recall,
    matchedCount,
    expectedCount: expectedKeys.length,
    actualCount: actualKeys.length,
    missingCount,
    extraCount,
  };
}

function operationKey(operation: ProposedOperation): string {
  return stableKey({
    type: operation.type,
    input: operation.input,
  });
}

// Finding prose may vary. Scope plus sorted typed refs is the deterministic
// expectation signature; grounding separately verifies that those refs exist.
function findingKey(finding: Finding): string {
  return stableKey({
    scope: finding.scope,
    evidenceRefs: [...finding.evidenceRefs]
      .map(stableKey)
      .sort()
      .map((key) => JSON.parse(key)),
  });
}

function existingEntityId(
  choice: BottleOperationEntityChoice | null | undefined,
) {
  return choice?.kind === "existing" ? choice.entityId : null;
}

export type BottleCheckOperationTarget = {
  kind: "bottle" | "entity" | "series";
  id: number;
  path: Array<number | string>;
};

export function listBottleCheckOperationTargets(
  operation: ProposedOperation,
): BottleCheckOperationTarget[] {
  switch (operation.type) {
    case "update_bottle": {
      const patch = operation.input.patch;
      const entityTarget = (
        choice: BottleOperationEntityChoice | null | undefined,
        path: Array<number | string>,
      ): BottleCheckOperationTarget[] => {
        const id = existingEntityId(choice);
        return id === null ? [] : [{ kind: "entity", id, path }];
      };
      return [
        {
          kind: "bottle",
          id: operation.input.bottleId,
          path: ["bottleId"],
        },
        ...(patch.seriesId
          ? [
              {
                kind: "series" as const,
                id: patch.seriesId,
                path: ["patch", "seriesId"],
              },
            ]
          : []),
        ...entityTarget(patch.brand, ["patch", "brand", "entityId"]),
        ...(patch.distillers ?? []).flatMap((choice, index) =>
          entityTarget(choice, ["patch", "distillers", index, "entityId"]),
        ),
        ...entityTarget(patch.bottler, ["patch", "bottler", "entityId"]),
      ];
    }
    case "merge_bottles":
      return [
        {
          kind: "bottle",
          id: operation.input.sourceBottleId,
          path: ["sourceBottleId"],
        },
        {
          kind: "bottle",
          id: operation.input.destinationBottleId,
          path: ["destinationBottleId"],
        },
      ];
    case "update_entity":
      return [
        {
          kind: "entity",
          id: operation.input.entityId,
          path: ["entityId"],
        },
      ];
    case "merge_entities":
      return [
        {
          kind: "entity",
          id: operation.input.sourceEntityId,
          path: ["sourceEntityId"],
        },
        {
          kind: "entity",
          id: operation.input.destinationEntityId,
          path: ["destinationEntityId"],
        },
      ];
  }
}

function getBottleCheckGroundingIssues(
  actual: {
    proposedOperations: ProposedOperation[];
    findings: Finding[];
    artifacts: BottleClassificationArtifacts;
  },
  sourceFields: readonly string[] = [],
) {
  const inspectedBottleIds = new Set(
    actual.artifacts.bottleContexts.map(({ bottleId }) => bottleId),
  );
  const inspectedEntityIds = new Set(
    actual.artifacts.entityContexts.map(({ entityId }) => entityId),
  );
  const inspectedSeriesIds = new Set(
    actual.artifacts.bottleContexts.flatMap(({ shared }) =>
      shared.series ? [shared.series.seriesId] : [],
    ),
  );

  const collectedBottleIds = new Set<number>();
  const collectedEntityIds = new Set<number>();
  for (const candidate of actual.artifacts.candidates) {
    collectedBottleIds.add(candidate.bottleId);
    for (const sibling of candidate.familyContext?.siblingBottles ?? []) {
      collectedBottleIds.add(sibling.bottleId);
    }
  }
  for (const context of actual.artifacts.bottleContexts) {
    collectedBottleIds.add(context.bottleId);
    for (const sibling of context.siblings) {
      collectedBottleIds.add(sibling.bottleId);
    }
    collectedEntityIds.add(context.shared.brand.entityId);
    for (const distiller of context.shared.distillers) {
      collectedEntityIds.add(distiller.entityId);
    }
    if (context.shared.bottler) {
      collectedEntityIds.add(context.shared.bottler.entityId);
    }
  }
  for (const context of actual.artifacts.entityContexts) {
    collectedEntityIds.add(context.entityId);
    for (const bottle of context.relatedBottles) {
      collectedBottleIds.add(bottle.bottleId);
    }
  }
  for (const entity of actual.artifacts.resolvedEntities) {
    collectedEntityIds.add(entity.entityId);
  }

  const collectedSourceFields = new Set(sourceFields);
  const collectedWebUrls = actual.artifacts.searchEvidence.flatMap(
    ({ results }) => results.map(({ url }) => url),
  );
  const evidenceWasCollected = (evidenceRef: EvidenceRef) => {
    switch (evidenceRef.kind) {
      case "source":
        return collectedSourceFields.has(evidenceRef.field);
      case "bottle":
        return collectedBottleIds.has(evidenceRef.bottleId);
      case "entity":
        return collectedEntityIds.has(evidenceRef.entityId);
      case "web_result":
        return collectedWebUrls.some((url) =>
          webEvidenceUrlsMatch(url, evidenceRef.url),
        );
    }
  };

  return {
    uninspectedTargets: actual.proposedOperations.flatMap(
      (operation, operationIndex) =>
        listBottleCheckOperationTargets(operation).flatMap((target) => {
          const inspected =
            target.kind === "bottle"
              ? inspectedBottleIds.has(target.id)
              : target.kind === "entity"
                ? inspectedEntityIds.has(target.id)
                : inspectedSeriesIds.has(target.id);
          return inspected
            ? []
            : [{ operationIndex, kind: target.kind, id: target.id }];
        }),
    ),
    uncollectedEvidence: [
      ...actual.proposedOperations.flatMap((operation, itemIndex) =>
        operation.evidenceRefs.flatMap((evidenceRef) =>
          evidenceWasCollected(evidenceRef)
            ? []
            : [{ owner: "operation" as const, itemIndex, evidenceRef }],
        ),
      ),
      ...actual.findings.flatMap((finding, itemIndex) =>
        finding.evidenceRefs.flatMap((evidenceRef) =>
          evidenceWasCollected(evidenceRef)
            ? []
            : [{ owner: "finding" as const, itemIndex, evidenceRef }],
        ),
      ),
    ],
  };
}

export function scoreBottleCheckSemanticOutput(
  expected: {
    proposedOperations: ProposedOperation[];
    findings: Finding[];
  },
  actual: {
    proposedOperations: ProposedOperation[];
    findings: Finding[];
  },
): BottleCheckSemanticScore {
  return {
    operations: scoreExactSet(
      expected.proposedOperations.map(operationKey),
      actual.proposedOperations.map(operationKey),
      3,
    ),
    findings: scoreExactSet(
      expected.findings.map(findingKey),
      actual.findings.map(findingKey),
      2,
    ),
  };
}

function requiredEvidenceMatches(
  expected: EvidenceRef,
  actual: EvidenceRef,
): boolean {
  if (expected.kind === "web_result" && actual.kind === "web_result") {
    return webEvidenceUrlsMatch(expected.url, actual.url);
  }

  return stableKey(expected) === stableKey(actual);
}

export function scoreBottleCheckGrounding(
  actual: {
    proposedOperations: ProposedOperation[];
    findings: Finding[];
    artifacts: BottleClassificationArtifacts;
  },
  sourceFields: readonly string[] = [],
  expectedOperations?: ProposedOperation[],
): BottleCheckGroundingScore {
  const { uninspectedTargets, uncollectedEvidence } =
    getBottleCheckGroundingIssues(actual, sourceFields);
  const missingRequiredEvidence = (expectedOperations ?? []).flatMap(
    (expectedOperation) => {
      const expectedKey = operationKey(expectedOperation);
      const actualOperation = actual.proposedOperations.find(
        (operation) => operationKey(operation) === expectedKey,
      );
      if (!actualOperation) {
        return [];
      }

      const missingEvidenceRefs = expectedOperation.evidenceRefs.filter(
        (expectedEvidenceRef) =>
          !actualOperation.evidenceRefs.some((actualEvidenceRef) =>
            requiredEvidenceMatches(expectedEvidenceRef, actualEvidenceRef),
          ),
      );

      return missingEvidenceRefs.length === 0
        ? []
        : [
            {
              operationType: expectedOperation.type,
              missingEvidenceRefs,
            },
          ];
    },
  );

  return {
    score:
      uninspectedTargets.length === 0 &&
      uncollectedEvidence.length === 0 &&
      missingRequiredEvidence.length === 0
        ? 1
        : 0,
    uninspectedTargets,
    uncollectedEvidence,
    missingRequiredEvidence,
  };
}
