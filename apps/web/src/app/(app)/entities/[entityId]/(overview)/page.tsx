import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import config from "@peated/web/config";
import {
  getCitationNumbers,
  getKeyFacts,
  getOwners,
} from "@peated/web/features/entityAbout/entityAbout";
import {
  EntityAboutHistory,
  EntityAboutLead,
  EntityAboutSources,
  EntityAboutTimeline,
} from "@peated/web/features/entityAbout/entityAboutArticle.stylex";
import { EntityAboutOwners } from "@peated/web/features/entityAbout/entityAboutOwners.stylex";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import {
  getPageBottleList,
  getPageEntityAbout,
  getPageEntityCatalog,
} from "@peated/web/lib/publicCatalog.server";
import { getEntitySeoMetadata } from "@peated/web/lib/seoMetadata";
import { serializeJsonLd } from "@peated/web/lib/structuredData";
import { getEntityUrl } from "@peated/web/lib/urls";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import type { Organization, WithContext } from "schema-dts";

import {
  EntityOverviewClient,
  type EntityOverviewAbout,
} from "../entityOverviewClient.stylex";
import { entityOverviewQueries } from "../entityOverviewQueries";
import { entityHasBottleCatalog, type Entity } from "../entityPageData";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}): Promise<Metadata> {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  return getEntitySeoMetadata(entity, { canonical: true });
}

export default async function EntityPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  const queryClient = getQueryClient();
  const { client } = await getPublicPageServerClient();
  const orpc = createTanstackQueryUtils(client);
  const prefetches: Promise<unknown>[] = [];

  if (entityHasBottleCatalog(entity)) {
    const bottleQueries = [
      entityOverviewQueries.popularBottles(orpc, entity),
      entityOverviewQueries.releases(orpc, entity),
    ];
    prefetches.push(
      queryClient.prefetchQuery({
        ...entityOverviewQueries.bottleCatalog(orpc, entity),
        queryFn: () => getPageEntityCatalog(entity.id),
      }),
      ...bottleQueries.map((query) =>
        queryClient.prefetchQuery({
          ...query,
          queryFn: () => getPageBottleList(query.input),
        }),
      ),
    );
  }

  if (entity.kind === "distillery") {
    prefetches.push(
      queryClient.prefetchQuery(
        entityOverviewQueries.seriesByBottleCount(orpc, entity),
      ),
      queryClient.prefetchQuery(
        entityOverviewQueries.recentReviewsAndTastings(orpc, entity),
      ),
    );
  }

  if (entity.kind === "company") {
    prefetches.push(
      queryClient.prefetchQuery(
        entityOverviewQueries.companyPortfolio(orpc, entity),
      ),
    );
  }

  if (entity.ownerId) {
    prefetches.push(
      queryClient.prefetchQuery(entityOverviewQueries.siblings(orpc, entity)),
    );
  }

  const [about] = await Promise.all([
    entity.hasAbout ? getEntityOverviewAbout(entity) : null,
    ...prefetches,
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {about?.jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(about.jsonLd) }}
        />
      ) : null}
      <EntityOverviewClient about={about?.parts} />
    </HydrationBoundary>
  );
}

/** Renders the About document's parts for the Entity page. */
async function getEntityOverviewAbout(entity: Entity) {
  const { about, counts } = await getPageEntityAbout(entity.id);
  if (!about?.lead) return null;

  const keyFacts = getKeyFacts(about, entity.name);
  const citationNumbers = getCitationNumbers(about, keyFacts);
  const parts: EntityOverviewAbout = {
    lead: (
      <EntityAboutLead
        about={about}
        citationNumbers={citationNumbers}
        lead={about.lead}
      />
    ),
    timeline: (
      <EntityAboutTimeline
        about={about}
        currentYear={new Date().getUTCFullYear()}
        entityName={entity.name}
      />
    ),
    history: (
      <EntityAboutHistory
        about={about}
        citationNumbers={citationNumbers}
        counts={counts}
        entity={entity}
      />
    ),
    sources: (
      <EntityAboutSources about={about} citationNumbers={citationNumbers} />
    ),
    owners: <EntityAboutOwners owners={getOwners(about)} />,
    facts: keyFacts.map(({ key, label, value }) => ({ key, label, value })),
  };

  // Adds the founding date to the Organization the entity layout describes.
  const opened = about.events.find((event) => event.kind === "opened");
  const entityUrl = new URL(getEntityUrl(entity), config.URL_PREFIX).href;
  const jsonLd: WithContext<Organization> | null = opened
    ? {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${entityUrl}#organization`,
        foundingDate: opened.date,
      }
    : null;

  return { parts, jsonLd };
}
