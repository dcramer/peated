"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import { SectionError } from "@peated/web/components";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../styles/tokens.stylex";

import { EntityBottleOverview } from "./entityBottleOverview";
import { EntityCatalogRelationships } from "./entityCatalogRelationships";
import { EntityDetails, hasEntityDetails } from "./entityDetails.stylex";
import { EntityHistoryOverview } from "./entityHistoryOverview.stylex";
import { EntityImageGallery } from "./entityImageGallery.stylex";
import { EntityImagePlaceholder } from "./entityImagePlaceholder.stylex";
import { EntityMap } from "./entityMap.stylex";
import { entityHasBottleCatalog, type Entity } from "./entityPageData";
import { EntityReleaseOverview } from "./entityReleaseOverview";
import { EntitySiblingOverview } from "./entitySiblingOverview";

type BottleList = Outputs["bottles"]["list"];
type EntityCatalog = Outputs["entities"]["catalog"];
type EntityEventList = Outputs["entities"]["events"]["list"];
type EntityList = Outputs["entities"]["list"];

const NARROW = "@media (max-width: 759px)";

export function EntityOverviewClient({
  initialBottleList,
  initialCatalog,
  initialEntity,
  initialEventList,
  initialReleaseList,
  initialSiblingList,
}: {
  initialBottleList?: BottleList;
  initialCatalog?: EntityCatalog;
  initialEntity: Entity;
  initialEventList?: EntityEventList;
  initialReleaseList?: BottleList;
  initialSiblingList?: EntityList;
}) {
  const orpc = useORPC();
  const ownsBottleSections = entityHasBottleCatalog(initialEntity);
  const entityQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: initialEntity.id },
    }),
    initialData: initialEntity,
  });
  const catalogQuery = useQuery({
    ...orpc.entities.catalog.queryOptions({
      input: { entity: initialEntity.id },
    }),
    enabled: ownsBottleSections,
    initialData: initialCatalog,
  });
  const eventListQuery = useQuery({
    ...orpc.entities.events.list.queryOptions({
      input: { entity: initialEntity.id },
    }),
    initialData: initialEventList,
  });
  const bottleListQuery = useQuery({
    ...orpc.bottles.list.queryOptions({
      input: {
        entity: initialEntity.id,
        limit: 4,
        sort: "-tastings",
      },
    }),
    enabled: ownsBottleSections,
    initialData: initialBottleList,
  });
  const releaseListQuery = useQuery({
    ...orpc.bottles.list.queryOptions({
      input: {
        entity: initialEntity.id,
        limit: 4,
        sort: "-release",
      },
    }),
    enabled: ownsBottleSections,
    initialData: initialReleaseList,
  });
  const siblingListQuery = useQuery({
    ...orpc.entities.list.queryOptions({
      input: {
        limit: 5,
        owner: initialEntity.ownerId ?? undefined,
        sort: "-bottles",
      },
    }),
    enabled: Boolean(initialEntity.ownerId),
    initialData: initialSiblingList,
  });

  if (entityQuery.error) {
    return (
      <SectionError
        heading="Details are unavailable"
        onRetry={() => void entityQuery.refetch()}
      >
        We could not load these details. Try again.
      </SectionError>
    );
  }

  const entity = entityQuery.data;
  return (
    <div {...stylex.props(styles.overviewGrid)}>
      <div {...stylex.props(styles.catalog)}>
        {hasEntityDetails(entity) ? <EntityDetails entity={entity} /> : null}
        <EntityBottleOverview
          bottleList={bottleListQuery.data}
          createBottleHref={getEntityBottleCreateHref(entity)}
          entity={entity}
          error={Boolean(bottleListQuery.error)}
          pending={bottleListQuery.isPending}
          retry={() => void bottleListQuery.refetch()}
          totalBottles={entity.totalBottles}
        />
        <EntityReleaseOverview
          entity={entity}
          error={Boolean(releaseListQuery.error)}
          pending={releaseListQuery.isPending}
          releaseList={releaseListQuery.data}
          retry={() => void releaseListQuery.refetch()}
        />
        <EntityHistoryOverview
          entityName={entity.name}
          error={Boolean(eventListQuery.error)}
          eventList={eventListQuery.data}
          pending={eventListQuery.isPending}
          retry={() => void eventListQuery.refetch()}
        />
      </div>

      <aside {...stylex.props(styles.details)}>
        {entity.images.length ? (
          <EntityImageGallery entity={entity} />
        ) : (
          <EntityImagePlaceholder entityName={entity.name} kind={entity.kind} />
        )}
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
      </aside>
    </div>
  );
}

const styles = stylex.create({
  overviewGrid: {
    display: "grid",
    gridTemplateAreas: {
      default: '"catalog details"',
      [NARROW]: '"catalog" "details"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    columnGap: space.x12,
  },
  catalog: {
    gridArea: "catalog",
    minWidth: 0,
    paddingTop: space.x4,
  },
  details: {
    gridArea: "details",
    minWidth: 0,
  },
});
