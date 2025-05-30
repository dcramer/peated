"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params: { countrySlug, regionSlug },
}: {
  params: { countrySlug: string; regionSlug: string };
}) {
  const orpc = useORPC();
  const { data: country } = useSuspenseQuery(
    orpc.countries.details.queryOptions({
      input: {
        country: countrySlug,
      },
    }),
  );

  const { data: region } = useSuspenseQuery(
    orpc.regions.details.queryOptions({
      input: {
        country: countrySlug,
        region: regionSlug,
      },
    }),
  );

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Locations",
            href: "/admin/locations",
          },
          {
            name: country.name,
            href: `/admin/locations/${country.slug}`,
          },
          {
            name: region.name,
            href: `/admin/locations/${country.slug}/regions/${region.slug}`,
            current: true,
          },
        ]}
      />

      <PageHeader
        title={`${region.name}, ${country.name}`}
        metadata={
          <div className="flex gap-x-1">
            <Button
              href={`/admin/locations/${country.slug}/regions/${region.slug}/edit`}
            >
              Edit Region
            </Button>
          </div>
        }
      />
    </div>
  );
}
