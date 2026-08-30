import { ButtonLink } from "@peated/web/components/designSystem/components";
import Markdown from "@peated/web/components/markdown";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache } from "react";

import { LocationDistillerList } from "../../../locationLists";
import { LocationPageFrame } from "../../../locationPageFrame.stylex";

const getRegion = cache(async (countrySlug: string, regionSlug: string) => {
  const { client } = await getPublicPageServerClient();
  return await resolveOrNotFound(
    client.regions.details({ country: countrySlug, region: regionSlug }),
  );
});

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const { countrySlug, regionSlug } = await props.params;
  const region = await getRegion(countrySlug, regionSlug);

  return {
    title: `Whisky from ${region.name}, ${region.country.name}`,
    description: region.description,
  };
}

export default async function RegionPage(props: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ countrySlug, regionSlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const { client } = await getPublicPageServerClient();
  const region = await getRegion(countrySlug, regionSlug);
  const queryParams = getApiQueryParams(searchParams, {
    defaults: { sort: "-bottles" },
    numericFields: ["cursor", "limit"],
    overrides: { country: countrySlug, limit: 50, region: regionSlug },
  });
  const [distillerList, user] = await Promise.all([
    client.distilleries.list(queryParams),
    getCurrentUser(),
  ]);
  const pathname = `/locations/${countrySlug}/regions/${regionSlug}`;
  const page = Number(queryParams.cursor ?? 1) || 1;

  return (
    <LocationPageFrame
      actions={
        user?.mod ? (
          <ButtonLink
            href={`/admin/locations/${countrySlug}/regions/${regionSlug}/edit?returnTo=${pathname}`}
            size="sm"
            variant="tonal"
          >
            Edit location
          </ButtonLink>
        ) : undefined
      }
      country={{
        href: `/locations/${region.country.slug}`,
        name: region.country.name,
      }}
      description={
        region.description ? (
          <Markdown content={region.description} noLinks />
        ) : undefined
      }
      name={region.name}
      tabs={[{ href: pathname, label: "Distillers" }]}
      totalBottles={region.totalBottles}
      totalDistillers={region.totalDistillers}
      visual={
        countrySlug === "united-states"
          ? { kind: "state", slug: region.slug }
          : undefined
      }
    >
      <LocationDistillerList
        items={distillerList.results}
        name={region.name}
        nextHref={getCursorHref(
          pathname,
          searchParams,
          distillerList.rel.nextCursor,
        )}
        page={page}
        previousHref={getCursorHref(
          pathname,
          searchParams,
          distillerList.rel.prevCursor,
        )}
      />
    </LocationPageFrame>
  );
}
