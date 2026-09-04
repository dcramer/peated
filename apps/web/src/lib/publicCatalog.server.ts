"server only";

import { BottleListInputSchema } from "@peated/server/orpc/contracts/bottles/list";
import { CompanyPortfolioInputSchema } from "@peated/server/orpc/contracts/entities/portfolio";
import type { Inputs } from "@peated/server/orpc/router";
import { unstable_cache } from "next/cache";
import {
  createAnonymousServerClient,
  getPublicPageServerClient,
} from "./orpc/client.server";
import { getSession } from "./session.server";

type BottleListInput = Inputs["bottles"]["list"];
type CompanyPortfolioInput = Inputs["entities"]["portfolio"];

const loadEntityCatalog = unstable_cache(
  async (entity: number) => {
    const { client } = await createAnonymousServerClient();
    return client.entities.catalog({ entity });
  },
  ["public-entity-catalog"],
  { revalidate: 300 },
);

const loadBottleList = unstable_cache(
  async (
    entity: number | null,
    company: number | null,
    series: number | null,
    distilleryView: BottleListInput["distilleryView"],
    sort: BottleListInput["sort"],
    limit: number,
  ) => {
    const { client } = await createAnonymousServerClient();
    return client.bottles.list({
      entity,
      company,
      series,
      distilleryView,
      sort,
      limit,
    });
  },
  ["public-catalog-bottles"],
  { revalidate: 300 },
);

const loadCompanyPortfolio = unstable_cache(
  async (
    company: number,
    kinds: CompanyPortfolioInput["kinds"],
    cursor: number,
    limit: number,
    sort: CompanyPortfolioInput["sort"],
  ) => {
    const { client } = await createAnonymousServerClient();
    return client.entities.portfolio({
      company,
      kinds,
      cursor,
      limit,
      sort,
    });
  },
  ["public-company-portfolio"],
  { revalidate: 300 },
);

/** Public page summaries revalidate every five minutes; member reads stay fresh. */
export async function getPageEntityCatalog(entity: number) {
  const session = await getSession();
  if (session.accessToken) {
    const { client } = await getPublicPageServerClient();
    return client.entities.catalog({ entity });
  }
  return loadEntityCatalog(entity);
}

/** Caches only anonymous first-page entity/series lists without extra filters. */
export async function getPageBottleList(input: BottleListInput) {
  const session = await getSession();
  const parsed = BottleListInputSchema.safeParse(input);
  if (session.accessToken || !parsed.success) {
    const { client } = await getPublicPageServerClient();
    return client.bottles.list(input);
  }
  const {
    entity,
    company,
    series,
    distilleryView,
    sort,
    limit,
    cursor,
    query,
    filter,
    ...filters
  } = parsed.data;

  // Public catalog caching owns anonymous snapshots, never Library or following state.
  if (
    (!entity && !company && !series) ||
    cursor !== 1 ||
    query ||
    filter !== "all" ||
    Object.values(filters).some((value) => value != null)
  ) {
    const { client } = await getPublicPageServerClient();
    return client.bottles.list(input);
  }

  return loadBottleList(
    entity ?? null,
    company ?? null,
    series ?? null,
    distilleryView ?? null,
    sort,
    limit,
  );
}

/** Caches public Company portfolio pages and their exact category totals. */
export async function getPageCompanyPortfolio(input: CompanyPortfolioInput) {
  const session = await getSession();
  const parsed = CompanyPortfolioInputSchema.safeParse(input);
  if (session.accessToken || !parsed.success) {
    const { client } = await getPublicPageServerClient();
    return client.entities.portfolio(input);
  }

  const { company, kinds, cursor, limit, sort } = parsed.data;
  return loadCompanyPortfolio(company, kinds, cursor, limit, sort);
}
