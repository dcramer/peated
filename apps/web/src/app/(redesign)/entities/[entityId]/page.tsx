import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

import { EntityOverviewClient } from "./entityOverviewClient.stylex";

export default async function EntityPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await resolveOrNotFound(
    client.entities.details({ entity: Number(entityId) }),
  );
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
