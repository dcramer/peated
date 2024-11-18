import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type ReactNode } from "react";

export default async function Layout(props: {
  params: Promise<{ entityId: string }>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { entityId } = params;

  const { children } = props;

  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  const baseUrl = `/entities/${entity.id}`;

  return (
    <>
      <Tabs border>
        <TabItem as={Link} href={baseUrl} controlled>
          Overview
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/bottles`} controlled>
          Bottles ({entity.totalBottles.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
          Tastings ({entity.totalTastings.toLocaleString()})
        </TabItem>
        {entity.shortName === "SMWS" && (
          <TabItem as={Link} href={`${baseUrl}/codes`} controlled desktopOnly>
            Distillery Codes
          </TabItem>
        )}
      </Tabs>

      {children}
    </>
  );
}
