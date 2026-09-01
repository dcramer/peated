import {
  BottleSchema,
  EntitySchema,
  RegionSchema,
  UserSchema,
} from "@peated/server/schemas";
import type { EntityKind } from "@peated/server/types";
import { z } from "zod";
import { contract } from "./base";

export const ENTITY_SEARCH_SCOPE_LIST = [
  "distilleries",
  "brands",
  "bottlers",
  "companies",
] as const;

export type EntitySearchScope = (typeof ENTITY_SEARCH_SCOPE_LIST)[number];

// Each public Entity search scope owns one Entity kind. All-kind callers must
// request every Entity scope explicitly.
export const ENTITY_KIND_BY_SEARCH_SCOPE = {
  distilleries: "distillery",
  brands: "brand",
  bottlers: "bottler",
  companies: "company",
} as const satisfies Record<EntitySearchScope, EntityKind>;

export const SEARCH_SCOPE_LIST = [
  "bottles",
  ...ENTITY_SEARCH_SCOPE_LIST,
  "regions",
  "members",
] as const;

export type SearchScope = (typeof SEARCH_SCOPE_LIST)[number];

const BottleResultSchema = BottleSchema.pick({
  id: true,
  name: true,
  category: true,
  edition: true,
  statedAge: true,
  noAgeStatement: true,
  caskStrength: true,
  singleCask: true,
  abv: true,
  vintageYear: true,
  releaseYear: true,
  imageUrl: true,
  medianScore: true,
  scoreCount: true,
  tastingBandCounts: true,
}).extend({
  brand: EntitySchema.pick({ name: true, shortName: true }),
  series: z.object({ name: z.string() }).nullable(),
  group: z.object({ name: z.string() }).optional(),
});

const EntityResultSchema = EntitySchema.pick({
  id: true,
  name: true,
  kind: true,
  isFollowing: true,
}).extend({
  region: z.object({ name: z.string() }).nullable(),
});

const RegionResultSchema = RegionSchema.pick({
  id: true,
  name: true,
  slug: true,
  totalDistillers: true,
}).extend({
  country: z.object({
    name: z.string(),
    slug: z.string(),
  }),
});

const UserResultSchema = UserSchema.pick({
  id: true,
  username: true,
  pictureUrl: true,
});

const MemberResultSchema = z.object({
  member: UserResultSchema,
  totalTastings: z.number().int().nonnegative(),
});

const GroupSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bottles"),
    total: z.number().int().nonnegative(),
    results: z.array(BottleResultSchema),
  }),
  z.object({
    type: z.literal("distilleries"),
    total: z.number().int().nonnegative(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("brands"),
    total: z.number().int().nonnegative(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("bottlers"),
    total: z.number().int().nonnegative(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("companies"),
    total: z.number().int().nonnegative(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("regions"),
    total: z.number().int().nonnegative(),
    results: z.array(RegionResultSchema),
  }),
  z.object({
    type: z.literal("members"),
    total: z.number().int().nonnegative(),
    results: z.array(MemberResultSchema),
  }),
]);

export const ExactSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("bottle"), ref: BottleResultSchema }),
    z.object({ type: z.literal("entity"), ref: EntityResultSchema }),
  ])
  .nullable();

const NearestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bottles"), result: BottleResultSchema }),
  z.object({ type: z.literal("distilleries"), result: EntityResultSchema }),
  z.object({ type: z.literal("brands"), result: EntityResultSchema }),
  z.object({ type: z.literal("bottlers"), result: EntityResultSchema }),
  z.object({ type: z.literal("companies"), result: EntityResultSchema }),
  z.object({ type: z.literal("regions"), result: RegionResultSchema }),
  z.object({ type: z.literal("members"), result: MemberResultSchema }),
]);

export const ScopeTotalsSchema = z.object({
  bottles: z.number().int().nonnegative(),
  distilleries: z.number().int().nonnegative(),
  brands: z.number().int().nonnegative(),
  bottlers: z.number().int().nonnegative(),
  companies: z.number().int().nonnegative(),
  regions: z.number().int().nonnegative(),
  members: z.number().int().nonnegative().optional(),
});

export const SearchOutputSchema = z.object({
  query: z.string(),
  exact: ExactSchema,
  groups: z.array(GroupSchema),
  scopeTotals: ScopeTotalsSchema.nullable(),
  nearest: z.array(NearestSchema).max(3),
});

export default contract
  .route({
    method: "GET",
    path: "/search",
    summary: "Global search",
    description:
      "Search bottles, brands, distilleries, bottlers, companies, regions, and members",
    spec: (spec) => ({ ...spec, operationId: "search" }),
  })
  .input(
    z
      .object({
        query: z.coerce
          .string()
          .describe("Search text only. Search operators are not supported."),
        scopes: z
          .array(z.enum(SEARCH_SCOPE_LIST))
          .default([...SEARCH_SCOPE_LIST]),
        limit: z.coerce.number().gte(1).lte(50).default(3),
        includeFacets: z.coerce
          .boolean()
          .default(false)
          .describe("Compute totals for each searchable scope"),
      })
      .strict(),
  )
  .output(SearchOutputSchema);
