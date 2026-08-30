import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";

import { EntityOverviewClient } from "./entityOverviewClient.stylex";
import { entityHasBottleCatalog } from "./entityPageData";

export default async function EntityPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await getEntityPage(Number(entityId));
  const ownsBottleSections = entityHasBottleCatalog(entity);
  const [bottleList, releaseList, siblingList, catalog, eventList] =
    await Promise.all([
      ownsBottleSections
        ? client.bottles
            .list({ entity: entity.id, limit: 4, sort: "-tastings" })
            .catch(() => undefined)
        : undefined,
      ownsBottleSections
        ? client.bottles
            .list({ entity: entity.id, limit: 4, sort: "-release" })
            .catch(() => undefined)
        : undefined,
      entity.ownerId
        ? client.entities
            .list({
              limit: 5,
              owner: entity.ownerId,
              sort: "-bottles",
            })
            .catch(() => undefined)
        : undefined,
      ownsBottleSections
        ? client.entities.catalog({ entity: entity.id }).catch(() => undefined)
        : undefined,
      client.entities.events.list({ entity: entity.id }).catch(() => undefined),
    ]);

  return (
    <EntityOverviewClient
      initialBottleList={bottleList}
      initialCatalog={catalog}
      initialEntity={entity}
      initialEventList={eventList}
      initialReleaseList={releaseList}
      initialSiblingList={siblingList}
    />
  );
}
