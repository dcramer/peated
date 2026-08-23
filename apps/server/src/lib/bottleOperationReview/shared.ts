import {
  BottleClassificationArtifactsSchema,
  type EvidenceRef,
  type ProposedOperation,
} from "@peated/bottle-classifier";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import { countries, entities, regions } from "@peated/server/db/schema";
import type { BottlePatch } from "@peated/server/lib/bottleSchemas";
import { findEntityByExactNameOrAlias } from "@peated/server/lib/db";
import type {
  BottleUpdateExpectedSelectedBottleState,
  BottleUpdateExpectedSharedState,
} from "@peated/server/lib/updateBottle";
import type {
  EntityUpdateExpectedState,
  EntityUpdateInput,
} from "@peated/server/lib/updateEntity";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type {
  PreparationError,
  PreparationErrorCode,
  PreparedBottleMergeDataSchema,
  PreparedBottleUpdateDataSchema,
  PreparedEntityMergeDataSchema,
  PreparedEntityUpdateDataSchema,
} from "../bottleOperationReviewSchemas";

type ParsedArtifacts = z.infer<typeof BottleClassificationArtifactsSchema>;
export type BottleOperationRow = {
  id: number;
  proposal: unknown;
};

export type BottleOperationPreparationContext = {
  artifacts: unknown;
  sourceFields?: readonly string[];
  protectedBottleIds?: readonly number[];
  database?: AnyDatabase;
};

export type BottleOperationExecutionPreparationContext = Omit<
  BottleOperationPreparationContext,
  "database"
> & {
  database: AnyTransaction;
};

export type PreparedOperationExecution =
  | {
      type: "update_bottle";
      review: z.infer<typeof PreparedBottleUpdateDataSchema>;
      canonicalInput: {
        bottleId: number;
        input: BottlePatch;
        expectedSelectedBottleState: BottleUpdateExpectedSelectedBottleState;
        expectedSharedState?: BottleUpdateExpectedSharedState;
      };
    }
  | {
      type: "merge_bottles";
      review: z.infer<typeof PreparedBottleMergeDataSchema>;
      canonicalInput: {
        sourceBottleId: number;
        destinationBottleId: number;
      };
    }
  | {
      type: "update_entity";
      review: z.infer<typeof PreparedEntityUpdateDataSchema>;
      canonicalInput: {
        entityId: number;
        input: EntityUpdateInput;
        expectedState: EntityUpdateExpectedState;
      };
    }
  | {
      type: "merge_entities";
      review: z.infer<typeof PreparedEntityMergeDataSchema>;
      canonicalInput: {
        sourceEntityId: number;
        destinationEntityId: number;
      };
    };

export type ParsedPreparationContext = {
  artifacts: ParsedArtifacts;
  sourceFields: ReadonlySet<string>;
  protectedBottleIds: ReadonlySet<number>;
  database: AnyDatabase;
  collectedBottleIds: ReadonlySet<number>;
  collectedEntityIds: ReadonlySet<number>;
  inspectedBottleIds: ReadonlySet<number>;
  inspectedEntityIds: ReadonlySet<number>;
  inspectedSeriesIds: ReadonlySet<number>;
  webResultUrls: ReadonlySet<string>;
};

export class OperationPreparationFailure extends Error {
  constructor(
    readonly code: PreparationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OperationPreparationFailure";
  }

  toJSON(): PreparationError {
    return { code: this.code, message: this.message };
  }
}

export function isOperationPreparationFailure(error: Error): boolean {
  return error instanceof OperationPreparationFailure;
}

export function fail(code: PreparationErrorCode, message: string): never {
  throw new OperationPreparationFailure(code, message);
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled Bottle operation: ${JSON.stringify(value)}`);
}

export function sortedUnique(values: readonly number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => left - right);
}

export function sortedRoles(
  roles: readonly Entity["type"][number][],
): Entity["type"] {
  const sorted = Array.from(new Set(roles)).sort();
  const first = sorted[0];
  if (!first) {
    throw new Error("An Entity must have at least one role.");
  }
  return [first, ...sorted.slice(1)];
}

type JsonStringifyInput = Parameters<typeof JSON.stringify>[0];

export function sameValue(
  left: JsonStringifyInput,
  right: JsonStringifyInput,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function relationshipDigest(value: JsonStringifyInput): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseContext(
  context: BottleOperationPreparationContext,
): ParsedPreparationContext {
  const artifacts = BottleClassificationArtifactsSchema.parse(
    context.artifacts,
  );
  const collectedBottleIds = new Set<number>();
  const collectedEntityIds = new Set<number>();
  for (const candidate of artifacts.candidates) {
    collectedBottleIds.add(candidate.bottleId);
    for (const sibling of candidate.familyContext?.siblingBottles ?? []) {
      collectedBottleIds.add(sibling.bottleId);
    }
  }
  const inspectedSeriesIds = new Set<number>();
  for (const bottleContext of artifacts.bottleContexts) {
    collectedBottleIds.add(bottleContext.bottleId);
    for (const sibling of bottleContext.siblings) {
      collectedBottleIds.add(sibling.bottleId);
    }
    collectedEntityIds.add(bottleContext.shared.brand.entityId);
    for (const distiller of bottleContext.shared.distillers) {
      collectedEntityIds.add(distiller.entityId);
    }
    if (bottleContext.shared.bottler) {
      collectedEntityIds.add(bottleContext.shared.bottler.entityId);
    }
    if (bottleContext.shared.series) {
      inspectedSeriesIds.add(bottleContext.shared.series.seriesId);
    }
  }
  for (const entityContext of artifacts.entityContexts) {
    collectedEntityIds.add(entityContext.entityId);
    for (const bottle of entityContext.relatedBottles) {
      collectedBottleIds.add(bottle.bottleId);
    }
  }
  for (const entity of artifacts.resolvedEntities) {
    collectedEntityIds.add(entity.entityId);
  }

  return {
    artifacts,
    sourceFields: new Set(context.sourceFields ?? []),
    protectedBottleIds: new Set(context.protectedBottleIds ?? []),
    database: context.database ?? db,
    collectedBottleIds,
    collectedEntityIds,
    inspectedBottleIds: new Set(
      artifacts.bottleContexts.map(({ bottleId }) => bottleId),
    ),
    inspectedEntityIds: new Set(
      artifacts.entityContexts.map(({ entityId }) => entityId),
    ),
    inspectedSeriesIds,
    webResultUrls: new Set(
      artifacts.searchEvidence.flatMap(({ results }) =>
        results.map(({ url }) => url),
      ),
    ),
  };
}

function evidenceExists(
  evidence: EvidenceRef,
  context: ParsedPreparationContext,
): boolean {
  switch (evidence.kind) {
    case "source":
      return context.sourceFields.has(evidence.field);
    case "bottle":
      return context.collectedBottleIds.has(evidence.bottleId);
    case "entity":
      return context.collectedEntityIds.has(evidence.entityId);
    case "web_result":
      return context.webResultUrls.has(evidence.url);
    default:
      return assertNever(evidence);
  }
}

export function assertCollectedEvidenceRefs({
  artifacts,
  evidenceRefs,
  sourceFields = [],
}: {
  artifacts: unknown;
  evidenceRefs: readonly EvidenceRef[];
  sourceFields?: readonly string[];
}) {
  const context = parseContext({
    artifacts,
    sourceFields,
  });
  const missingEvidence = evidenceRefs.find(
    (reference) => !evidenceExists(reference, context),
  );
  if (missingEvidence) {
    fail(
      "evidence_not_found",
      `Evidence reference was not collected by this Bottle check: ${JSON.stringify(missingEvidence)}.`,
    );
  }
}

export function validateEvidence(
  proposal: ProposedOperation,
  context: ParsedPreparationContext,
) {
  const missingEvidence = proposal.evidenceRefs.find(
    (reference) => !evidenceExists(reference, context),
  );
  if (missingEvidence) {
    fail(
      "evidence_not_found",
      `Evidence reference was not collected by this Bottle check: ${JSON.stringify(missingEvidence)}.`,
    );
  }
}

export function requireInspectedBottle(
  bottleId: number,
  context: ParsedPreparationContext,
) {
  if (!context.inspectedBottleIds.has(bottleId)) {
    fail(
      "target_not_inspected",
      `Bottle ${bottleId} was not inspected by this Bottle check.`,
    );
  }
}

export function requireInspectedEntity(
  entityId: number,
  context: ParsedPreparationContext,
) {
  if (!context.inspectedEntityIds.has(entityId)) {
    fail(
      "target_not_inspected",
      `Entity ${entityId} was not inspected by this Bottle check.`,
    );
  }
}

export type EntityWithLocation = {
  entity: Entity;
  country: { id: number; name: string } | null;
  region: { id: number; name: string; countryId: number } | null;
};

export async function loadEntity(
  database: AnyDatabase,
  entityId: number,
): Promise<EntityWithLocation> {
  const [row] = await database
    .select({
      entity: entities,
      countryId: countries.id,
      countryName: countries.name,
      regionId: regions.id,
      regionName: regions.name,
      regionCountryId: regions.countryId,
    })
    .from(entities)
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(eq(entities.id, entityId))
    .limit(1);
  if (!row) {
    fail("resource_not_found", `Entity ${entityId} does not exist.`);
  }

  return {
    entity: row.entity,
    country:
      row.countryId && row.countryName
        ? { id: row.countryId, name: row.countryName }
        : null,
    region:
      row.regionId && row.regionName && row.regionCountryId
        ? {
            id: row.regionId,
            name: row.regionName,
            countryId: row.regionCountryId,
          }
        : null,
  };
}

export function entityPreviewState({
  entity,
  country,
  region,
}: EntityWithLocation) {
  return {
    entityId: entity.id,
    name: entity.name,
    shortName: entity.shortName,
    roles: [...entity.type].sort(),
    website: entity.website,
    location: {
      country,
      region: region ? { id: region.id, name: region.name } : null,
    },
    yearEstablished: entity.yearEstablished,
  };
}

export async function resolveLocation({
  countryName,
  regionName,
  database,
}: {
  countryName: string | null | undefined;
  regionName: string | null | undefined;
  database: AnyDatabase;
}) {
  let country: { id: number; name: string } | null = null;
  if (countryName) {
    [country] = await database
      .select({ id: countries.id, name: countries.name })
      .from(countries)
      .where(eq(sql`LOWER(${countries.name})`, countryName.toLowerCase()))
      .limit(1);
    if (!country) {
      fail(
        "resource_not_found",
        `Country "${countryName}" could not be resolved exactly.`,
      );
    }
  }

  let region:
    | { id: number; name: string; countryId: number }
    | null
    | undefined = null;
  if (regionName) {
    if (!country) {
      fail(
        "invalid_current_state",
        `Region "${regionName}" requires an explicitly resolved country.`,
      );
    }
    [region] = await database
      .select({
        id: regions.id,
        name: regions.name,
        countryId: regions.countryId,
      })
      .from(regions)
      .where(
        and(
          eq(regions.countryId, country.id),
          eq(sql`LOWER(${regions.name})`, regionName.toLowerCase()),
        ),
      )
      .limit(1);
    if (!region) {
      fail(
        "resource_not_found",
        `Region "${regionName}" could not be resolved exactly in ${country.name}.`,
      );
    }
  }

  return { country, region: region ?? null };
}

export async function requireNoEntityIdentityCollision({
  entityId,
  names,
  database,
}: {
  entityId: number | null;
  names: readonly (string | null | undefined)[];
  database: AnyDatabase;
}) {
  for (const rawName of names) {
    if (!rawName?.trim()) continue;
    const found = await findEntityByExactNameOrAlias(database, rawName);
    if (found && found.id !== entityId) {
      fail(
        "identity_collision",
        `Entity identity "${rawName}" is already assigned to Entity ${found.id}.`,
      );
    }
  }
}
