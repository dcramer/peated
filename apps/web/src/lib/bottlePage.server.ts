"server only";

import { isORPCNotFoundError } from "@peated/orpc/client/errors";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";
import { requireReleaseFamilyAnchor } from "./releaseFamily";
import {
  getCanonicalRouteRedirectPath,
  getReleaseFamilyRouteRedirectPath,
} from "./tombstoneRedirect";

/**
 * Loads an exact Bottle in one read, falling back to page-target resolution only
 * when the details route returns its typed not-found error.
 */
export const getBottlePage = cache(async (bottleId: number) => {
  const { client } = await getAnonymousServerClient();

  try {
    const bottle = await client.bottles.details({ bottle: bottleId });

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
  } catch (error) {
    if (!isORPCNotFoundError(error)) {
      throw error;
    }
  }

  const pageTarget = await resolveOrNotFound(
    client.bottles.pageTarget({ bottle: bottleId }),
  );

  if (pageTarget.kind === "group") {
    const group = await resolveOrNotFound(
      client.bottleGroups.details({ group: pageTarget.groupId }),
    );
    permanentRedirect(
      await getReleaseFamilyRouteRedirectPath(
        requireReleaseFamilyAnchor(group),
      ),
    );
  }

  permanentRedirect(
    await getCanonicalRouteRedirectPath({
      currentId: bottleId,
      canonicalId: pageTarget.bottleId,
      collectionPath: "/bottles",
    }),
  );
});
