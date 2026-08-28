"use client";

import { use } from "react";

import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import Button from "@peated/web/components/button";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params,
}: {
  params: Promise<{ countrySlug: string; regionSlug: string }>;
}) {
  const { countrySlug, regionSlug } = use(params);
  const orpc = useORPC();
  const { data: country } = useSuspenseQuery(
    orpc.countries.details.queryOptions({ input: { country: countrySlug } }),
  );
  const { data: region } = useSuspenseQuery(
    orpc.regions.details.queryOptions({
      input: { country: countrySlug, region: regionSlug },
    }),
  );
  const href = `/admin/locations/${country.slug}/regions/${region.slug}`;

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Locations", href: "/admin/locations" },
          { label: country.name, href: `/admin/locations/${country.slug}` },
          { label: region.name, href, current: true },
        ]}
      />
      <AdminPageHeader
        title={`${region.name}, ${country.name}`}
        actions={<Button href={`${href}/edit`}>Edit region</Button>}
      />
    </AdminPage>
  );
}
