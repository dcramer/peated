import { ButtonLink, ExpandableDescription } from "@peated/web/components";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getCountryPage } from "@peated/web/lib/locationPage.server";
import type { ReactNode } from "react";

import { getCountryLocationTabs } from "../../locationPage";
import { LocationPageFrame } from "../../locationPageFrame.stylex";

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const country = await getCountryPage(countrySlug);

  return {
    title: `Whisky from ${country.name}`,
    description: country.description,
  };
}

export default async function CountryLayout(props: {
  children: ReactNode;
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const [country, user] = await Promise.all([
    getCountryPage(countrySlug),
    getCurrentUser(),
  ]);
  const rootHref = `/locations/${country.slug}`;

  return (
    <LocationPageFrame
      actions={
        user?.mod ? (
          <ButtonLink
            href={`/admin/locations/${country.slug}/edit?returnTo=${rootHref}`}
            size="sm"
            variant="tonal"
          >
            Edit location
          </ButtonLink>
        ) : undefined
      }
      description={
        country.description ? (
          <ExpandableDescription content={country.description} noLinks />
        ) : undefined
      }
      location={{ kind: "country", name: country.name }}
      tabs={getCountryLocationTabs({
        rootHref,
        totalBottles: country.totalBottles,
        totalDistillers: country.totalDistillers,
      })}
    >
      {props.children}
    </LocationPageFrame>
  );
}
