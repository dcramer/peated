import Link from "@peated/web/components/link";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import type { Metadata } from "next";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Locations",
};

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Locations" />
      <Tabs border>
        <TabItem as={Link} href={`/locations`} controlled>
          Overview
        </TabItem>
        <TabItem as={Link} href={`/locations/all-regions`} controlled>
          All Regions
        </TabItem>
      </Tabs>
      {children}
    </>
  );
}
