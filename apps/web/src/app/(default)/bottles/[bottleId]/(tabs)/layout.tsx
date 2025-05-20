import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { client } from "@peated/web/lib/orpc/client";
import { type ReactNode } from "react";

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const bottleId = Number(params.bottleId);
  const bottle = await client.bottles.details({ bottle: bottleId });

  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <>
      <Tabs border>
        <TabItem as={Link} href={baseUrl} controlled>
          Overview
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
          Tastings ({bottle.totalTastings.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/releases`} controlled>
          Releases ({bottle.numReleases.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/prices`} controlled desktopOnly>
          Prices
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/similar`} controlled desktopOnly>
          Similar
        </TabItem>
      </Tabs>
      {children}
    </>
  );
}
