"server only";

import type { Entity } from "@peated/server/types";
import { permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getAnonymousServerClient } from "./orpc/client.server";
import { resolveOrNotFound } from "./orpc/notFound.server";
import { getCanonicalPublicRouteRedirectPath } from "./tombstoneRedirect";
import { getEntityRoutePrefixes, getEntityUrl } from "./urls";

export type EntityPageServices<PageEntity extends Pick<Entity, "id" | "kind">> =
  {
    loadEntity: (entityId: number) => Promise<PageEntity>;
    getRedirectPath: (options: {
      canonicalEntity: PageEntity;
      currentId: number;
    }) => Promise<string | null>;
    redirect: (path: string) => never;
  };

/** Loads an Entity and keeps its primary kind in the public route. */
export function createEntityPageLoader<
  PageEntity extends Pick<Entity, "id" | "kind">,
>(services: EntityPageServices<PageEntity>) {
  return async function loadEntityPage(entityId: number) {
    const entity = await services.loadEntity(entityId);
    const redirectPath = await services.getRedirectPath({
      canonicalEntity: entity,
      currentId: entityId,
    });

    if (redirectPath) {
      services.redirect(redirectPath);
    }

    return entity;
  };
}

const loadEntityPage = createEntityPageLoader({
  async loadEntity(entityId: number) {
    const { client } = await getAnonymousServerClient();
    return await resolveOrNotFound(
      client.entities.details({ entity: entityId }),
    );
  },
  getRedirectPath: ({ canonicalEntity, currentId }) =>
    getCanonicalPublicRouteRedirectPath({
      canonicalId: canonicalEntity.id,
      canonicalPath: getEntityUrl(canonicalEntity),
      currentId,
      currentPathPrefixes: getEntityRoutePrefixes(currentId),
    }),
  redirect: permanentRedirect,
});

export const getEntityPage = cache(loadEntityPage);
