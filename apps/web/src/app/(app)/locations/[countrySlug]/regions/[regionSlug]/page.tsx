import { FlavorProfileSection } from "@peated/web/features/flavorProfile/flavorProfileSection";
import { serializeRegionStructuredData } from "@peated/web/lib/catalogStructuredData";
import { getRegionMap } from "@peated/web/lib/locationMap";
import { getRegionPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getRegionSeoMetadata } from "@peated/web/lib/seoMetadata";
import { Suspense } from "react";

import {
  LocationCategoriesLoading,
  LocationCategoriesSection,
  LocationDistilleriesLoading,
  LocationDistilleriesSection,
  LocationLatestReleasesSection,
  LocationMapSection,
  LocationOtherRegionsLoading,
  LocationOtherRegionsSection,
  LocationOverviewFrame,
  LocationReleasesLoading,
} from "../../../locationOverview.stylex";
import {
  getLocationCategoryItems,
  getLocationDistilleries,
  getLocationLatestReleases,
  getLocationRegions,
} from "../../../locationPage";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const { countrySlug, regionSlug } = await props.params;
  const location = await getRegionPage(countrySlug, regionSlug);
  return getRegionSeoMetadata(location);
}

export default async function RegionOverviewPage(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const { countrySlug, regionSlug } = await props.params;
  const region = await getRegionPage(countrySlug, regionSlug);
  const rootHref = `/locations/${countrySlug}/regions/${regionSlug}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeRegionStructuredData(region),
        }}
      />
      <LocationOverviewFrame
        rail={
          <>
            <LocationMapSection
              visual={getRegionMap(countrySlug, regionSlug)}
            />
            <FlavorProfileSection
              scope={{
                kind: "region",
                country: countrySlug,
                region: regionSlug,
              }}
            />
            {region.totalBottles ? (
              <Suspense fallback={<LocationCategoriesLoading />}>
                <RegionCategories
                  countrySlug={countrySlug}
                  regionSlug={regionSlug}
                />
              </Suspense>
            ) : null}
            <Suspense fallback={<LocationOtherRegionsLoading />}>
              <OtherRegions countrySlug={countrySlug} regionSlug={regionSlug} />
            </Suspense>
          </>
        }
        totalBottles={region.totalBottles}
        totalDistillers={region.totalDistillers}
      >
        {region.totalDistillers ? (
          <Suspense fallback={<LocationDistilleriesLoading />}>
            <RegionDistilleries
              countrySlug={countrySlug}
              href={`${rootHref}/distillers`}
              regionSlug={regionSlug}
              total={region.totalDistillers}
            />
          </Suspense>
        ) : null}
        {region.totalBottles ? (
          <Suspense fallback={<LocationReleasesLoading />}>
            <RegionLatestReleases
              countrySlug={countrySlug}
              href={`${rootHref}/bottles?sort=-release`}
              regionSlug={regionSlug}
            />
          </Suspense>
        ) : null}
      </LocationOverviewFrame>
    </>
  );
}

async function RegionCategories({
  countrySlug,
  regionSlug,
}: {
  countrySlug: string;
  regionSlug: string;
}) {
  const { client } = await getPublicPageServerClient();
  const categories = await client.regions.categories({
    country: countrySlug,
    region: regionSlug,
  });
  return (
    <LocationCategoriesSection
      categories={getLocationCategoryItems(categories.results)}
    />
  );
}

async function OtherRegions({
  countrySlug,
  regionSlug,
}: {
  countrySlug: string;
  regionSlug: string;
}) {
  const { client } = await getPublicPageServerClient();
  const regions = await client.regions.list({
    country: countrySlug,
    hasBottles: true,
    limit: 6,
    sort: "-bottles",
  });
  const otherRegions = getLocationRegions(
    regions.results
      .filter((candidate) => candidate.slug !== regionSlug)
      .slice(0, 5),
  );
  return (
    <LocationOtherRegionsSection
      href={`/locations/${countrySlug}/regions`}
      regions={otherRegions}
    />
  );
}

async function RegionDistilleries({
  countrySlug,
  href,
  regionSlug,
  total,
}: {
  countrySlug: string;
  href: string;
  regionSlug: string;
  total: number;
}) {
  const { client } = await getPublicPageServerClient();
  const distilleries = await client.distilleries.list({
    country: countrySlug,
    region: regionSlug,
    limit: 5,
    sort: "-bottles",
  });
  return (
    <LocationDistilleriesSection
      distilleries={getLocationDistilleries(distilleries.results)}
      href={href}
      total={total}
    />
  );
}

async function RegionLatestReleases({
  countrySlug,
  href,
  regionSlug,
}: {
  countrySlug: string;
  href: string;
  regionSlug: string;
}) {
  const { client } = await getPublicPageServerClient();
  const releases = await client.bottles.list({
    country: countrySlug,
    region: regionSlug,
    limit: 5,
    sort: "-release",
  });
  return (
    <LocationLatestReleasesSection
      href={href}
      releases={getLocationLatestReleases(releases.results)}
    />
  );
}
