"use client";

import * as stylex from "@stylexjs/stylex";
import { space } from "../../../../styles/tokens.stylex";

import { FlavorProfileSection } from "@peated/web/features/flavorProfile/flavorProfileSection";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";

import { CompanyOwnedList } from "./companyOwnedList";
import { EntityCatalogRelationships } from "./entityCatalogRelationships";
import { EntityDetails, type EntityAboutFact } from "./entityDetails.stylex";
import { EntityImageGallery } from "./entityImageGallery.stylex";
import { EntityImagePlaceholder } from "./entityImagePlaceholder.stylex";
import { EntityMap } from "./entityMap.stylex";
import { EntityOverviewLayout } from "./entityOverviewLayout.stylex";
import { entityOverviewQueries } from "./entityOverviewQueries";
import { useEntityPage } from "./entityPageFrameClient.stylex";
import { EntityReleaseOverview } from "./entityReleaseOverview";
import { EntityReviewsAndTastingsOverview } from "./entityReviewsAndTastingsOverview";
import { EntitySiblingOverview } from "./entitySiblingOverview";

/** The About document's parts, rendered on the server. */
export type EntityOverviewAbout = {
  lead: ReactNode;
  timeline: ReactNode;
  history: ReactNode;
  sources: ReactNode;
  owners: ReactNode;
  facts: readonly EntityAboutFact[];
};

export function EntityOverviewClient({
  about,
}: {
  about?: EntityOverviewAbout;
}) {
  const orpc = useORPC();
  const entity = useEntityPage();
  const catalogQuery = useQuery(
    entityOverviewQueries.bottleCatalog(orpc, entity),
  );
  const latestBottlingsQuery = useQuery(
    entityOverviewQueries.latestBottlings(orpc, entity),
  );
  const recentReviewsAndTastingsQuery = useQuery(
    entityOverviewQueries.recentReviewsAndTastings(orpc, entity),
  );
  const releaseListQuery = useQuery(
    entityOverviewQueries.releases(orpc, entity),
  );
  const companyPortfolioQuery = useQuery(
    entityOverviewQueries.companyPortfolio(orpc, entity),
  );
  const siblingListQuery = useQuery(
    entityOverviewQueries.siblings(orpc, entity),
  );
  // Only distilleries load their latest bottlings; other kinds skip it.
  const bottlingsQueries =
    entity.kind === "distillery"
      ? [releaseListQuery, latestBottlingsQuery]
      : [releaseListQuery];
  const portfolioSection = getLargestPortfolioSection(
    companyPortfolioQuery.data?.totals,
  );

  return (
    <EntityOverviewLayout
      lead={about?.lead}
      timeline={about?.timeline}
      history={about?.history}
      sources={about?.sources}
      facts={
        <>
          <EntityDetails aboutFacts={about?.facts} entity={entity} />
          {about?.owners}
        </>
      }
      catalog={
        <>
          {companyPortfolioQuery.isPending || companyPortfolioQuery.error ? (
            <CompanyOwnedList
              company={entity}
              error={Boolean(companyPortfolioQuery.error)}
              pending={companyPortfolioQuery.isPending}
              retry={() => void companyPortfolioQuery.refetch()}
              section="portfolio"
            />
          ) : (
            <CompanyOwnedList
              company={entity}
              error={false}
              href={`${getEntityUrl(entity)}/portfolio?kind=${portfolioSection.kind}`}
              items={
                companyPortfolioQuery.data?.previews[portfolioSection.section]
              }
              pending={false}
              retry={() => void companyPortfolioQuery.refetch()}
              section={portfolioSection.section}
              total={
                companyPortfolioQuery.data?.totals[portfolioSection.section]
              }
            />
          )}
          <EntityReleaseOverview
            createBottleHref={getEntityBottleCreateHref(entity)}
            entity={entity}
            error={bottlingsQueries.some((query) => Boolean(query.error))}
            latestBottlings={latestBottlingsQuery.data}
            pending={bottlingsQueries.some((query) => query.isPending)}
            releaseList={releaseListQuery.data}
            retry={() => {
              for (const query of bottlingsQueries) void query.refetch();
            }}
          />
        </>
      }
      activity={
        <EntityReviewsAndTastingsOverview
          entity={entity}
          error={Boolean(recentReviewsAndTastingsQuery.error)}
          pending={recentReviewsAndTastingsQuery.isPending}
          retry={() => void recentReviewsAndTastingsQuery.refetch()}
          reviewsAndTastings={recentReviewsAndTastingsQuery.data}
        />
      }
      media={
        <>
          {entity.images?.length ? (
            <EntityImageGallery entity={entity} />
          ) : (
            <EntityImagePlaceholder
              entityName={entity.name}
              kind={entity.kind}
            />
          )}
        </>
      }
      relationships={
        <>
          <CompanyOwnedList
            company={entity}
            error={false}
            items={companyPortfolioQuery.data?.groupCompanies.results}
            pending={false}
            retry={() => void companyPortfolioQuery.refetch()}
            section="groupCompanies"
            total={companyPortfolioQuery.data?.groupCompanies.total}
          />
          <EntityMap entity={entity} />
          {entity.kind === "distillery" ? (
            <div {...stylex.props(styles.flavorProfile)}>
              <FlavorProfileSection
                key={entity.id}
                scope={{ kind: "distillery", entity: entity.id }}
              />
            </div>
          ) : null}
          <EntityCatalogRelationships
            catalog={catalogQuery.data}
            entity={entity}
            error={Boolean(catalogQuery.error)}
            pending={catalogQuery.isPending}
            retry={() => void catalogQuery.refetch()}
          />
          <EntitySiblingOverview
            entity={entity}
            error={Boolean(siblingListQuery.error)}
            pending={siblingListQuery.isPending}
            retry={() => void siblingListQuery.refetch()}
            siblingList={siblingListQuery.data}
          />
        </>
      }
    />
  );
}

const portfolioSections = [
  { section: "brands", kind: "brand" },
  { section: "distilleries", kind: "distillery" },
  { section: "bottlers", kind: "bottler" },
] as const;

/** A company's Overview shows only its largest group; ties keep this order. */
function getLargestPortfolioSection(
  totals?: Record<(typeof portfolioSections)[number]["section"], number>,
) {
  return portfolioSections.reduce((largest, candidate) =>
    totals && totals[candidate.section] > totals[largest.section]
      ? candidate
      : largest,
  );
}

const styles = stylex.create({
  flavorProfile: {
    display: { default: "block", ":empty": "none" },
    paddingTop: space.x6,
  },
});
