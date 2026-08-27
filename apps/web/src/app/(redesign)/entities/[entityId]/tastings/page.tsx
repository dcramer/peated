import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

import { EntityTastingListClient } from "./entityTastingListClient.stylex";

export default async function EntityTastingsPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await resolveOrNotFound(
    client.entities.details({ entity: Number(entityId) }),
  );

  return (
    <EntityTastingListClient entityId={entity.id} entityName={entity.name} />
  );
}
