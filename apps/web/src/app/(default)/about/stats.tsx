"use client";

import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export function StatsSkeleton() {
  return (
    <div className="hidden items-center gap-4 text-center sm:grid sm:grid-cols-1 lg:grid-cols-2">
      {["Tastings", "Bottles", "Entities"].map((name) => (
        <SkeletonStat key={name} name={name} />
      ))}
    </div>
  );
}

function SkeletonStat({ name }: { name: string }) {
  return (
    <div>
      <div className="text-muted leading-7">{name}</div>
      <div className="order-first animate-pulse text-3xl font-semibold tracking-tight sm:text-5xl">
        ?
      </div>
    </div>
  );
}

export default function Stats() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(orpc.stats.queryOptions());

  if (!data) {
    return <div>{"Oops, maybe you're offline?"}</div>;
  }

  const stats = [
    { name: "Tastings", value: data.totalTastings.toLocaleString() },
    { name: "Bottles", value: data.totalBottles.toLocaleString() },
    { name: "Entities", value: data.totalEntities.toLocaleString() },
  ];

  return (
    <div className="hidden items-center gap-4 text-center sm:grid sm:grid-cols-1 lg:grid-cols-2">
      {stats.map((stat) => (
        <div key={stat.name}>
          <div className="text-muted leading-7">{stat.name}</div>
          <div className="order-first text-3xl font-semibold tracking-tight sm:text-5xl">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
