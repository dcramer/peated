import type { Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";

export interface BottleTabsBottle {
  id: Bottle["id"];
  totalTastings: Bottle["totalTastings"];
  group?: Pick<NonNullable<Bottle["group"]>, "totalBottles">;
}

export type BottleTab = {
  desktopOnly?: boolean;
  href: string;
  label: string;
};

export function getBottleTabs(bottle: BottleTabsBottle): BottleTab[] {
  const baseUrl = `/bottles/${bottle.id}`;
  const tabs: BottleTab[] = [
    { href: baseUrl, label: "Overview" },
    {
      href: `${baseUrl}/tastings`,
      label: `Tastings (${bottle.totalTastings.toLocaleString()})`,
    },
    { desktopOnly: true, href: `${baseUrl}/prices`, label: "Prices" },
  ];

  if (bottle.group && bottle.group.totalBottles > 1) {
    tabs.push({
      href: `${baseUrl}/releases`,
      label: `Releases (${bottle.group.totalBottles.toLocaleString()})`,
    });
  }

  return tabs;
}

export default function BottleTabs({ bottle }: { bottle: BottleTabsBottle }) {
  return (
    <Tabs border>
      {getBottleTabs(bottle).map((tab) => (
        <TabItem
          as={Link}
          controlled
          desktopOnly={tab.desktopOnly}
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
        </TabItem>
      ))}
    </Tabs>
  );
}
