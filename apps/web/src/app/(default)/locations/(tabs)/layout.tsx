import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Locations",
};

export default async function Page({ children }: { children: ReactNode }) {
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
