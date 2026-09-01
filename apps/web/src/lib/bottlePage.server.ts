"server only";

import type { BottleDisplayNameSource } from "@peated/server/lib/bottleDisplayName";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";
import { getCanonicalPublicRouteRedirectPath } from "./tombstoneRedirect";
import { getBottleUrl } from "./urls";

export type BottlePageServices<
  Bottle extends BottleDisplayNameSource & { id: number },
> = {
  loadBottle: (bottleId: number) => Promise<Bottle>;
  getRedirectPath: (options: {
    canonicalBottle: Bottle;
    currentId: number;
  }) => Promise<string | null>;
  redirect: (path: string) => never;
};

/** Loads an independently complete Bottle and follows its canonical tombstone. */
export function createBottlePageLoader<
  Bottle extends BottleDisplayNameSource & { id: number },
>(services: BottlePageServices<Bottle>) {
  return async function loadBottlePage(bottleId: number) {
    const bottle = await services.loadBottle(bottleId);
    const redirectPath = await services.getRedirectPath({
      canonicalBottle: bottle,
      currentId: bottleId,
    });

    if (redirectPath) {
      services.redirect(redirectPath);
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
  getRedirectPath: ({ canonicalBottle, currentId }) =>
    getCanonicalPublicRouteRedirectPath({
      canonicalId: canonicalBottle.id,
      canonicalPath: getBottleUrl(canonicalBottle),
      currentId,
      currentPathPrefixes: [`/bottles/${currentId}`],
    }),
  redirect: permanentRedirect,
});

export const getBottlePage = cache(loadBottlePage);
