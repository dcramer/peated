"use client";

import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { ADMIN_WORKSTREAMS } from "./workstreams";

export default function AdminWorkstreamTabs() {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 px-4">
      <Tabs border fullWidth noMargin>
        {ADMIN_WORKSTREAMS.map((workstream) => (
          <TabItem
            key={workstream.id}
            as={Link}
            controlled
            href={workstream.href}
          >
            {workstream.sidebarLabel}
          </TabItem>
        ))}
      </Tabs>
    </div>
  );
}
