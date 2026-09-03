"server only";

import { permanentRedirect } from "next/navigation";
import { cache } from "react";

import { parseCatalogRouteId } from "./catalogRoute";
import { getPublicPageServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";
import {
  getCanonicalPublicRouteRedirectPath,
  type LoadRequestHeaders,
} from "./tombstoneRedirect";
import { getTastingUrl } from "./urls";

export function createTastingPageLoader<
  Tasting extends Parameters<typeof getTastingUrl>[0],
>(
  loadTasting: (id: number) => Promise<Tasting>,
  loadHeaders?: LoadRequestHeaders,
) {
  return async (tastingId: string) => {
    const id = parseCatalogRouteId(tastingId);
    // Tasting privacy owns access: resolve visibility before revealing the current bottle slug.
    const tasting = await resolveOrNotFound(loadTasting(id));
    const redirectPath = await getCanonicalPublicRouteRedirectPath(
      {
        canonicalId: tasting.id,
        canonicalPath: getTastingUrl(tasting),
        currentId: id,
        currentPathPrefixes: [`/tastings/${id}`],
      },
      loadHeaders,
    );
    if (redirectPath) permanentRedirect(redirectPath);
    return tasting;
  };
}

const loadTastingPage = createTastingPageLoader(async (id: number) => {
  const { client } = await getPublicPageServerClient();
  return await client.tastings.details({ tasting: id });
});

export const getTastingPage = cache(loadTastingPage);
