import { ButtonLink } from "@peated/web/components/designSystem/components";
import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

import { EntityBottleListClient } from "./entityBottleListClient.stylex";

export default async function EntityBottlesPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await resolveOrNotFound(
    client.entities.details({ entity: Number(entityId) }),
  );
  const createBottleHref = getEntityBottleCreateHref(entity);

  return (
    <EntityBottleListClient
      emptyAction={
        <ButtonLink
          href={
            createBottleHref ??
            `/bottles/new?${new URLSearchParams({
              returnTo: `/entities/${entity.id}/bottles`,
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
    />
  );
}
