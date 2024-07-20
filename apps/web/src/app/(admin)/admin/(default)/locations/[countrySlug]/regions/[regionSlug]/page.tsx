"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import { trpc } from "@peated/web/lib/trpc/client";
import { type ReactNode } from "react";

export default function Page({
  params: { countrySlug, regionSlug },
  children,
}: {
  params: { countrySlug: string; regionSlug: string };
  children: ReactNode;
}) {
  const [country] = trpc.countryBySlug.useSuspenseQuery(countrySlug);
  const [region] = trpc.regionBySlug.useSuspenseQuery({
    country: countrySlug,
    slug: regionSlug,
  });

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
              href={`/admin/locations/${country.slug}/regions/${region.slug}edit`}
            >
              Edit Region
            </Button>
          </div>
        }
      />
    </div>
  );
}
