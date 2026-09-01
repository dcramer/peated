import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getServerClient } from "@peated/web/lib/orpc/client.server";

import { AliasList } from "./aliasList.stylex";

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  return { title: `Other names for ${formatBottleDisplayName(bottle)}` };
}

export default async function BottleAliasesPage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const id = parseCatalogRouteId(bottleId);
  const { client } = await getServerClient();
  const aliasList = await client.bottleAliases.list({ bottle: id });

  return <AliasList bottleId={id} initialAliasList={aliasList} />;
}
