import Tabs, { TabItem } from "@peated/web/components/tabs";
import Link from "next/link";
import { type ReactNode } from "react";
import { getBottle } from "../../utils.server";

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const bottleId = Number(params.bottleId);
  const bottle = await getBottle(bottleId);

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
