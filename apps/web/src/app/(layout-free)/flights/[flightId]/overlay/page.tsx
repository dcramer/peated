"use client";
import { use } from "react";

import BottleLink from "@peated/web/components/bottleLink";
import { Distillers } from "@peated/web/components/bottleMetadata";
import LayoutEmpty from "@peated/web/components/layoutEmpty";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page(props: { params: Promise<{ flightId: string }> }) {
  const params = use(props.params);

  const { flightId } = params;

  const [[flight, bottles]] = trpc.useSuspenseQueries((t) => [
    t.flightById(flightId),
    t.bottleList({
      flight: flightId,
    }),
  ]);

  return (
    <LayoutEmpty fullWidth>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
          <div className="w-full flex-auto flex-col items-center space-y-1 sm:w-auto sm:items-start">
            <h1 className="mb-2 text-center text-4xl font-semibold sm:text-left">
              {flight.name}
            </h1>
            {flight.description && (
              <div className="text-muted text-center sm:text-left">
                {flight.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-full lg:w-8/12">
            <table className="min-w-full">
              <tbody>
                {bottles.results.map((bottle) => {
                  return (
                    <tr key={bottle.id} className="border-b border-slate-800">
                      <td className="group relative max-w-0 py-4 pl-4 pr-3 sm:pl-3">
                        <BottleLink
                          bottle={bottle}
                          flightId={flight.id}
                          className="absolute inset-0"
                          withPanel
                        />
                        <div className="flex items-center gap-x-1 text-2xl group-hover:underline">
                          <div className="font-semibold">{bottle.fullName}</div>
                        </div>
                        <div className="text-muted flex flex-row items-start space-x-1 truncate">
                          <Distillers data={bottle} />
                        </div>
                        {bottle.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="hidden p-4 pl-12 lg:block lg:w-4/12"></div>
        </div>
      </div>
    </LayoutEmpty>
  );
}
