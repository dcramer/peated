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
  getConcreteBottleExactIdentity,
  materializeConcreteBottleIdentity,
} from "@peated/server/lib/concreteBottleIdentity";
import {
  ConcreteBottleUpdateInputSchema,
  type ConcreteBottleUpdateInput,
} from "@peated/server/lib/concreteBottleSchemas";
import { formatBottleName } from "@peated/server/lib/format";
import {
  concreteBottleUpdateExpectedSelectedBottleState,
  concreteBottleUpdateExpectedSharedState,
} from "@peated/server/lib/updateConcreteBottle";
import { and, asc, count, eq, isNotNull, sql } from "drizzle-orm";
import type { z } from "zod";
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

type ResolvedEntityChoice = {
  preview: z.infer<typeof EntityChoicePreviewSchema>;
  canonical: number | Record<string, unknown>;
  dependency: {
    entityId: number;
    name: string;
    shortName: string | null;
    roles: Entity["type"];
  } | null;
};

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
    if (!current.entity.type.includes(requiredRole)) {
      fail(
        "invalid_current_state",
        `Entity ${choice.entityId} does not have the ${requiredRole} role.`,
      );
    }
    const dependency = {
      entityId: current.entity.id,
      name: current.entity.name,
      shortName: current.entity.shortName,
      roles: [...current.entity.type].sort() as Entity["type"],
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
  if (typeof choice.canonical === "number") {
    return `existing:${choice.canonical}`;
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
    if (
      typeof left.canonical === "number" &&
      typeof right.canonical === "number"
    ) {
      return left.canonical - right.canonical;
    }
    if (typeof left.canonical === "number") return -1;
    if (typeof right.canonical === "number") return 1;
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
  referencedEntities,
  referencedSeries,
  relationshipDigest: relatedMemberships,
}: {
  resource: BottleResource;
  proposal: Extract<ProposedOperation, { type: "update_bottle" }>;
  referencedEntities: Array<{
    entityId: number;
    name: string;
    shortName: string | null;
    roles: Entity["type"];
  }>;
  referencedSeries: BottleSeries[];
  relationshipDigest?: string;
}) {
  const sharedFields = proposal.input.patch.shared
    ? new Set(Object.keys(proposal.input.patch.shared))
    : null;
  if (sharedFields?.has("name")) {
    sharedFields.add("statedAge");
  }
  const shared = sharedFields
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
                resource.group[field as "name" | "statedAge" | "category"],
              ];
          }
        }),
      )
    : undefined;
  const currentExact = bottleExact(resource);
  const exact = proposal.input.patch.exact
    ? Object.fromEntries(
        Object.keys(proposal.input.patch.exact).map((field) => [
          field,
          currentExact[field as keyof typeof currentExact],
        ]),
      )
    : undefined;

  return {
    bottleId: resource.bottle.id,
    groupId: resource.group.id,
    ...(shared ? { shared } : {}),
    ...(exact ? { exact } : {}),
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
    ...(relatedMemberships ? { relationshipDigest: relatedMemberships } : {}),
  };
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
    canonical: resource.group.brandId as number | Record<string, unknown>,
    dependency: {
      entityId: resource.brand.id,
      name: resource.brand.name,
      shortName: resource.brand.shortName,
      roles: sortedRoles(resource.brand.type),
    },
  };
  if (proposal.input.patch.shared?.brand) {
    brand = await resolveEntityChoice({
      choice: proposal.input.patch.shared.brand,
      requiredRole: "brand",
      context,
    });
  }
  if (brand.dependency && proposal.input.patch.shared !== undefined) {
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
  if (proposal.input.patch.shared?.bottler === null) {
    bottler = { preview: null, canonical: null, dependency: null };
  } else if (proposal.input.patch.shared?.bottler) {
    bottler = await resolveEntityChoice({
      choice: proposal.input.patch.shared.bottler,
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
  if (
    bottler.dependency &&
    proposal.input.patch.shared?.bottler !== undefined
  ) {
    referencedEntities.push(bottler.dependency);
  }
  if (bottler.preview?.kind === "create") {
    entityCreations.push(bottler.preview);
  }

  const proposedDistillers: ResolvedEntityChoice[] = [];
  if (proposal.input.patch.shared?.distillers) {
    for (const choice of proposal.input.patch.shared.distillers) {
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
    if (
      distiller.dependency &&
      proposal.input.patch.shared?.distillers !== undefined
    ) {
      referencedEntities.push(distiller.dependency);
    }
    if (distiller.preview.kind === "create") {
      entityCreations.push(distiller.preview);
    }
  }

  const referencedSeries: BottleSeries[] = [];
  let seriesId = resource.group.seriesId;
  const seriesTouched = proposal.input.patch.shared?.seriesId !== undefined;
  const brandTouched = proposal.input.patch.shared?.brand !== undefined;
  if (seriesTouched || brandTouched) {
    if (seriesTouched) {
      seriesId = proposal.input.patch.shared?.seriesId ?? null;
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
      const brandId =
        typeof brand.canonical === "number" ? brand.canonical : null;
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

  const canonicalSharedPatch = proposal.input.patch.shared
    ? { ...proposal.input.patch.shared }
    : undefined;
  if (canonicalSharedPatch) {
    delete canonicalSharedPatch.seriesId;
    delete canonicalSharedPatch.brand;
    delete canonicalSharedPatch.bottler;
    delete canonicalSharedPatch.distillers;
  }
  const canonicalInput: ConcreteBottleUpdateInput =
    ConcreteBottleUpdateInputSchema.parse({
      ...(proposal.input.patch.shared
        ? {
            shared: {
              ...canonicalSharedPatch,
              ...(proposal.input.patch.shared.seriesId !== undefined
                ? { series: seriesId }
                : {}),
              ...(proposal.input.patch.shared.brand !== undefined
                ? { brand: brand.canonical }
                : {}),
              ...(proposal.input.patch.shared.bottler !== undefined
                ? { bottler: bottler.canonical }
                : {}),
              ...(proposal.input.patch.shared.distillers !== undefined
                ? {
                    distillers: distillers.map(({ canonical }) => canonical),
                  }
                : {}),
            },
          }
        : {}),
      ...(proposal.input.patch.exact
        ? { exact: proposal.input.patch.exact }
        : {}),
    });

  let sharedName =
    canonicalInput.shared?.name === undefined
      ? resource.group.name
      : canonicalInput.shared.name;
  let sharedStatedAge =
    canonicalInput.shared?.statedAge === undefined
      ? resource.group.statedAge
      : canonicalInput.shared.statedAge;
  if (canonicalInput.shared?.name !== undefined) {
    const normalized = normalizeBottleAge({
      name: normalizeBottleAliasKey(canonicalInput.shared.name),
      statedAge: sharedStatedAge,
    });
    sharedName = normalized.name;
    if (canonicalInput.shared.statedAge === undefined) {
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
  const exactAfter = getConcreteBottleExactIdentity({
    bottle: resource.bottle,
    sourceGroupStatedAge: resource.group.statedAge,
    exactPatch: canonicalInput.exact,
  });
  const materialized = materializeConcreteBottleIdentity({
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
        canonicalInput.shared?.category === undefined
          ? resource.group.category
          : canonicalInput.shared.category,
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
          : materializeConcreteBottleIdentity({
              stable: {
                name: sharedName,
                fullName: stableFullName,
                statedAge: sharedStatedAge,
              },
              exact: getConcreteBottleExactIdentity({
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
      stateToken: relevantBottleUpdateToken({
        resource,
        proposal,
        referencedEntities,
        referencedSeries,
        relationshipDigest: proposal.input.patch.shared
          ? relationshipDigest(
              await relationshipStateForGroups(context.database, [
                resource.group.id,
              ]),
            )
          : undefined,
      }),
    }),
    canonicalInput: {
      bottleId: proposal.input.bottleId,
      input: canonicalInput,
      expectedSelectedBottleState:
        concreteBottleUpdateExpectedSelectedBottleState(resource.bottle),
      ...(proposal.input.patch.shared
        ? {
            expectedSharedState: concreteBottleUpdateExpectedSharedState({
              group: resource.group,
              distillerIds: resource.distillerIds,
              referencedEntities: referencedEntities.map(
                ({ entityId: id, name, shortName, roles: type }) => ({
                  id,
                  name,
                  shortName,
                  type,
                }),
              ),
              series: resource.series,
              referencedSeries,
            }),
          }
        : {}),
    },
  };
}
