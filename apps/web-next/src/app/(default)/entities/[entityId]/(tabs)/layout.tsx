import Tabs, { TabItem } from "@peated/web/components/tabs";
import Link from "next/link";
import { type ReactNode } from "react";
import { getEntity } from "../../utils.server";

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const entityId = Number(params.entityId);
  const entity = await getEntity(entityId);

  const baseUrl = `/entities/${entity.id}`;

  return (
    <>
      <Tabs fullWidth border>
        <TabItem as={Link} href={baseUrl} controlled>
          Overview
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/bottles`} controlled>
          Bottles ({entity.totalBottles.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
          Tastings ({entity.totalTastings.toLocaleString()})
        </TabItem>
      </Tabs>

      {children}
    </>
  );
}
