import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";

import { EntityOverviewClient } from "./entityOverviewClient.stylex";

export default async function EntityPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await getEntityPage(Number(entityId));
  const bottleList = await client.bottles
    .list({ entity: entity.id, limit: 4, sort: "-tastings" })
    .catch(() => undefined);

  return (
    <EntityOverviewClient
      initialBottleList={bottleList}
      initialEntity={entity}
    />
  );
}
