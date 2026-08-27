import {
  BottleSchema,
  EntitySchema,
  RegionSchema,
  UserSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "./base";

export const SEARCH_SCOPE_LIST = [
  "bottles",
  "distillers",
  "brands",
  "bottlers",
  "blenders",
  "companies",
  "regions",
  "members",
] as const;

export type SearchScope = (typeof SEARCH_SCOPE_LIST)[number];

const MemberResultSchema = z.object({
  member: UserSchema,
  totalTastings: z.number().int().nonnegative(),
});

const GroupSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("bottles"),
    total: z.number().int().nonnegative(),
    results: z.array(BottleSchema),
  }),
  z.object({
    type: z.literal("distillers"),
    total: z.number().int().nonnegative(),
    results: z.array(EntitySchema),
  }),
  z.object({
    type: z.literal("brands"),
    total: z.number().int().nonnegative(),
    results: z.array(EntitySchema),
  }),
  z.object({
    type: z.literal("bottlers"),
    total: z.number().int().nonnegative(),
    results: z.array(EntitySchema),
  }),
  z.object({
    type: z.literal("blenders"),
    total: z.number().int().nonnegative(),
    results: z.array(EntitySchema),
  }),
  z.object({
    type: z.literal("companies"),
    total: z.number().int().nonnegative(),
    results: z.array(EntitySchema),
  }),
  z.object({
    type: z.literal("regions"),
    total: z.number().int().nonnegative(),
    results: z.array(RegionSchema),
  }),
  z.object({
    type: z.literal("members"),
    total: z.number().int().nonnegative(),
    results: z.array(MemberResultSchema),
  }),
]);

export const ExactSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("bottle"), ref: BottleSchema }),
    z.object({ type: z.literal("entity"), ref: EntitySchema }),
  ])
  .nullable();

const NearestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bottles"), result: BottleSchema }),
  z.object({ type: z.literal("distillers"), result: EntitySchema }),
  z.object({ type: z.literal("brands"), result: EntitySchema }),
  z.object({ type: z.literal("bottlers"), result: EntitySchema }),
  z.object({ type: z.literal("blenders"), result: EntitySchema }),
  z.object({ type: z.literal("companies"), result: EntitySchema }),
  z.object({ type: z.literal("regions"), result: RegionSchema }),
  z.object({ type: z.literal("members"), result: MemberResultSchema }),
]);

export const ScopeTotalsSchema = z.object({
  bottles: z.number().int().nonnegative(),
  distillers: z.number().int().nonnegative(),
  brands: z.number().int().nonnegative(),
  bottlers: z.number().int().nonnegative(),
  blenders: z.number().int().nonnegative(),
  companies: z.number().int().nonnegative(),
  regions: z.number().int().nonnegative(),
  members: z.number().int().nonnegative().optional(),
});

export const SearchOutputSchema = z.object({
  query: z.string(),
  exact: ExactSchema,
  groups: z.array(GroupSchema),
  scopeTotals: ScopeTotalsSchema,
  nearest: z.array(NearestSchema).max(3),
});

export default contract
  .route({
    method: "GET",
    path: "/search",
    summary: "Global search",
    description:
      "Search bottles, brands, distilleries, bottlers, regions, and members",
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
      })
      .strict(),
  )
  .output(SearchOutputSchema);
