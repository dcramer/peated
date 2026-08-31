"use client";

import { use, type ReactNode } from "react";

import { PageTabs } from "@peated/web/components";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ countrySlug: string }>;
}) {
  const { countrySlug } = use(params);
  const orpc = useORPC();
  const { data: country } = useSuspenseQuery(
    orpc.countries.details.queryOptions({ input: { country: countrySlug } }),
  );
  const href = `/admin/locations/${country.slug}`;

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Locations", href: "/admin/locations" },
          { label: country.name, href, current: true },
        ]}
      />
      <AdminPageHeader
        title={country.name}
        actions={
          <AdminActions>
            <Button href={`${href}/regions/add`}>Add region</Button>
            <Button href={`${href}/edit`}>Edit location</Button>
          </AdminActions>
        }
      />
      <PageTabs
        ariaLabel="Location"
        currentHref={href}
        items={[{ href, label: "Regions" }]}
      />
      {children}
    </AdminPage>
  );
}
