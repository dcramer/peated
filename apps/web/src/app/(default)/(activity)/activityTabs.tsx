"use client";

import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";

export default function ActivityTabs() {
  return (
    <Tabs fullWidth border noMargin>
      <TabItem as={Link} href="/activity/friends" controlled>
        Friends
      </TabItem>
      <TabItem as={Link} href="/" controlled>
        Global
      </TabItem>
    </Tabs>
  );
}
