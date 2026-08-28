import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

import { EntityTastingListClient } from "./entityTastingListClient.stylex";

export default async function EntityTastingsPage(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await resolveOrNotFound(
    client.entities.details({ entity: Number(entityId) }),
  );
  const queryParams = getApiQueryParams(await props.searchParams, {
    numericFields: ["cursor"],
    overrides: { entity: entity.id, limit: 25 },
  });
  const tastingList = await client.tastings.list(queryParams);

  return (
    <EntityTastingListClient
      entityId={entity.id}
      entityName={entity.name}
      initialTastingList={tastingList}
    />
  );
}
