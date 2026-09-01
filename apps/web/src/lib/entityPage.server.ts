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
