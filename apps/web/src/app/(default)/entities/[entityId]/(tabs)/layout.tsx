import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getEntityUrl } from "@peated/web/lib/urls";
import { type ReactNode } from "react";

export default async function Layout(props: {
  params: Promise<{ entityId: string }>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { entityId } = params;

  const { children } = props;

  const entity = await getEntityPage(Number(entityId));
  const baseUrl = getEntityUrl(entity);

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
