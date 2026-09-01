import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";

import { EntityAliasList } from "./entityAliasList.stylex";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  return { title: `Other names for ${entity.name}` };
}

export default async function EntityAliasesPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const id = parseCatalogRouteId(entityId);
  const { client } = await getServerClient();
  const aliasList = await client.entities.aliases.list({ entity: id });

  return <EntityAliasList entityId={id} initialAliasList={aliasList} />;
}
