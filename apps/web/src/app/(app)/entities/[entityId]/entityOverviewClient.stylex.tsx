"use client";

import { useQuery } from "@tanstack/react-query";

import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { useORPC } from "@peated/web/lib/orpc/context";

import { EntityBottleOverview } from "./entityBottleOverview";
import { EntityCatalogRelationships } from "./entityCatalogRelationships";
import { EntityDetails, hasEntityDetails } from "./entityDetails.stylex";
import { EntityHistoryOverview } from "./entityHistoryOverview.stylex";
import { EntityImageGallery } from "./entityImageGallery.stylex";
import { EntityImagePlaceholder } from "./entityImagePlaceholder.stylex";
import { EntityMap } from "./entityMap.stylex";
import { EntityOperatedOverview } from "./entityOperatedOverview";
import { EntityOverviewLayout } from "./entityOverviewLayout.stylex";
import { entityOverviewQueries } from "./entityOverviewQueries";
import { useEntityPage } from "./entityPageFrameClient.stylex";
import { EntityReleaseOverview } from "./entityReleaseOverview";
import { EntitySiblingOverview } from "./entitySiblingOverview";

export function EntityOverviewClient() {
  const orpc = useORPC();
  const entity = useEntityPage();
  const catalogQuery = useQuery(
    entityOverviewQueries.bottleCatalog(orpc, entity),
  );
  const eventListQuery = useQuery(entityOverviewQueries.events(orpc, entity));
  const bottleListQuery = useQuery(
    entityOverviewQueries.popularBottles(orpc, entity),
  );
  const releaseListQuery = useQuery(
    entityOverviewQueries.releases(orpc, entity),
  );
  const operatedListQuery = useQuery(
    entityOverviewQueries.operated(orpc, entity),
  );
  const siblingListQuery = useQuery(
    entityOverviewQueries.siblings(orpc, entity),
  );

  return (
    <EntityOverviewLayout
      facts={
        <>
          {hasEntityDetails(entity) ? <EntityDetails entity={entity} /> : null}
        </>
      }
      catalogSections={
        <>
          <EntityOperatedOverview
            entity={entity}
            error={Boolean(operatedListQuery.error)}
            operatedList={operatedListQuery.data}
            pending={operatedListQuery.isPending}
            retry={() => void operatedListQuery.refetch()}
          />
          <EntityReleaseOverview
            entity={entity}
            error={Boolean(releaseListQuery.error)}
            pending={releaseListQuery.isPending}
            releaseList={releaseListQuery.data}
            retry={() => void releaseListQuery.refetch()}
          />
          <EntityBottleOverview
            bottleList={bottleListQuery.data}
            createBottleHref={getEntityBottleCreateHref(entity)}
            entity={entity}
            error={Boolean(bottleListQuery.error)}
            pending={bottleListQuery.isPending}
            retry={() => void bottleListQuery.refetch()}
            totalBottles={entity.totalBottles}
          />
          <EntityHistoryOverview
            entityName={entity.name}
            error={Boolean(eventListQuery.error)}
            eventList={eventListQuery.data}
            pending={eventListQuery.isPending}
            retry={() => void eventListQuery.refetch()}
          />
        </>
      }
      media={
        <>
          {entity.images?.length ? (
            <EntityImageGallery entity={entity} />
          ) : (
            <EntityImagePlaceholder
              entityName={entity.name}
              kind={entity.kind}
            />
          )}
        </>
      }
      relationships={
        <>
          <EntityMap entity={entity} />
          <EntityCatalogRelationships
            catalog={catalogQuery.data}
            entity={entity}
            error={Boolean(catalogQuery.error)}
            pending={catalogQuery.isPending}
            retry={() => void catalogQuery.refetch()}
          />
          <EntitySiblingOverview
            entity={entity}
            error={Boolean(siblingListQuery.error)}
            pending={siblingListQuery.isPending}
            retry={() => void siblingListQuery.refetch()}
            siblingList={siblingListQuery.data}
          />
        </>
      }
    />
  );
}
