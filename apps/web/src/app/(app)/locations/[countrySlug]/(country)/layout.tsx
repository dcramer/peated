import { ButtonLink, ExpandableDescription } from "@peated/web/components";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache, type ReactNode } from "react";

import { LocationPageFrame } from "../../locationPageFrame.stylex";

const getCountry = cache(async (countrySlug: string) => {
  const { client } = await getPublicPageServerClient();
  return await resolveOrNotFound(
    client.countries.details({ country: countrySlug }),
  );
});

export async function generateMetadata(props: {
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = await props.params;
  const country = await getCountry(countrySlug);

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
    getCountry(countrySlug),
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
      country={undefined}
      description={
        country.description ? (
          <ExpandableDescription content={country.description} noLinks />
        ) : undefined
      }
      name={country.name}
      tabs={[
        {
          count: country.totalDistillers,
          href: rootHref,
          label: "Distillers",
        },
        { href: `${rootHref}/regions`, label: "Regions" },
      ]}
      visual={{ kind: "country", slug: country.slug }}
    >
      {props.children}
    </LocationPageFrame>
  );
}
