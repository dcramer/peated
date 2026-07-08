import type { Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getBottleBottlingsPath } from "@peated/web/lib/bottlings";

export default function BottleTabs({ bottle }: { bottle: Bottle }) {
  const baseUrl = `/bottles/${bottle.id}`;
  const bottlingsUrl = getBottleBottlingsPath(bottle.id);

  return (
    <Tabs border>
      <TabItem as={Link} href={baseUrl} controlled>
        Overview
      </TabItem>
      <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
        Tastings ({bottle.totalTastings.toLocaleString()})
      </TabItem>
      <TabItem as={Link} href={bottlingsUrl} controlled match="prefix">
        Bottlings ({bottle.numReleases.toLocaleString()})
      </TabItem>
      <TabItem as={Link} href={`${baseUrl}/prices`} controlled desktopOnly>
        Prices
      </TabItem>
      <TabItem as={Link} href={`${baseUrl}/similar`} controlled desktopOnly>
        Similar
      </TabItem>
    </Tabs>
  );
}
