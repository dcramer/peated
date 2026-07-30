"use client";

import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import useBottleCheckCapabilities from "@peated/web/hooks/useBottleCheckCapabilities";
import { ADMIN_WORKSTREAMS } from "./workstreams";

export default function AdminWorkstreamTabs() {
  const { bottleChecks } = useBottleCheckCapabilities();
  const workstreams = ADMIN_WORKSTREAMS.filter(
    (workstream) => workstream.id !== "bottle-checks" || bottleChecks,
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 px-4">
      <Tabs border fullWidth noMargin>
        {workstreams.map((workstream) => (
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
