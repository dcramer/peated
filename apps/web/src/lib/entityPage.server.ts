"server only";

import { cache } from "react";
import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";

/** Loads an Entity after the proxy has enforced its canonical public route. */
async function loadEntityPage(entityId: number) {
  const { client } = await getAnonymousServerClient();
  return await resolveOrNotFound(client.entities.details({ entity: entityId }));
}

export const getEntityPage = cache(loadEntityPage);

async function loadCompanyPageCounts(company: number) {
  const { client } = await getAnonymousServerClient();
  const [portfolio, bottles] = await Promise.all([
    client.entities.portfolio({ company, limit: 1 }),
    client.bottles.list({ company, limit: 1 }),
  ]);

  return {
    bottles: bottles.total,
    portfolio: portfolio.totals.all,
  };
}

export const getCompanyPageCounts = cache(loadCompanyPageCounts);
