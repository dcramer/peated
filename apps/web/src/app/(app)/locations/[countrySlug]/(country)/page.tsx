import { serializeCountryStructuredData } from "@peated/web/lib/catalogStructuredData";
import { getCountryPage } from "@peated/web/lib/locationPage.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getCountrySeoMetadata } from "@peated/web/lib/seoMetadata";
import { Suspense } from "react";

import {
  LocationCategoriesLoading,
  LocationCategoriesSection,
  LocationDistilleriesLoading,
  LocationDistilleriesSection,
  LocationLatestReleasesSection,
  LocationMapSection,
  LocationOverviewFrame,
  LocationProductionRules,
  LocationRegionsLoading,
  LocationRegionsSection,
  LocationReleasesLoading,
} from "../../locationOverview.stylex";
import {
  getLocationCategoryItems,
  getLocationDistilleries,
  getLocationLatestReleases,
  getLocationRegions,
} from "../../locationPage";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const location = await getCountryPage(countrySlug);
  return getCountrySeoMetadata(location);
}

export default async function CountryOverviewPage(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const country = await getCountryPage(countrySlug);
  const rootHref = `/locations/${countrySlug}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeCountryStructuredData(country),
        }}
      />
      <LocationOverviewFrame
        rail={
          <>
            <LocationMapSection
              visual={{ kind: "country", slug: country.slug }}
            />
            <LocationProductionRules content={country.summary} />
            {country.totalBottles ? (
              <Suspense fallback={<LocationCategoriesLoading />}>
                <CountryCategories countrySlug={countrySlug} />
              </Suspense>
            ) : null}
          </>
        }
        totalBottles={country.totalBottles}
        totalDistillers={country.totalDistillers}
      >
        {country.totalBottles ? (
          <Suspense fallback={<LocationRegionsLoading />}>
            <CountryRegions countrySlug={countrySlug} />
          </Suspense>
        ) : null}
        {country.totalDistillers ? (
          <Suspense fallback={<LocationDistilleriesLoading />}>
            <CountryDistilleries
              countrySlug={countrySlug}
              href={`${rootHref}/distillers`}
              total={country.totalDistillers}
            />
          </Suspense>
        ) : null}
        {country.totalBottles ? (
          <Suspense fallback={<LocationReleasesLoading />}>
            <CountryLatestReleases
              countrySlug={countrySlug}
              href={`${rootHref}/bottles?sort=-release`}
            />
          </Suspense>
        ) : null}
      </LocationOverviewFrame>
    </>
  );
}

async function CountryCategories({ countrySlug }: { countrySlug: string }) {
  const { client } = await getPublicPageServerClient();
  const categories = await client.countries.categories({
    country: countrySlug,
  });
  return (
    <LocationCategoriesSection
      categories={getLocationCategoryItems(categories.results)}
    />
  );
}

async function CountryRegions({ countrySlug }: { countrySlug: string }) {
  const { client } = await getPublicPageServerClient();
  const regions = await client.regions.list({
    country: countrySlug,
    hasBottles: true,
    limit: 4,
    sort: "-bottles",
  });
  return (
    <LocationRegionsSection regions={getLocationRegions(regions.results)} />
  );
}

async function CountryDistilleries({
  countrySlug,
  href,
  total,
}: {
  countrySlug: string;
  href: string;
  total: number;
}) {
  const { client } = await getPublicPageServerClient();
  const distilleries = await client.distilleries.list({
    country: countrySlug,
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

async function CountryLatestReleases({
  countrySlug,
  href,
}: {
  countrySlug: string;
  href: string;
}) {
  const { client } = await getPublicPageServerClient();
  const releases = await client.bottles.list({
    country: countrySlug,
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
