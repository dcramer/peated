import {
  BottleSchema,
  BottleSeriesSchema,
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
  "series",
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
  reviewScoreBandCounts: true,
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
  publicReviewAndTastingCount: true,
}).extend({
  region: z.object({ name: z.string() }).nullable(),
});

const SeriesResultSchema = BottleSeriesSchema.pick({
  id: true,
  peatedId: true,
  name: true,
  fullName: true,
  numReleases: true,
}).extend({
  brand: EntitySchema.pick({
    id: true,
    peatedId: true,
    name: true,
    shortName: true,
    kind: true,
  }),
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
    hasMore: z.boolean(),
    results: z.array(BottleResultSchema),
  }),
  z.object({
    type: z.literal("series"),
    hasMore: z.boolean(),
    results: z.array(SeriesResultSchema),
  }),
  z.object({
    type: z.literal("distilleries"),
    hasMore: z.boolean(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("brands"),
    hasMore: z.boolean(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("bottlers"),
    hasMore: z.boolean(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("companies"),
    hasMore: z.boolean(),
    results: z.array(EntityResultSchema),
  }),
  z.object({
    type: z.literal("regions"),
    hasMore: z.boolean(),
    results: z.array(RegionResultSchema),
  }),
  z.object({
    type: z.literal("members"),
    hasMore: z.boolean(),
    results: z.array(MemberResultSchema),
  }),
]);

export const ExactSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("bottle"), ref: BottleResultSchema }),
    z.object({ type: z.literal("entity"), ref: EntityResultSchema }),
    z.object({ type: z.literal("series"), ref: SeriesResultSchema }),
  ])
  .nullable();

const NearestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bottles"), result: BottleResultSchema }),
  z.object({ type: z.literal("series"), result: SeriesResultSchema }),
  z.object({ type: z.literal("distilleries"), result: EntityResultSchema }),
  z.object({ type: z.literal("brands"), result: EntityResultSchema }),
  z.object({ type: z.literal("bottlers"), result: EntityResultSchema }),
  z.object({ type: z.literal("companies"), result: EntityResultSchema }),
  z.object({ type: z.literal("regions"), result: RegionResultSchema }),
  z.object({ type: z.literal("members"), result: MemberResultSchema }),
]);

export const SearchOutputSchema = z.object({
  query: z.string(),
  exact: ExactSchema,
  groups: z.array(GroupSchema),
  nearest: z.array(NearestSchema).max(3),
});

export default contract
  .route({
    tags: ["search"],
    method: "GET",
    path: "/search",
    summary: "Global search",
    description:
      "Search bottles, series, brands, distilleries, bottlers, companies, regions, and members",
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
        suggestions: z
          .enum(["include", "exclude", "only"])
          .default("include")
          .describe(
            "Include possible matches after an empty result, leave them out, or return only possible matches",
          ),
      })
      .strict(),
  )
  .output(SearchOutputSchema);
