import { ButtonLink } from "@peated/web/components";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import {
  BOTTLE_CATALOG_ALLOWED_VALUES,
  BOTTLE_CATALOG_QUERY_FIELDS,
  normalizeBottleCatalogQueryParams,
} from "@peated/web/lib/bottleCatalogQueryParams";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPageBottleList } from "@peated/web/lib/publicCatalog.server";
import { getEntityUrl } from "@peated/web/lib/urls";
import { redirect } from "next/navigation";

import {
  entityHasBottleCatalog,
  getDistilleryBottleView,
} from "../entityPageData";
import { EntityBottleListClient } from "./entityBottleListClient.stylex";

export default async function EntityBottlesPage(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId } = await props.params;
  const searchParams = await props.searchParams;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  if (!entityHasBottleCatalog(entity) && entity.totalBottles === 0) {
    redirect(getEntityUrl(entity));
  }

  const createBottleHref = getEntityBottleCreateHref(entity);
  let distilleryView = getDistilleryBottleView(entity, searchParams.view);
  let queryParams = normalizeBottleCatalogQueryParams(
    getApiQueryParams(searchParams, {
      defaults: { sort: "-release" },
      allowedValues: BOTTLE_CATALOG_ALLOWED_VALUES,
      fields: BOTTLE_CATALOG_QUERY_FIELDS,
      numericFields: [
        "age",
        "brand",
        "bottler",
        "cursor",
        "distiller",
        "entity",
        "limit",
        "series",
      ],
      overrides: {
        distilleryView,
        entity: entity.id,
        limit: 25,
      },
    }),
  );
  let bottleList = await getPageBottleList(queryParams);

  if (
    entity.kind === "distillery" &&
    searchParams.view === undefined &&
    distilleryView === "releases" &&
    bottleList.total === 0
  ) {
    distilleryView = "other";
    queryParams = { ...queryParams, distilleryView };
    bottleList = await getPageBottleList(queryParams);
  }

  return (
    <EntityBottleListClient
      emptyAction={
        <ButtonLink
          href={
            createBottleHref ??
            `/bottles/new?${new URLSearchParams({
              returnTo: `${getEntityUrl(entity)}/bottles`,
            }).toString()}`
          }
          size="sm"
          variant="accent"
        >
          Add a bottle
        </ButtonLink>
      }
      entityId={entity.id}
      entityKind={entity.kind}
      entityName={entity.name}
      initialDistilleryView={distilleryView}
      initialBottleList={bottleList}
    />
  );
}
