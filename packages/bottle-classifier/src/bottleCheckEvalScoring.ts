import type {
  EvidenceRef,
  Finding,
  ProposedEntityChoice,
  ProposedOperation,
} from "./bottleCheckContract";
import type { BottleClassificationArtifacts } from "./contract";

export type BottleCheckSetScore = {
  score: number;
  precision: number;
  recall: number;
  matchedCount: number;
  expectedCount: number;
  actualCount: number;
  missingCount: number;
  harmfulExtraCount: number;
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
  harmfulExtraWeight: number,
): BottleCheckSetScore {
  const remainingExpected = new Map<string, number>();
  for (const key of expectedKeys) {
    remainingExpected.set(key, (remainingExpected.get(key) ?? 0) + 1);
  }

  let matchedCount = 0;
  let harmfulExtraCount = 0;
  for (const key of actualKeys) {
    const remaining = remainingExpected.get(key) ?? 0;
    if (remaining > 0) {
      matchedCount += 1;
      remainingExpected.set(key, remaining - 1);
    } else {
      harmfulExtraCount += 1;
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
          (matchedCount - harmfulExtraWeight * harmfulExtraCount) /
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
    harmfulExtraCount,
  };
}

function operationKey(operation: ProposedOperation): string {
  return stableKey({
    type: operation.type,
    input: operation.input,
  });
}

function findingKey(finding: Finding): string {
  return stableKey({
    scope: finding.scope,
    evidenceRefs: [...finding.evidenceRefs]
      .map(stableKey)
      .sort()
      .map((key) => JSON.parse(key)),
  });
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

function existingEntityId(choice: ProposedEntityChoice | null | undefined) {
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
      const shared = operation.input.patch.shared;
      const entityTarget = (
        choice: ProposedEntityChoice | null | undefined,
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
        ...(shared?.seriesId
          ? [
              {
                kind: "series" as const,
                id: shared.seriesId,
                path: ["patch", "shared", "seriesId"],
              },
            ]
          : []),
        ...entityTarget(shared?.brand, [
          "patch",
          "shared",
          "brand",
          "entityId",
        ]),
        ...(shared?.distillers ?? []).flatMap((choice, index) => {
          return entityTarget(choice, [
            "patch",
            "shared",
            "distillers",
            index,
            "entityId",
          ]);
        }),
        ...entityTarget(shared?.bottler, [
          "patch",
          "shared",
          "bottler",
          "entityId",
        ]),
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

export function scoreBottleCheckGrounding(
  actual: {
    proposedOperations: ProposedOperation[];
    findings: Finding[];
    artifacts: BottleClassificationArtifacts;
  },
  sourceFields: readonly string[] = [],
): BottleCheckGroundingScore {
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
  const collectedWebUrls = new Set(
    actual.artifacts.searchEvidence.flatMap(({ results }) =>
      results.map(({ url }) => url),
    ),
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
        return collectedWebUrls.has(evidenceRef.url);
    }
  };

  const uninspectedTargets = actual.proposedOperations.flatMap(
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
  );
  const uncollectedEvidence = [
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
  ];

  return {
    score:
      uninspectedTargets.length === 0 && uncollectedEvidence.length === 0
        ? 1
        : 0,
    uninspectedTargets,
    uncollectedEvidence,
  };
}
