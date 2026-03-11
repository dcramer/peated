"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import SimpleHeader from "@peated/web/components/simpleHeader";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

function QueueStats() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.admin.queueInfo.queryOptions({
      refetchInterval: 5000,
    }),
  );

  return (
    <>
      <SimpleHeader>Async Tasks</SimpleHeader>
      <div className="my-6 grid grid-cols-4 items-center gap-3 text-center">
        {Object.entries(data.stats).map(([name, count]) => {
          return (
            <div className="mr-4 pr-3 text-center" key={name}>
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {count.toLocaleString()}
              </span>
              <span className="text-muted text-sm">{name}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function Admin() {
  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
        ]}
      />

      <div>
        <QueueStats />
      </div>
    </>
  );
}
