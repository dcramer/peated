"use client";

import * as stylex from "@stylexjs/stylex";
import { space } from "../../../../styles/tokens.stylex";

import { FlavorProfileSection } from "@peated/web/features/flavorProfile/flavorProfileSection";
import { useQuery } from "@tanstack/react-query";

import { getEntityBottleCreateHref } from "@peated/web/lib/entityBottleCreateHref";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";

import { CompanyOwnedList } from "./companyOwnedList";
import { EntityBottleOverview } from "./entityBottleOverview";
import { EntityCatalogRelationships } from "./entityCatalogRelationships";
import { EntityDetails, hasEntityDetails } from "./entityDetails.stylex";
import { EntityHistoryOverview } from "./entityHistoryOverview.stylex";
import { EntityImageGallery } from "./entityImageGallery.stylex";
import { EntityImagePlaceholder } from "./entityImagePlaceholder.stylex";
import { EntityMap } from "./entityMap.stylex";
import { EntityOverviewLayout } from "./entityOverviewLayout.stylex";
import { entityOverviewQueries } from "./entityOverviewQueries";
import { useEntityPage } from "./entityPageFrameClient.stylex";
import { EntityReleaseOverview } from "./entityReleaseOverview";
import { EntitySiblingOverview } from "./entitySiblingOverview";

export function EntityOverviewClient() {
  const orpc = useORPC();
  const entity = useEntityPage();
  const catalogQuery = useQuery(
    entityOverviewQueries.bottleCatalog(orpc, entity),
  );
  const eventListQuery = useQuery(entityOverviewQueries.events(orpc, entity));
  const bottleListQuery = useQuery(
    entityOverviewQueries.popularBottles(orpc, entity),
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

  return (
    <EntityOverviewLayout
      facts={
        <>
          {hasEntityDetails(entity) ? <EntityDetails entity={entity} /> : null}
        </>
      }
      catalogSections={
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
            <>
              <CompanyOwnedList
                company={entity}
                error={false}
                href={`${getEntityUrl(entity)}/portfolio?kind=brand`}
                items={companyPortfolioQuery.data?.previews.brands}
                pending={false}
                retry={() => void companyPortfolioQuery.refetch()}
                section="brands"
                total={companyPortfolioQuery.data?.totals.brands}
              />
              <CompanyOwnedList
                company={entity}
                error={false}
                href={`${getEntityUrl(entity)}/portfolio?kind=distillery`}
                items={companyPortfolioQuery.data?.previews.distilleries}
                pending={false}
                retry={() => void companyPortfolioQuery.refetch()}
                section="distilleries"
                total={companyPortfolioQuery.data?.totals.distilleries}
              />
              <CompanyOwnedList
                company={entity}
                error={false}
                href={`${getEntityUrl(entity)}/portfolio?kind=bottler`}
                items={companyPortfolioQuery.data?.previews.bottlers}
                pending={false}
                retry={() => void companyPortfolioQuery.refetch()}
                section="bottlers"
                total={companyPortfolioQuery.data?.totals.bottlers}
              />
            </>
          )}
          <EntityReleaseOverview
            entity={entity}
            error={Boolean(releaseListQuery.error)}
            pending={releaseListQuery.isPending}
            releaseList={releaseListQuery.data}
            retry={() => void releaseListQuery.refetch()}
          />
          <EntityBottleOverview
            bottleList={bottleListQuery.data}
            createBottleHref={getEntityBottleCreateHref(entity)}
            entity={entity}
            error={Boolean(bottleListQuery.error)}
            pending={bottleListQuery.isPending}
            retry={() => void bottleListQuery.refetch()}
            totalBottles={entity.totalBottles}
          />
          <EntityHistoryOverview
            entityName={entity.name}
            error={Boolean(eventListQuery.error)}
            eventList={eventListQuery.data}
            pending={eventListQuery.isPending}
            retry={() => void eventListQuery.refetch()}
          />
        </>
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

const styles = stylex.create({
  flavorProfile: {
    display: { default: "block", ":empty": "none" },
    paddingTop: space.x6,
  },
});
