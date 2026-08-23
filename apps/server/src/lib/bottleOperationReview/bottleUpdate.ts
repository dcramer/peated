import {
  type BottleOperationEntityChoice,
  type ProposedOperation,
} from "@peated/bottle-classifier";
import {
  bottleNameDuplicatesBrand,
  normalizeBottleAge,
  normalizeBottleAliasKey,
  normalizeEntityName,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import type { AnyDatabase } from "@peated/server/db";
import type { BottleSeries, Entity } from "@peated/server/db/schema";
import { bottleAliases, bottles, bottleSeries } from "@peated/server/db/schema";
import {
  getBottleExactIdentity,
  materializeBottleIdentity,
} from "@peated/server/lib/bottleIdentity";
import {
  BottlePatchSchema,
  type BottlePatch,
} from "@peated/server/lib/bottleSchemas";
import { formatBottleName } from "@peated/server/lib/format";
import {
  bottleStoragePatch,
  bottleUpdateExpectedSelectedBottleState,
  bottleUpdateExpectedSharedState,
} from "@peated/server/lib/updateBottle";
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  MAX_OPERATION_PREVIEW_IDS,
  PreparedBottleUpdateDataSchema,
  type BottleUpdatePreviewSchema,
  type EntityChoicePreviewSchema,
} from "../bottleOperationReviewSchemas";
import {
  bottleExact,
  bottlePreviewState,
  existingEntityChoice,
  loadBottle,
  type BottleResource,
} from "./bottleShared";
import { relationshipStateForGroups } from "./relationships";
import {
  fail,
  loadEntity,
  relationshipDigest,
  requireInspectedBottle,
  requireInspectedEntity,
  requireNoEntityIdentityCollision,
  resolveLocation,
  sameValue,
  sortedRoles,
  sortedUnique,
  type ParsedPreparationContext,
  type PreparedOperationExecution,
} from "./shared";

type BottlePatchInput = z.input<typeof BottlePatchSchema>;

type ResolvedEntityChoice = {
  preview: z.infer<typeof EntityChoicePreviewSchema>;
  canonical: NonNullable<BottlePatchInput["brand"]>;
  dependency: {
    entityId: number;
    name: string;
    shortName: string | null;
    roles: Entity["type"];
  } | null;
};

type BottleUpdateStateToken = z.infer<
  typeof PreparedBottleUpdateDataSchema
>["stateToken"];

async function resolveEntityChoice({
  choice,
  requiredRole,
  context,
}: {
  choice: BottleOperationEntityChoice;
  requiredRole: Entity["type"][number];
  context: ParsedPreparationContext;
}): Promise<ResolvedEntityChoice> {
  if (choice.kind === "existing") {
    requireInspectedEntity(choice.entityId, context);
    const current = await loadEntity(context.database, choice.entityId);
    const dependency = {
      entityId: current.entity.id,
      name: current.entity.name,
      shortName: current.entity.shortName,
      roles: sortedRoles(current.entity.type),
    };
    return {
      preview: existingEntityChoice(current.entity),
      canonical: current.entity.id,
      dependency,
    };
  }

  if (!choice.entity.roles.includes(requiredRole)) {
    fail(
      "invalid_current_state",
      `New ${requiredRole} draft does not include the ${requiredRole} role.`,
    );
  }
  const normalizedName = normalizeEntityName(choice.entity.name);
  const normalizedDraft = {
    ...choice.entity,
    name: normalizedName,
    roles: sortedRoles(choice.entity.roles),
  };
  await requireNoEntityIdentityCollision({
    entityId: null,
    names: [
      normalizedDraft.name,
      normalizedDraft.shortName,
      normalizedDraft.name.startsWith("The ")
        ? normalizedDraft.name.substring(4)
        : null,
    ],
    database: context.database,
  });
  const location = await resolveLocation({
    countryName: normalizedDraft.country,
    regionName: normalizedDraft.region,
    database: context.database,
  });
  const canonical = {
    id: null,
    name: normalizedDraft.name,
    shortName: normalizedDraft.shortName,
    type: normalizedDraft.roles,
    website: normalizedDraft.website,
    country: location.country?.id ?? null,
    region: location.region?.id ?? null,
    yearEstablished: normalizedDraft.yearEstablished,
  };
  return {
    preview: {
      kind: "create",
      entity: normalizedDraft,
      location: {
        country: location.country,
        region: location.region
          ? { id: location.region.id, name: location.region.name }
          : null,
      },
    },
    canonical,
    dependency: null,
  };
}

function resolvedEntityChoiceKey(choice: ResolvedEntityChoice): string {
  const existingId = z.number().safeParse(choice.canonical);
  if (existingId.success) {
    return `existing:${existingId.data}`;
  }
  return `create:${JSON.stringify(choice.canonical)}`;
}

function normalizeResolvedEntityChoices(
  choices: readonly ResolvedEntityChoice[],
) {
  return Array.from(
    new Map(
      choices.map((choice) => [resolvedEntityChoiceKey(choice), choice]),
    ).values(),
  ).sort((left, right) => {
    const leftId = z.number().safeParse(left.canonical);
    const rightId = z.number().safeParse(right.canonical);
    if (leftId.success && rightId.success) {
      return leftId.data - rightId.data;
    }
    if (leftId.success) return -1;
    if (rightId.success) return 1;
    return resolvedEntityChoiceKey(left).localeCompare(
      resolvedEntityChoiceKey(right),
    );
  });
}

async function boundedGroupMembers(database: AnyDatabase, groupId: number) {
  const totalRow = await database
    .select({ total: count() })
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .then(([row]) => row);
  const rows = await database
    .select({ id: bottles.id })
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(asc(bottles.id))
    .limit(MAX_OPERATION_PREVIEW_IDS);
  const total = totalRow?.total ?? 0;
  return {
    total,
    sampleIds: rows.map(({ id }) => id),
    truncated: total > rows.length,
  };
}

async function groupBottles(database: AnyDatabase, groupId: number) {
  return database
    .select()
    .from(bottles)
    .where(eq(bottles.groupId, groupId))
    .orderBy(asc(bottles.id));
}

function collectChangedBottleFields(
  before: z.infer<typeof BottleUpdatePreviewSchema>["before"],
  after: z.infer<typeof BottleUpdatePreviewSchema>["after"],
) {
  const changedFields: string[] = [];
  for (const field of [
    "name",
    "statedAge",
    "seriesId",
    "category",
    "brand",
    "distillers",
    "bottler",
  ] as const) {
    if (!sameValue(before.shared[field], after.shared[field])) {
      changedFields.push(`shared.${field}`);
    }
  }
  for (const field of [
    "edition",
    "statedAge",
    "abv",
    "singleCask",
    "caskStrength",
    "vintageYear",
    "releaseYear",
    "caskSize",
    "caskType",
    "caskFill",
  ] as const) {
    if (!sameValue(before.exact[field], after.exact[field])) {
      changedFields.push(`exact.${field}`);
    }
  }
  return changedFields;
}

function relevantBottleUpdateToken({
  resource,
  proposal,
  sharedStatedAgeIntent,
  referencedEntities,
  referencedSeries,
  relationshipDigest: relatedMemberships,
}: {
  resource: BottleResource;
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>;
  sharedStatedAgeIntent: boolean;
  referencedEntities: Array<{
    entityId: number;
    name: string;
    shortName: string | null;
    roles: Entity["type"];
  }>;
  referencedSeries: BottleSeries[];
  relationshipDigest?: string;
}): BottleUpdateStateToken {
  const patchFields = Object.keys(proposal.input.patch);
  const requestedSharedFields = new Set(
    patchFields.filter((field) =>
      [
        "name",
        "category",
        "seriesId",
        "brand",
        "distillers",
        "bottler",
      ].includes(field),
    ),
  );
  const sharedFields = new Set(requestedSharedFields);
  if (sharedStatedAgeIntent) {
    sharedFields.add("statedAge");
    requestedSharedFields.add("statedAge");
  }
  if (sharedFields.has("name")) {
    sharedFields.add("statedAge");
  }
  const shared = sharedFields.size
    ? Object.fromEntries(
        [...sharedFields].map((field) => {
          switch (field) {
            case "brand":
              return ["brandId", resource.group.brandId];
            case "distillers":
              return ["distillerIds", resource.distillerIds];
            case "bottler":
              return ["bottlerId", resource.group.bottlerId];
            case "seriesId":
              return ["seriesId", resource.group.seriesId];
            default:
              return [
                field,
                // SAFETY: sharedFields contains only these three direct group fields after the explicit relationship cases above.
                resource.group[field as "name" | "statedAge" | "category"],
              ];
          }
        }),
      )
    : undefined;
  const currentExact = bottleExact(resource);
  const exactFields = patchFields.filter(
    (field) => !requestedSharedFields.has(field),
  );
  const exact = exactFields.length
    ? Object.fromEntries(
        exactFields.map((field) => [
          field,
          // SAFETY: exactFields excludes every shared patch field, leaving only BottleExactIdentity keys.
          currentExact[field as keyof typeof currentExact],
        ]),
      )
    : undefined;

  const token: BottleUpdateStateToken = {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    referencedEntities: Array.from(
      new Map(
        referencedEntities.map((entity) => [entity.entityId, entity]),
      ).values(),
    )
      .sort((left, right) => left.entityId - right.entityId)
      .map((entity) => ({ ...entity, roles: sortedRoles(entity.roles) })),
    referencedSeries: referencedSeries
      .sort((left, right) => left.id - right.id)
      .map((series) => ({
        seriesId: series.id,
        brandId: series.brandId,
        name: series.name,
      })),
  };
  if (shared) token.shared = shared;
  if (exact) token.exact = exact;
  if (relatedMemberships) token.relationshipDigest = relatedMemberships;
  return token;
}

async function requireNoBottleIdentityCollision({
  database,
  desiredFullName,
  allowedBottleIds,
}: {
  database: AnyDatabase;
  desiredFullName: string;
  allowedBottleIds: readonly number[];
}) {
  const [bottleCollision] = await database
    .select({ bottleId: bottles.id })
    .from(bottles)
    .where(
      and(
        eq(sql`LOWER(${bottles.fullName})`, desiredFullName.toLowerCase()),
        allowedBottleIds.length
          ? sql`${bottles.id} NOT IN (${sql.join(
              allowedBottleIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : undefined,
      ),
    )
    .limit(1);
  if (bottleCollision) {
    fail(
      "identity_collision",
      `Bottle identity "${desiredFullName}" is already assigned to Bottle ${bottleCollision.bottleId}.`,
    );
  }
  const [aliasCollision] = await database
    .select({ bottleId: bottleAliases.bottleId })
    .from(bottleAliases)
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, desiredFullName.toLowerCase()),
        isNotNull(bottleAliases.bottleId),
        allowedBottleIds.length
          ? sql`${bottleAliases.bottleId} NOT IN (${sql.join(
              allowedBottleIds.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : undefined,
      ),
    )
    .limit(1);
  if (aliasCollision) {
    fail(
      "identity_collision",
      `Bottle identity "${desiredFullName}" conflicts with an existing alias.`,
    );
  }
}

export async function prepareBottleUpdate(
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>,
  context: ParsedPreparationContext,
): Promise<Extract<PreparedOperationExecution, { type: "update_bottle" }>> {
  requireInspectedBottle(proposal.input.bottleId, context);
  const resource = await loadBottle(context.database, proposal.input.bottleId);
  const before = bottlePreviewState(resource);
  const referencedEntities: NonNullable<
    ReturnType<typeof relevantBottleUpdateToken>["referencedEntities"]
  > = [];
  const entityCreations: Array<
    Extract<z.infer<typeof EntityChoicePreviewSchema>, { kind: "create" }>
  > = [];

  let brand: ResolvedEntityChoice = {
    preview: before.shared.brand,
    canonical: resource.group.brandId,
    dependency: {
      entityId: resource.brand.id,
      name: resource.brand.name,
      shortName: resource.brand.shortName,
      roles: sortedRoles(resource.brand.type),
    },
  };
  if (proposal.input.patch.brand) {
    brand = await resolveEntityChoice({
      choice: proposal.input.patch.brand,
      requiredRole: "brand",
      context,
    });
  }
  if (brand.dependency && proposal.input.patch.brand !== undefined) {
    referencedEntities.push(brand.dependency);
  }
  if (brand.preview.kind === "create") entityCreations.push(brand.preview);

  let bottler:
    | ResolvedEntityChoice
    | {
        preview: null;
        canonical: null;
        dependency: null;
      };
  if (proposal.input.patch.bottler === null) {
    bottler = { preview: null, canonical: null, dependency: null };
  } else if (proposal.input.patch.bottler) {
    bottler = await resolveEntityChoice({
      choice: proposal.input.patch.bottler,
      requiredRole: "bottler",
      context,
    });
  } else if (resource.bottler) {
    bottler = {
      preview: existingEntityChoice(resource.bottler),
      canonical: resource.bottler.id,
      dependency: {
        entityId: resource.bottler.id,
        name: resource.bottler.name,
        shortName: resource.bottler.shortName,
        roles: sortedRoles(resource.bottler.type),
      },
    };
  } else {
    bottler = { preview: null, canonical: null, dependency: null };
  }
  if (bottler.dependency && proposal.input.patch.bottler !== undefined) {
    referencedEntities.push(bottler.dependency);
  }
  if (bottler.preview?.kind === "create") {
    entityCreations.push(bottler.preview);
  }

  const proposedDistillers: ResolvedEntityChoice[] = [];
  if (proposal.input.patch.distillers) {
    for (const choice of proposal.input.patch.distillers) {
      proposedDistillers.push(
        await resolveEntityChoice({
          choice,
          requiredRole: "distiller",
          context,
        }),
      );
    }
  } else {
    for (const distiller of resource.distillers) {
      proposedDistillers.push({
        preview: existingEntityChoice(distiller),
        canonical: distiller.id,
        dependency: {
          entityId: distiller.id,
          name: distiller.name,
          shortName: distiller.shortName,
          roles: sortedRoles(distiller.type),
        },
      });
    }
  }
  const distillers = normalizeResolvedEntityChoices(proposedDistillers);
  for (const distiller of distillers) {
    if (distiller.dependency && proposal.input.patch.distillers !== undefined) {
      referencedEntities.push(distiller.dependency);
    }
    if (distiller.preview.kind === "create") {
      entityCreations.push(distiller.preview);
    }
  }

  const referencedSeries: BottleSeries[] = [];
  let seriesId = resource.group.seriesId;
  const seriesTouched = proposal.input.patch.seriesId !== undefined;
  const brandTouched = proposal.input.patch.brand !== undefined;
  if (seriesTouched || brandTouched) {
    if (seriesTouched) {
      seriesId = proposal.input.patch.seriesId ?? null;
    }
    if (seriesId !== null) {
      if (seriesTouched && !context.inspectedSeriesIds.has(seriesId)) {
        fail(
          "target_not_inspected",
          `BottleSeries ${seriesId} was not inspected by this Bottle check.`,
        );
      }
      const series =
        !seriesTouched && resource.series?.id === seriesId
          ? resource.series
          : await context.database
              .select()
              .from(bottleSeries)
              .where(eq(bottleSeries.id, seriesId))
              .limit(1)
              .then(([row]) => row);
      if (!series) {
        fail("resource_not_found", `BottleSeries ${seriesId} does not exist.`);
      }
      referencedSeries.push(series);
      const parsedBrandId = z.number().safeParse(brand.canonical);
      const brandId = parsedBrandId.success ? parsedBrandId.data : null;
      if (brandId !== null && series.brandId !== brandId) {
        fail(
          "invalid_current_state",
          `BottleSeries ${series.id} does not belong to Brand ${brandId}.`,
        );
      }
      if (brandId === null) {
        fail(
          "invalid_current_state",
          "A new Brand cannot be paired with an existing BottleSeries.",
        );
      }
    }
  }

  const {
    seriesId: _seriesId,
    brand: _brand,
    bottler: _bottler,
    distillers: _distillers,
    ...plainPatch
  } = proposal.input.patch;
  const canonicalPatch: BottlePatchInput = { ...plainPatch };
  if (proposal.input.patch.seriesId !== undefined) {
    canonicalPatch.series = seriesId;
  }
  if (proposal.input.patch.brand !== undefined) {
    canonicalPatch.brand = brand.canonical;
  }
  if (proposal.input.patch.bottler !== undefined) {
    canonicalPatch.bottler = bottler.canonical;
  }
  if (proposal.input.patch.distillers !== undefined) {
    canonicalPatch.distillers = distillers.map(({ canonical }) => canonical);
  }
  const canonicalInput = BottlePatchSchema.parse(canonicalPatch);
  const storage = bottleStoragePatch(canonicalInput, {
    bottleStatedAge: resource.bottle.statedAge,
    groupStatedAge: resource.group.statedAge,
  });
  const sharedStatedAgeIntent =
    storage.shared !== undefined && "statedAge" in storage.shared;

  let sharedName =
    storage.shared?.name === undefined
      ? resource.group.name
      : storage.shared.name;
  let sharedStatedAge =
    storage.shared?.statedAge === undefined
      ? resource.group.statedAge
      : storage.shared.statedAge;
  if (storage.shared?.name !== undefined) {
    const normalized = normalizeBottleAge({
      name: normalizeBottleAliasKey(storage.shared.name),
      statedAge: sharedStatedAge,
    });
    sharedName = normalized.name;
    if (storage.shared.statedAge === undefined) {
      sharedStatedAge = normalized.statedAge;
    }
  }
  const brandName =
    brand.preview.kind === "existing"
      ? brand.preview.name
      : brand.preview.entity.name;
  const brandShortName =
    brand.preview.kind === "existing"
      ? brand.preview.shortName
      : brand.preview.entity.shortName;
  sharedName = stripDuplicateBrandPrefixFromBottleName(sharedName, brandName);
  if (!sharedName || bottleNameDuplicatesBrand(sharedName, brandName)) {
    fail(
      "invalid_current_state",
      "Bottle name must identify an expression distinct from the Brand.",
    );
  }
  const stableFullName = formatBottleName({
    name: `${brandShortName || brandName} ${sharedName}`,
  });
  const exactAfter = getBottleExactIdentity({
    bottle: resource.bottle,
    sourceGroupStatedAge: resource.group.statedAge,
    exactPatch: storage.exact,
  });
  const materialized = materializeBottleIdentity({
    stable: {
      name: sharedName,
      fullName: stableFullName,
      statedAge: sharedStatedAge,
    },
    exact: exactAfter,
  });
  const after = {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    fullName: materialized.fullName,
    shared: {
      name: sharedName,
      statedAge: sharedStatedAge,
      seriesId,
      category:
        storage.shared?.category === undefined
          ? resource.group.category
          : storage.shared.category,
      brand: brand.preview,
      distillers: distillers.map(({ preview }) => preview),
      bottler: bottler.preview,
    },
    exact: exactAfter,
  };
  const changedFields = collectChangedBottleFields(before, after);
  if (changedFields.length === 0 && entityCreations.length === 0) {
    fail(
      "no_changes",
      `Bottle ${resource.bottle.id} already has the proposed state.`,
    );
  }

  const sharedChanged = changedFields.some((field) =>
    field.startsWith("shared."),
  );
  if (sharedChanged) {
    const members = await groupBottles(context.database, resource.group.id);
    const memberIds = members.map(({ id: bottleId }) => bottleId);
    const desiredNames = new Set<string>();
    for (const member of members) {
      const desired =
        member.id === resource.bottle.id
          ? after
          : materializeBottleIdentity({
              stable: {
                name: sharedName,
                fullName: stableFullName,
                statedAge: sharedStatedAge,
              },
              exact: getBottleExactIdentity({
                bottle: member,
                sourceGroupStatedAge: resource.group.statedAge,
              }),
            });
      const identityKey = desired.fullName.toLowerCase();
      if (desiredNames.has(identityKey)) {
        fail(
          "identity_collision",
          `BottleGroup ${resource.group.id} would contain duplicate Bottle identity "${desired.fullName}".`,
        );
      }
      desiredNames.add(identityKey);
      await requireNoBottleIdentityCollision({
        database: context.database,
        desiredFullName: desired.fullName,
        allowedBottleIds: memberIds,
      });
    }
  } else {
    await requireNoBottleIdentityCollision({
      database: context.database,
      desiredFullName: after.fullName,
      allowedBottleIds: [resource.bottle.id],
    });
  }

  const affectedBottles = sharedChanged
    ? await boundedGroupMembers(context.database, resource.group.id)
    : {
        total: 1,
        sampleIds: [resource.bottle.id],
        truncated: false,
      };
  const warnings = [
    ...(sharedChanged && affectedBottles.total > 1
      ? [
          {
            code: "shared_group_fan_out" as const,
            message: `Shared fields will rematerialize ${affectedBottles.total} Bottles in BottleGroup ${resource.group.id}.`,
          },
        ]
      : []),
    ...entityCreations.map(() => ({
      code: "creates_entity" as const,
      message: "This Bottle update will create a related Entity.",
    })),
  ];
  const stateToken = relevantBottleUpdateToken({
    resource,
    proposal,
    sharedStatedAgeIntent,
    referencedEntities,
    referencedSeries,
    relationshipDigest: storage.shared
      ? relationshipDigest(
          await relationshipStateForGroups(context.database, [
            resource.group.id,
          ]),
        )
      : undefined,
  });

  const canonicalExecution: Extract<
    PreparedOperationExecution,
    { type: "update_bottle" }
  >["canonicalInput"] = {
    bottleId: proposal.input.bottleId,
    input: canonicalInput,
    expectedSelectedBottleState: bottleUpdateExpectedSelectedBottleState(
      resource.bottle,
    ),
  };
  if (storage.shared) {
    canonicalExecution.expectedSharedState = bottleUpdateExpectedSharedState({
      group: resource.group,
      distillerIds: resource.distillerIds,
      referencedEntities: stateToken.referencedEntities.map(
        ({ entityId: id, name, shortName, roles: type }) => ({
          id,
          name,
          shortName,
          type,
        }),
      ),
      series: resource.series,
      referencedSeries,
    });
  }

  return {
    type: proposal.type,
    review: PreparedBottleUpdateDataSchema.parse({
      type: proposal.type,
      proposal,
      preview: {
        before,
        after,
        changedFields,
        affectedBottles,
        entityCreations,
        warnings,
      },
      stateToken,
    }),
    canonicalInput: canonicalExecution,
  };
}
