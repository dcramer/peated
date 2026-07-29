import type { Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";

export default function BottleTabs({ bottle }: { bottle: Bottle }) {
  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <Tabs border>
      <TabItem as={Link} href={baseUrl} controlled>
        Overview
      </TabItem>
      <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
        Tastings ({bottle.totalTastings.toLocaleString()})
      </TabItem>
      <TabItem as={Link} href={`${baseUrl}/prices`} controlled desktopOnly>
        Prices
      </TabItem>
      {bottle.group && bottle.group.totalBottles > 1 ? (
        <TabItem as={Link} href={`${baseUrl}/releases`} controlled>
          Releases ({bottle.group.totalBottles.toLocaleString()})
        </TabItem>
      ) : null}
    </Tabs>
  );
}
