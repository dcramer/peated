import { CompanyPortfolioInputSchema } from "@peated/server/orpc/contracts/entities/portfolio";
import {
  getApiQueryParams,
  type SearchParamSource,
} from "@peated/web/lib/apiQueryParams";

export const companyPortfolioKinds = [
  "brand",
  "distillery",
  "bottler",
] as const;
export type CompanyPortfolioKind = (typeof companyPortfolioKinds)[number];

export const companyPortfolioSorts = [
  "-bottles",
  "-tastings",
  "name",
  "-name",
  "bottles",
  "tastings",
] as const;

export function getCompanyPortfolioInput(
  company: number,
  searchParams: SearchParamSource,
) {
  const params = getApiQueryParams(searchParams, {
    allowedValues: {
      kind: companyPortfolioKinds,
      sort: companyPortfolioSorts,
    },
    defaults: { cursor: 1, sort: "-bottles" },
    fields: ["cursor", "kind", "sort"],
    numericFields: ["cursor"],
  });
  return CompanyPortfolioInputSchema.parse({
    company,
    cursor: Number(params.cursor),
    kinds: params.kind ? [params.kind] : undefined,
    limit: 25,
    sort: params.sort,
  });
}
