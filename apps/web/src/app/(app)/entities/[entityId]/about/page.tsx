import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getEntityAbout,
  getVintageCounts,
} from "@peated/web/features/entityAbout/entityAbout";
import {
  EntityAboutArticle,
  EntityAboutLead,
} from "@peated/web/features/entityAbout/entityAboutArticle.stylex";
import { EntityAboutFacts } from "@peated/web/features/entityAbout/entityAboutFacts.stylex";
import { EntityAboutLayout } from "@peated/web/features/entityAbout/entityAboutLayout.stylex";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getEntityUrl } from "@peated/web/lib/urls";

import { EntityImageGallery } from "../entityImageGallery.stylex";

// Proof of concept: read the distiller's Bottles page by page. A stored
// article would get a vintage count from the API instead.
const MAX_BOTTLE_PAGES = 10;

async function getDistilledBottles(distillerId: number) {
  const { client } = await getPublicPageServerClient();
  const bottles: { vintageYear: number | null }[] = [];
  for (let cursor = 1; cursor <= MAX_BOTTLE_PAGES; cursor += 1) {
    const page = await client.bottles.list({
      cursor,
      distiller: distillerId,
      limit: 100,
    });
    bottles.push(...page.results);
    if (!page.rel.nextCursor) break;
  }
  return bottles;
}

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}): Promise<Metadata> {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  const about = getEntityAbout(entity.id);
  if (!about) notFound();
  return getCatalogSeoMetadata({
    title: `About ${entity.name}`,
    description: about.lead.text,
    url: `${getEntityUrl(entity)}/about`,
  });
}

export default async function EntityAboutPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  const about = getEntityAbout(entity.id);
  if (!about) notFound();

  const bottles = await getDistilledBottles(entity.id);

  return (
    <EntityAboutLayout
      lead={<EntityAboutLead about={about} />}
      article={
        <EntityAboutArticle
          about={about}
          currentYear={new Date().getUTCFullYear()}
          vintages={getVintageCounts(bottles)}
        />
      }
      rail={
        <>
          {entity.images?.length ? (
            <EntityImageGallery entity={entity} />
          ) : null}
          <EntityAboutFacts about={about} />
        </>
      }
    />
  );
}
