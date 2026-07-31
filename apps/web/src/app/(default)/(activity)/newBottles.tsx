"use client";

import BottleIdentity from "@peated/web/components/bottleIdentity";
import BottleStatusIcons from "@peated/web/components/bottleStatusIcons";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export function NewBottlesSkeleton() {
  const Row = () => (
    <tr className="border-b border-slate-800">
      <td className="max-w-0 space-y-1 overflow-hidden px-4 py-1 text-sm sm:px-3">
        <div className="flex animate-pulse items-center overflow-hidden bg-slate-800 -indent-96">
          Bottle
        </div>
        <div className="text-muted w-2/5 animate-pulse bg-slate-800 -indent-96 text-sm">
          Category
        </div>
      </td>
    </tr>
  );
  return (
    <table className="min-w-full">
      <tbody>
        <Row />
        <Row />
        <Row />
        <Row />
        <Row />
        <Row />
        <Row />
        <Row />
        <Row />
        <Row />
      </tbody>
    </table>
  );
}

export default function NewBottles() {
  const orpc = useORPC();
  const { data: newBottleList } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({ input: { limit: 10, sort: "-created" } }),
  );

  return (
    <table className="min-w-full">
      <tbody>
        {newBottleList &&
          newBottleList.results.map((bottle) => {
            return (
              <tr key={bottle.id} className="border-b border-slate-800">
                <td className="max-w-0 py-2 pl-4 pr-4 text-sm sm:pl-3">
                  <BottleIdentity
                    bottle={bottle}
                    mode="absolute"
                    metadataVariant="summary"
                    trailingContent={<BottleStatusIcons bottle={bottle} />}
                  />
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}
