import { ButtonLink } from "@peated/web/components/designSystem/components";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getEntityUrl } from "@peated/web/lib/urls";

import { EntityBottleListClient } from "./entityBottleListClient.stylex";

export default async function EntityBottlesPage(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId } = await props.params;
  const { client } = await getPublicPageServerClient();
  const entity = await getEntityPage(Number(entityId));
  const createBottleHref = getEntityBottleCreateHref(entity);
  const queryParams = getApiQueryParams(await props.searchParams, {
    defaults: { sort: "-release" },
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
      entity: entity.id,
      limit: 25,
    },
  });
  const bottleList = await client.bottles.list(queryParams);

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
          Record a bottle
        </ButtonLink>
      }
      entityId={entity.id}
      entityName={entity.name}
      initialBottleList={bottleList}
    />
  );
}
