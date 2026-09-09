import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getEntityUrl } from "@peated/web/lib/urls";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { entityHasBottleCatalog } from "../entityPageData";
import { EntityTastingListClient } from "./entityTastingListClient.stylex";

const PageSearchParams = z
  .object({ cursor: z.string().optional() })
  .passthrough()
  .catch({});

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ entityId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  return getCatalogSeoMetadata(
    {
      title: `${entity.name} reviews and tastings`,
      description: `Read public whisky reviews and tasting notes for ${entity.name}.`,
      url: `${getEntityUrl(entity)}/tastings`,
    },
    searchParams,
  );
}

export default async function EntityTastingsPage(props: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  if (!entityHasBottleCatalog(entity)) redirect(getEntityUrl(entity));

  const { cursor } = PageSearchParams.parse(await props.searchParams);
  const { client } = await getPublicPageServerClient();
  const activity = await client.activity.reviewsAndTastings({
    entity: entity.id,
    cursor,
    limit: 25,
  });

  return (
    <EntityTastingListClient
      entityId={entity.id}
      entityName={entity.name}
      initialActivity={activity}
    />
  );
}
