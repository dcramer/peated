import { ButtonLink, ExpandableDescription } from "@peated/web/components";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getRegionPage } from "@peated/web/lib/locationPage.server";
import type { ReactNode } from "react";

import { getRegionLocationTabs } from "../../../locationPage";
import { LocationPageFrame } from "../../../locationPageFrame.stylex";

export default async function RegionLayout(props: {
  children: ReactNode;
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const { countrySlug, regionSlug } = await props.params;
  const [region, user] = await Promise.all([
    getRegionPage(countrySlug, regionSlug),
    getCurrentUser(),
  ]);
  const rootHref = `/locations/${countrySlug}/regions/${regionSlug}`;

  return (
    <LocationPageFrame
      actions={
        user?.mod ? (
          <ButtonLink
            href={`/admin/locations/${countrySlug}/regions/${regionSlug}/edit?returnTo=${rootHref}`}
            size="sm"
            variant="tonal"
          >
            Edit location
          </ButtonLink>
        ) : undefined
      }
      description={
        region.description ? (
          <ExpandableDescription content={region.description} noLinks />
        ) : undefined
      }
      location={{
        country: {
          href: `/locations/${region.country.slug}`,
          name: region.country.name,
        },
        kind: "region",
        name: region.name,
      }}
      tabs={getRegionLocationTabs({
        rootHref,
        totalBottles: region.totalBottles,
        totalDistillers: region.totalDistillers,
      })}
    >
      {props.children}
    </LocationPageFrame>
  );
}
