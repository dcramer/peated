import {
  BottleContextExactSchema,
  BottleContextSharedFields,
  EntityContextFields,
  MergeBottlesOperationSchema,
  MergeEntitiesOperationSchema,
  ProposedEntityDraftSchema,
  ProposedOperationSchema,
  ProposedOperationTypeSchema,
  UpdateBottleOperationSchema,
  UpdateEntityOperationSchema,
} from "@peated/bottle-classifier";
import { z } from "zod";

export const MAX_OPERATION_PREVIEW_IDS = 20;

const PositiveIdSchema = z.number().int().positive();
const NonEmptyTextSchema = z.string().trim().min(1);
// Bottle review state includes the server-owned no-age-statement fact. Keep it
// optional so reviews stored before this field was added remain readable.
const BottleReviewExactStateSchema = BottleContextExactSchema.extend({
  noAgeStatement: z.boolean().nullable().optional(),
}).strict();
// Previews canonicalize legacy blanks for reviewers; state tokens retain raw
// database values for exact staleness comparisons.
const EntityPreviewShortNameSchema = z
  .string()
  .nullable()
  .transform((value) => value?.trim() || null);
const RawEntityShortNameSchema = z.string().nullable();

export const PreparationErrorCodeSchema = z.enum([
  "target_not_inspected",
  "evidence_not_found",
  "resource_not_found",
  "invalid_current_state",
  "no_changes",
  "direct_conflict",
  "identity_collision",
]);

export const PreparationErrorSchema = z
  .object({
    code: PreparationErrorCodeSchema,
    message: NonEmptyTextSchema,
  })
  .strict();

export const OperationWarningSchema = z
  .object({
    code: z.enum([
      "creates_entity",
      "shared_group_fan_out",
      "consumer_memberships_collapse",
      "bottle_identity_collision_resolved",
      "series_collision_resolved",
    ]),
    message: NonEmptyTextSchema,
  })
  .strict();

export const BoundedImpactSchema = z
  .object({
    total: z.number().int().nonnegative(),
    sampleIds: z.array(PositiveIdSchema).max(MAX_OPERATION_PREVIEW_IDS),
    truncated: z.boolean(),
  })
  .strict();

export const EntityLocationSchema = z
  .object({
    country: z
      .object({
        id: PositiveIdSchema,
        name: NonEmptyTextSchema,
      })
      .strict()
      .nullable(),
    region: z
      .object({
        id: PositiveIdSchema,
        name: NonEmptyTextSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

export const ExistingEntityPreviewSchema = z
  .object({
    kind: z.literal("existing"),
    entityId: PositiveIdSchema,
    name: NonEmptyTextSchema,
    shortName: EntityPreviewShortNameSchema,
    entityKind: EntityContextFields.kind,
  })
  .strict();

export const CreatedEntityPreviewSchema = z
  .object({
    kind: z.literal("create"),
    entity: ProposedEntityDraftSchema,
    location: EntityLocationSchema,
  })
  .strict();

export const EntityChoicePreviewSchema = z.discriminatedUnion("kind", [
  ExistingEntityPreviewSchema,
  CreatedEntityPreviewSchema,
]);

export const BottleSharedPreviewStateSchema = z
  .object({
    name: BottleContextSharedFields.name,
    statedAge: BottleContextSharedFields.statedAge,
    seriesId: PositiveIdSchema.nullable(),
    category: BottleContextSharedFields.category,
    brand: EntityChoicePreviewSchema,
    distillers: z.array(EntityChoicePreviewSchema),
    bottler: EntityChoicePreviewSchema.nullable(),
  })
  .strict();

export const BottlePreviewStateSchema = z
  .object({
    bottleId: PositiveIdSchema,
    groupId: PositiveIdSchema,
    fullName: NonEmptyTextSchema,
    shared: BottleSharedPreviewStateSchema,
    exact: BottleReviewExactStateSchema,
  })
  .strict();

export const EntityPreviewStateSchema = z
  .object({
    entityId: PositiveIdSchema,
    name: NonEmptyTextSchema,
    shortName: EntityPreviewShortNameSchema,
    kind: EntityContextFields.kind,
    website: EntityContextFields.website,
    location: EntityLocationSchema,
    yearEstablished: EntityContextFields.yearEstablished,
  })
  .strict();

export const BottleUpdatePreviewSchema = z
  .object({
    before: BottlePreviewStateSchema,
    after: BottlePreviewStateSchema,
    changedFields: z.array(
      z.enum([
        "shared.name",
        "shared.statedAge",
        "shared.seriesId",
        "shared.category",
        "shared.brand",
        "shared.distillers",
        "shared.bottler",
        "exact.edition",
        "exact.statedAge",
        "exact.abv",
        "exact.singleCask",
        "exact.caskStrength",
        "exact.vintageYear",
        "exact.bottlingYear",
        "exact.releaseYear",
        "exact.maturation",
        "exact.caskNumber",
        "exact.outturn",
      ]),
    ),
    affectedBottles: BoundedImpactSchema,
    entityCreations: z.array(CreatedEntityPreviewSchema),
    warnings: z.array(OperationWarningSchema),
  })
  .strict();

export const BottleMergePreviewSchema = z
  .object({
    source: BottlePreviewStateSchema,
    destination: BottlePreviewStateSchema,
    outcome: z
      .object({
        retiredBottleId: PositiveIdSchema,
        survivorBottleId: PositiveIdSchema,
        tombstoneDestinationBottleId: PositiveIdSchema,
      })
      .strict(),
    consumers: z
      .object({
        tastings: z.number().int().nonnegative(),
        reviews: z.number().int().nonnegative(),
        storePrices: z.number().int().nonnegative(),
        observations: z.number().int().nonnegative(),
        collectionMemberships: z.number().int().nonnegative(),
        flightMemberships: z.number().int().nonnegative(),
        aliases: z.number().int().nonnegative(),
      })
      .strict(),
    membershipCollisions: z
      .object({
        collections: z.number().int().nonnegative(),
        flights: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(OperationWarningSchema),
  })
  .strict();

export const EntityImpactSchema = z
  .object({
    bottles: z.number().int().nonnegative(),
    brandGroups: z.number().int().nonnegative(),
    bottlerGroups: z.number().int().nonnegative(),
    distillerGroups: z.number().int().nonnegative(),
    series: z.number().int().nonnegative(),
    aliases: z.number().int().nonnegative(),
  })
  .strict();

export const EntityUpdatePreviewSchema = z
  .object({
    before: EntityPreviewStateSchema,
    after: EntityPreviewStateSchema,
    changedFields: z.array(
      z.enum([
        "name",
        "shortName",
        "kind",
        "website",
        "country",
        "region",
        "yearEstablished",
      ]),
    ),
    impact: EntityImpactSchema,
    warnings: z.array(OperationWarningSchema),
  })
  .strict();

export const EntityMergePreviewSchema = z
  .object({
    source: EntityPreviewStateSchema,
    destination: EntityPreviewStateSchema,
    after: EntityPreviewStateSchema,
    impact: EntityImpactSchema,
    collisions: z
      .object({
        bottleIdentities: z.number().int().nonnegative(),
        series: z.number().int().nonnegative(),
      })
      .strict(),
    outcome: z
      .object({
        retiredEntityId: PositiveIdSchema,
        survivorEntityId: PositiveIdSchema,
      })
      .strict(),
    warnings: z.array(OperationWarningSchema),
  })
  .strict();

const EntityDependencyStateSchema = z
  .object({
    entityId: PositiveIdSchema,
    name: NonEmptyTextSchema,
    shortName: RawEntityShortNameSchema,
    kind: EntityContextFields.kind,
  })
  .strict();

const SeriesDependencyStateSchema = z
  .object({
    seriesId: PositiveIdSchema,
    brandId: PositiveIdSchema,
    name: NonEmptyTextSchema,
  })
  .strict();

const RelationshipDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

const BottleSharedStateTokenFieldsSchema = z
  .object({
    name: BottleContextSharedFields.name.optional(),
    statedAge: BottleContextSharedFields.statedAge.optional(),
    seriesId: PositiveIdSchema.nullable().optional(),
    category: BottleContextSharedFields.category.optional(),
    brandId: PositiveIdSchema.optional(),
    distillerIds: z.array(PositiveIdSchema).optional(),
    bottlerId: PositiveIdSchema.nullable().optional(),
  })
  .strict();

export const BottleUpdateStateTokenSchema = z
  .object({
    bottleId: PositiveIdSchema,
    groupId: PositiveIdSchema,
    shared: BottleSharedStateTokenFieldsSchema.optional(),
    exact: BottleReviewExactStateSchema.partial().optional(),
    referencedEntities: z.array(EntityDependencyStateSchema),
    referencedSeries: z.array(SeriesDependencyStateSchema),
    relationshipDigest: RelationshipDigestSchema.optional(),
  })
  .strict();

const BottleMergeIdentityStateSchema = z
  .object({
    bottleId: PositiveIdSchema,
    groupId: PositiveIdSchema,
    fullName: NonEmptyTextSchema,
    shared: z
      .object({
        name: BottleContextSharedFields.name,
        statedAge: BottleContextSharedFields.statedAge,
        seriesId: PositiveIdSchema.nullable(),
        category: BottleContextSharedFields.category,
        brandId: PositiveIdSchema,
        distillerIds: z.array(PositiveIdSchema),
        bottlerId: PositiveIdSchema.nullable(),
      })
      .strict(),
    exact: BottleReviewExactStateSchema,
    aliasDigest: RelationshipDigestSchema,
    tombstoneDestinationBottleId: PositiveIdSchema.nullable(),
  })
  .strict();

export const BottleMergeStateTokenSchema = z
  .object({
    source: BottleMergeIdentityStateSchema,
    destination: BottleMergeIdentityStateSchema,
    relationshipDigest: RelationshipDigestSchema,
  })
  .strict();

const EntityPatchStateTokenSchema = z
  .object({
    name: NonEmptyTextSchema.optional(),
    shortName: RawEntityShortNameSchema.optional(),
    kind: EntityContextFields.kind.optional(),
    website: EntityContextFields.website.optional(),
    countryId: PositiveIdSchema.nullable().optional(),
    regionId: PositiveIdSchema.nullable().optional(),
    yearEstablished: EntityContextFields.yearEstablished.optional(),
  })
  .strict();

export const EntityUpdateStateTokenSchema = z
  .object({
    entityId: PositiveIdSchema,
    fields: EntityPatchStateTokenSchema,
    referencedCountry: z
      .object({ id: PositiveIdSchema, name: NonEmptyTextSchema })
      .strict()
      .nullable(),
    referencedRegion: z
      .object({
        id: PositiveIdSchema,
        countryId: PositiveIdSchema,
        name: NonEmptyTextSchema,
      })
      .strict()
      .nullable(),
    relationshipDigest: RelationshipDigestSchema.optional(),
  })
  .strict();

const EntityMergeIdentityStateSchema = z
  .object({
    entityId: PositiveIdSchema,
    name: NonEmptyTextSchema,
    shortName: RawEntityShortNameSchema,
    kind: EntityContextFields.kind,
    aliasDigest: RelationshipDigestSchema,
    tombstoneDestinationEntityId: PositiveIdSchema.nullable(),
  })
  .strict();

const EntityMergeSourceStateSchema = EntityMergeIdentityStateSchema.extend({
  website: EntityContextFields.website,
  countryId: PositiveIdSchema.nullable(),
  regionId: PositiveIdSchema.nullable(),
  yearEstablished: EntityContextFields.yearEstablished,
}).strict();

export const EntityMergeStateTokenSchema = z
  .object({
    source: EntityMergeSourceStateSchema,
    destination: EntityMergeIdentityStateSchema,
    relationshipDigest: RelationshipDigestSchema,
  })
  .strict();

export const PreparedReviewStatusSchema = z.enum([
  "pending_review",
  "rejected",
  "applying",
  "applied",
  "stale",
  "failed",
]);

export const ReviewBottleUpdateSchema = z
  .object({
    id: PositiveIdSchema,
    type: z.literal(ProposedOperationTypeSchema.enum.update_bottle),
    status: PreparedReviewStatusSchema,
    proposal: UpdateBottleOperationSchema,
    preview: BottleUpdatePreviewSchema,
    stateToken: BottleUpdateStateTokenSchema,
  })
  .strict();

export const ReviewBottleMergeSchema = z
  .object({
    id: PositiveIdSchema,
    type: z.literal(ProposedOperationTypeSchema.enum.merge_bottles),
    status: PreparedReviewStatusSchema,
    proposal: MergeBottlesOperationSchema,
    preview: BottleMergePreviewSchema,
    stateToken: BottleMergeStateTokenSchema,
  })
  .strict();

export const ReviewEntityUpdateSchema = z
  .object({
    id: PositiveIdSchema,
    type: z.literal(ProposedOperationTypeSchema.enum.update_entity),
    status: PreparedReviewStatusSchema,
    proposal: UpdateEntityOperationSchema,
    preview: EntityUpdatePreviewSchema,
    stateToken: EntityUpdateStateTokenSchema,
  })
  .strict();

export const ReviewEntityMergeSchema = z
  .object({
    id: PositiveIdSchema,
    type: z.literal(ProposedOperationTypeSchema.enum.merge_entities),
    status: PreparedReviewStatusSchema,
    proposal: MergeEntitiesOperationSchema,
    preview: EntityMergePreviewSchema,
    stateToken: EntityMergeStateTokenSchema,
  })
  .strict();

export const PreparedReviewOperationSchema = z.discriminatedUnion("type", [
  ReviewBottleUpdateSchema,
  ReviewBottleMergeSchema,
  ReviewEntityUpdateSchema,
  ReviewEntityMergeSchema,
]);

export const PreparedBottleUpdateDataSchema = ReviewBottleUpdateSchema.omit({
  id: true,
  status: true,
});
export const PreparedBottleMergeDataSchema = ReviewBottleMergeSchema.omit({
  id: true,
  status: true,
});
export const PreparedEntityUpdateDataSchema = ReviewEntityUpdateSchema.omit({
  id: true,
  status: true,
});
export const PreparedEntityMergeDataSchema = ReviewEntityMergeSchema.omit({
  id: true,
  status: true,
});

export const PreparedOperationDataSchema = z.discriminatedUnion("type", [
  PreparedBottleUpdateDataSchema,
  PreparedBottleMergeDataSchema,
  PreparedEntityUpdateDataSchema,
  PreparedEntityMergeDataSchema,
]);

const PreparedBottleUpdateProposalSchema = z
  .object({
    status: z.literal("pending_review"),
    proposal: UpdateBottleOperationSchema,
    stateToken: BottleUpdateStateTokenSchema,
  })
  .strict();

const PreparedBottleMergeProposalSchema = z
  .object({
    status: z.literal("pending_review"),
    proposal: MergeBottlesOperationSchema,
    stateToken: BottleMergeStateTokenSchema,
  })
  .strict();

const PreparedEntityUpdateProposalSchema = z
  .object({
    status: z.literal("pending_review"),
    proposal: UpdateEntityOperationSchema,
    stateToken: EntityUpdateStateTokenSchema,
  })
  .strict();

const PreparedEntityMergeProposalSchema = z
  .object({
    status: z.literal("pending_review"),
    proposal: MergeEntitiesOperationSchema,
    stateToken: EntityMergeStateTokenSchema,
  })
  .strict();

export const PreparedProposalSchema = z.union([
  PreparedBottleUpdateProposalSchema,
  PreparedBottleMergeProposalSchema,
  PreparedEntityUpdateProposalSchema,
  PreparedEntityMergeProposalSchema,
]);

export const BlockedProposalSchema = z
  .object({
    status: z.literal("blocked"),
    proposal: ProposedOperationSchema,
    preparationError: PreparationErrorSchema,
  })
  .strict();

export const PreparedProposalResultSchema = z.union([
  PreparedProposalSchema,
  BlockedProposalSchema,
]);

export const BlockedReviewOperationSchema = z
  .object({
    id: PositiveIdSchema,
    status: z.literal("blocked"),
    proposal: ProposedOperationSchema,
    preparationError: PreparationErrorSchema,
  })
  .strict();

export const ReviewOperationSchema = z.union([
  BlockedReviewOperationSchema,
  PreparedReviewOperationSchema,
]);

export type PreparationError = z.infer<typeof PreparationErrorSchema>;
export type PreparationErrorCode = z.infer<typeof PreparationErrorCodeSchema>;
export type ReviewOperation = z.infer<typeof ReviewOperationSchema>;
