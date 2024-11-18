import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type ReactNode } from "react";

export default async function Layout(props: {
  params: Promise<Record<string, any>>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { children } = props;

  const bottleId = Number(params.bottleId);
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(bottleId);

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
        <TabItem as={Link} href={`${baseUrl}/prices`} controlled>
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
