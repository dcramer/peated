"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { trpc } from "@peated/web/lib/trpc/client";
import { type ReactNode, use } from "react";

export default function Page(props: {
  params: Promise<{ countrySlug: string }>;
  children: ReactNode;
}) {
  const params = use(props.params);

  const { countrySlug } = params;

  const { children } = props;

  const [country] = trpc.countryBySlug.useSuspenseQuery(countrySlug);

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
            current: true,
          },
        ]}
      />

      <PageHeader
        title={country.name}
        metadata={
          <div className="flex gap-x-1">
            <Button href={`/admin/locations/${country.slug}/regions/add`}>
              Add Region
            </Button>
            <Button href={`/admin/locations/${country.slug}/edit`}>
              Edit Location
            </Button>
          </div>
        }
      />

      <Tabs border>
        <TabItem as={Link} href={`/admin/locations/${country.slug}`} controlled>
          Regions
        </TabItem>
      </Tabs>

      {children}
    </div>
  );
}
