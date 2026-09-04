import { EntitySchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export const CompanyPortfolioKindSchema = z.enum([
  "brand",
  "distillery",
  "bottler",
]);

const OwnershipPathEntitySchema = EntitySchema.pick({
  id: true,
  peatedId: true,
  name: true,
  kind: true,
});

const PortfolioEntitySchema = EntitySchema.extend({
  ownershipPath: z
    .array(OwnershipPathEntitySchema)
    .readonly()
    .describe(
      "Recorded owner path from the requested Company through the immediate owner",
    ),
});

export const CompanyPortfolioInputSchema = z.object({
  company: z.coerce.number().int().positive(),
  kinds: z.array(CompanyPortfolioKindSchema).min(1).max(3).optional(),
  cursor: z.coerce.number().int().gte(1).default(1),
  limit: z.coerce.number().int().gte(1).lte(100).default(25),
  sort: z
    .enum(["name", "-name", "bottles", "-bottles", "tastings", "-tastings"])
    .default("-bottles"),
});

export const CompanyPortfolioOutputSchema = listResponse(
  PortfolioEntitySchema,
).extend({
  total: z.number().int().nonnegative(),
  totals: z.object({
    all: z.number().int().nonnegative(),
    brands: z.number().int().nonnegative(),
    distilleries: z.number().int().nonnegative(),
    bottlers: z.number().int().nonnegative(),
  }),
  groupCompanies: z.object({
    results: z.array(EntitySchema),
    total: z.number().int().nonnegative(),
  }),
  previews: z.object({
    brands: z.array(EntitySchema),
    distilleries: z.array(EntitySchema),
    bottlers: z.array(EntitySchema),
  }),
});

export default contract
  .route({
    method: "GET",
    path: "/entities/{company}/portfolio",
    summary: "List a company portfolio",
    description:
      "List brands, distilleries, and bottlers below a Company in the recorded current-owner chain.",
    operationId: "listCompanyPortfolio",
  })
  .input(CompanyPortfolioInputSchema)
  .output(CompanyPortfolioOutputSchema);
