"server only";

import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";
import { getCanonicalRouteRedirectPath } from "./tombstoneRedirect";

/** Loads an independently complete Bottle and follows its canonical tombstone. */
export const getBottlePage = cache(async (bottleId: number) => {
  const { client } = await getAnonymousServerClient();
  const bottle = await resolveOrNotFound(
    client.bottles.details({ bottle: bottleId }),
  );

  if (bottle.id !== bottleId) {
    permanentRedirect(
      await getCanonicalRouteRedirectPath({
        currentId: bottleId,
        canonicalId: bottle.id,
        collectionPath: "/bottles",
      }),
    );
  }

  return bottle;
});
