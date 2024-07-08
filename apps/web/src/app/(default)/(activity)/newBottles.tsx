"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/src/lib/format";
import BottleLink from "@peated/web/components/bottleLink";
import Link from "@peated/web/components/link";
import { trpc } from "@peated/web/lib/trpc";

export function NewBottlesSkeleton() {
  const Row = () => (
    <tr className=" border-b border-slate-800">
      <td className="max-w-0 space-y-1 overflow-hidden px-4 py-1 text-sm sm:px-3">
        <div className="flex animate-pulse items-center overflow-hidden bg-slate-800 -indent-96">
          Bottle
        </div>
        <div className="text-light w-2/5 animate-pulse bg-slate-800 -indent-96 text-sm">
          Category
        </div>
      </td>
    </tr>
  );
  return (
    <table className="my-2 min-w-full">
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
  const [newBottleList] = trpc.bottleList.useSuspenseQuery({
    sort: "-created",
    limit: 10,
  });

  return (
    <table className="my-2 min-w-full">
      <tbody>
        {newBottleList &&
          newBottleList.results.map((bottle) => {
            return (
              <tr key={bottle.id} className="border-b border-slate-800">
                <td className="max-w-0 py-2 pl-4 pr-4 text-sm sm:pl-3">
                  <div className="flex items-center space-x-1">
                    <BottleLink
                      bottle={bottle}
                      className="font-medium hover:underline"
                    >
                      {bottle.fullName}
                    </BottleLink>
                    {bottle.vintageYear && (
                      <>
                        {" "}
                        <span className="text-light">
                          ({bottle.vintageYear})
                        </span>
                      </>
                    )}
                    {bottle.isFavorite && (
                      <StarIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                    {bottle.hasTasted && (
                      <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  {!!bottle.category && (
                    <div className="text-light text-sm">
                      <Link
                        href={`/bottles/?category=${bottle.category}`}
                        className="hover:underline"
                      >
                        {formatCategoryName(bottle.category)}
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}
