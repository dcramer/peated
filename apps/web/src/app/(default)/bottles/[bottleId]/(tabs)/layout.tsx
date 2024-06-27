import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import Link from "next/link";
import { type ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const bottleId = Number(params.bottleId);
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.ensureData(bottleId);

  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <>
      <Tabs fullWidth border>
        <TabItem as={Link} href={baseUrl} controlled>
          Overview
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
          Tastings ({bottle.totalTastings.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/prices`} controlled>
          Prices
        </TabItem>
      </Tabs>

      {children}
    </>
  );
}
