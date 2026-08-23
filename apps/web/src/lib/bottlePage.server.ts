"server only";

import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";
import { getCanonicalRouteRedirectPath } from "./tombstoneRedirect";

export type BottlePageServices<Bottle extends { id: number }> = {
  loadBottle: (bottleId: number) => Promise<Bottle>;
  getRedirectPath: (ids: {
    canonicalId: number;
    currentId: number;
  }) => Promise<string>;
  redirect: (path: string) => never;
};

/** Loads an independently complete Bottle and follows its canonical tombstone. */
export function createBottlePageLoader<Bottle extends { id: number }>(
  services: BottlePageServices<Bottle>,
) {
  return async function loadBottlePage(bottleId: number) {
    const bottle = await services.loadBottle(bottleId);

    if (bottle.id !== bottleId) {
      services.redirect(
        await services.getRedirectPath({
          currentId: bottleId,
          canonicalId: bottle.id,
        }),
      );
    }

    return bottle;
  };
}

const loadBottlePage = createBottlePageLoader({
  async loadBottle(bottleId: number) {
    const { client } = await getAnonymousServerClient();
    return await resolveOrNotFound(
      client.bottles.details({ bottle: bottleId }),
    );
  },
  getRedirectPath: ({ canonicalId, currentId }) =>
    getCanonicalRouteRedirectPath({
      currentId,
      canonicalId,
      collectionPath: "/bottles",
    }),
  redirect: permanentRedirect,
});

export const getBottlePage = cache(loadBottlePage);
