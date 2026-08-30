"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import { SectionError } from "@peated/web/components/designSystem/components";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../styles/tokens.stylex";

import { EntityBottleOverview } from "./entityBottleOverview";
import { EntityDetails, hasEntityDetails } from "./entityDetails.stylex";
import { EntityMap } from "./entityMap.stylex";
import { entityHasBottleCatalog, type Entity } from "./entityPageData";
import { EntityReleaseOverview } from "./entityReleaseOverview";
import { EntitySiblingOverview } from "./entitySiblingOverview";

type BottleList = Outputs["bottles"]["list"];
type EntityList = Outputs["entities"]["list"];

const NARROW = "@media (max-width: 759px)";

export function EntityOverviewClient({
  initialBottleList,
  initialEntity,
  initialReleaseList,
  initialSiblingList,
}: {
  initialBottleList?: BottleList;
  initialEntity: Entity;
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
        heading="Entity details are unavailable"
        onRetry={() => void entityQuery.refetch()}
      >
        We could not load this entity. Try again.
      </SectionError>
    );
  }

  const entity = entityQuery.data;
  const hasRail =
    hasEntityDetails(entity) ||
    Boolean(entity.location) ||
    Boolean(entity.ownerId);

  return (
    <div
      {...stylex.props(
        styles.overviewGrid,
        !hasRail && styles.overviewGridWithoutDetails,
      )}
    >
      {hasRail ? (
        <aside {...stylex.props(styles.details)}>
          <EntityDetails entity={entity} />
          <EntityMap entity={entity} />
          <EntitySiblingOverview
            entity={entity}
            error={Boolean(siblingListQuery.error)}
            pending={siblingListQuery.isPending}
            retry={() => void siblingListQuery.refetch()}
            siblingList={siblingListQuery.data}
          />
        </aside>
      ) : null}

      <div {...stylex.props(styles.catalog)}>
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
      </div>
    </div>
  );
}

const styles = stylex.create({
  overviewGrid: {
    display: "grid",
    gridTemplateAreas: {
      default: '"catalog details"',
      [NARROW]: '"details" "catalog"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    columnGap: space.x12,
  },
  overviewGridWithoutDetails: {
    gridTemplateAreas: '"catalog"',
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  catalog: {
    gridArea: "catalog",
    minWidth: 0,
  },
  details: {
    gridArea: "details",
    minWidth: 0,
  },
});
